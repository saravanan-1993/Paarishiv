import re

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.finance import ExpenseBase
from database import get_database
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime
from app.utils.auth import get_current_user, validate_object_id
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_FINANCE

router = APIRouter(prefix="/finance", tags=["finance"])

class BillCreate(BaseModel):
    project: str
    bill_no: str
    date: Optional[str] = None
    description: Optional[str] = "Running Account Bill"
    amount: float
    gst_rate: Optional[float] = 18
    bill_type: Optional[str] = "Running"

class PurchaseBillCreate(BaseModel):
    grn_id: Optional[str] = None
    po_id: Optional[str] = None
    bill_no: str
    bill_date: str
    vendor_name: str
    project_name: str
    items: List[dict] # [{name, qty, rate, gst, amount}]
    total_amount: float
    tax_amount: float = 0
    notes: Optional[str] = ""

class MarkPaidRequest(BaseModel):
    collection_amount: float

class ReceiptBase(BaseModel):
    project: str
    bill_id: Optional[str] = None
    bill_no: Optional[str] = None
    amount: float
    date: str
    payment_mode: str = "Bank"
    description: Optional[str] = ""
    received_from: Optional[str] = ""

@router.get("/expenses", response_model=List[ExpenseBase], dependencies=[Depends(RBACPermission("Accounts", "view", "Payments"))])
async def get_expenses(db = Depends(get_database)):
    expenses = await db.expenses.find().sort("date", -1).to_list(1000)
    return expenses

@router.get("/payables", dependencies=[Depends(RBACPermission("Accounts", "view", "Purchase"))])
async def get_payables(db = Depends(get_database)):
    # Fetch all GRNs
    grns = await db.grns.find().to_list(1000)
    
    # Fetch all POs to get rates (if any)
    pos_list = await db.purchase_orders.find().to_list(1000)
    pos_map = {str(p["_id"]): p for p in pos_list}
    
    # Fetch all material purchase expenses to check what's already paid
    expenses = await db.expenses.find({"category": "Material Purchase"}).to_list(1000)

    # Fetch purchase bills to get correct totals when GRN/PO don't have prices
    purchase_bills_list = await db.purchase_bills.find().to_list(1000)
    pb_by_grn = {}
    for pb in purchase_bills_list:
        grn_id = pb.get("grn_id")
        if grn_id:
            pb_by_grn[grn_id] = pb

    payables = []
    
    for grn in grns:
        grn_id_str = str(grn["_id"])
        po_id = grn.get("po_id")
        po = pos_map.get(po_id)
        
        if not po:
            continue
            
        total_value = 0
        grn_items = grn.get("items", [])
        if "total_amount" in grn and float(grn.get("total_amount") or 0) > 0:
            total_value = float(grn["total_amount"])
        else:
            po_items = po.get("items", [])
            
            for gi in grn_items:
                # Use net quantity (received - rejected) for payable calculation
                net_qty = float(gi.get("received_qty", 0)) - float(gi.get("rejected_qty", 0))
                if net_qty <= 0:
                    continue

                # Try to get price directly from GRN item (if updated during payment)
                grn_price = gi.get("price")
                if grn_price is not None and str(grn_price).strip() != "":
                    try:
                        total_value += net_qty * float(grn_price)
                        continue
                    except ValueError:
                        pass

                # Fallback to PO item rate
                matching_po_item = next((pi for pi in po_items if pi["name"] == gi["name"]), None)
                if matching_po_item and matching_po_item.get("rate"):
                    total_value += net_qty * float(matching_po_item.get("rate", 0))
        
        # If total_value is still 0, check purchase bills for the correct total
        if total_value == 0:
            pb = pb_by_grn.get(grn_id_str)
            if pb and float(pb.get("total_amount", 0)) > 0:
                total_value = float(pb["total_amount"])

        # Calculate how much was already paid against this specific GRN
        matching_expenses = [e for e in expenses if e.get("grn_id") == grn_id_str]
        paid_amount = sum(float(e.get("amount", 0)) for e in matching_expenses)
        
        # Get the invoice details from the first expense recorded
        first_exp = matching_expenses[0] if matching_expenses else None
        invoice_no = first_exp.get("invoice_no") if first_exp else None
        base_amount_stored = first_exp.get("base_amount") if first_exp else None
        
        # Determine GST percent from stored amounts
        gst_percent = 18
        if first_exp and first_exp.get("base_amount") and first_exp.get("base_amount") > 0:
            gst_percent = round((first_exp.get("gst_amount", 0) / first_exp.get("base_amount")) * 100)
        
        # If total_value is 0 (no rates in PO), we use the amount from previously recorded expenses 
        # or it remains 0 until processed in the frontend
        balance = max(0, total_value - paid_amount)
        
        # Check if manually marked as Paid in GRN document
        if grn.get("status") == "Paid":
            status = "Paid"
            balance = 0
        elif total_value > 0:
            if balance <= 0:
                status = "Paid"
            elif paid_amount > 0:
                status = "Partially Paid"
            else:
                status = "Pending"
        else:
            # For POs without rates, we rely on the expenses recorded
            if paid_amount > 0:
                status = "Partially Paid"
            else:
                status = "Pending"

        # Build a rate lookup: ONLY from linked PO rates + purchase bill for this GRN
        rate_lookup = {}
        if po:
            for pi in po.get("items", []):
                if pi.get("name") and pi.get("rate") is not None and float(pi.get("rate", 0)) > 0:
                    rate_lookup[pi["name"]] = float(pi["rate"])
        # Fallback: purchase bill rates for THIS GRN only
        pb = pb_by_grn.get(grn_id_str)
        if pb:
            for pi in pb.get("items", []):
                if pi.get("name") and pi.get("rate") is not None and float(pi.get("rate", 0)) > 0:
                    if pi["name"] not in rate_lookup:
                        rate_lookup[pi["name"]] = float(pi["rate"])

        # Prepare items with price auto-filled from rate lookup
        clean_items = []
        for gi in grn_items:
            clean_item = {k: v for k, v in gi.items()}
            # Add price from: 1) existing price on item  2) rate lookup
            if not clean_item.get("price") or float(clean_item.get("price", 0) or 0) == 0:
                clean_item["price"] = rate_lookup.get(gi.get("name"), 0)
            clean_items.append(clean_item)

        # Date serialization
        grn_date = grn.get("created_at")
        if hasattr(grn_date, 'isoformat'):
            grn_date = grn_date.isoformat()

        payables.append({
            "id": grn_id_str,
            "voucher_no": f"GRN-{grn_id_str[-6:].upper()}",
            "vendor": po.get("vendor_name"),
            "project": po.get("project_name"),
            "amount": balance, 
            "total_amount": total_value,
            "paid_amount": paid_amount,
            "invoice_no": invoice_no,
            "base_amount": base_amount_stored,
            "gst_percent": gst_percent,
            "date": grn_date,
            "status": status,
            "source": "GRN",
            "items": clean_items
        })
        
    return payables

@router.post("/expenses", dependencies=[Depends(RBACPermission("Accounts", "edit", "Payments"))])
async def create_expense(expense: ExpenseBase, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # CRITICAL-1: Prevent double payment on already-paid GRN
    if expense.grn_id and expense.mark_as_paid:
        existing_grn = await db.grns.find_one({"_id": ObjectId(expense.grn_id)})
        if existing_grn and existing_grn.get("status") == "Paid":
            raise HTTPException(status_code=400, detail="This GRN is already marked as Paid. Cannot process duplicate payment.")

    expense_dict = expense.dict()
    result = await db.expenses.insert_one(expense_dict)

    # HIGH-6 FIX: Only update project spent for NON-GRN expenses (general expenses, petty cash, etc.)
    # For GRN-linked expenses, spent was already updated when auto-bill was created in grns.py
    if expense.project and expense.project != "General" and not expense.grn_id:
        await db.projects.update_one(
            {"name": expense.project},
            {"$inc": {"spent": expense.amount}}
        )
    
    # If the partial/full payment came with updated item prices, update GRN + PO + Purchase Bill
    if expense.grn_id and expense.items:
        try:
            valid_items = [item for item in expense.items if isinstance(item, dict)]
            await db.grns.update_one(
                {"_id": ObjectId(expense.grn_id)},
                {"$set": {"items": valid_items, "total_amount": expense.total_amount}}
            )

            # Update linked PO with actual rates from accountant
            grn_doc = await db.grns.find_one({"_id": ObjectId(expense.grn_id)})
            if grn_doc and grn_doc.get("po_id") and ObjectId.is_valid(grn_doc["po_id"]):
                po_doc = await db.purchase_orders.find_one({"_id": ObjectId(grn_doc["po_id"])})
                if po_doc:
                    po_items = po_doc.get("items", [])
                    # Build price map from accountant's entry
                    price_map = {}
                    for ei in valid_items:
                        if ei.get("name") and ei.get("price") and float(ei.get("price", 0)) > 0:
                            price_map[ei["name"]] = float(ei["price"])
                    # Update PO items that have no rate
                    updated_po_items = []
                    po_total = 0
                    for pi in po_items:
                        pi_copy = dict(pi)
                        if (not pi_copy.get("rate") or float(pi_copy.get("rate", 0)) == 0) and pi_copy.get("name") in price_map:
                            pi_copy["rate"] = price_map[pi_copy["name"]]
                        rate = float(pi_copy.get("rate", 0) or 0)
                        qty = float(pi_copy.get("qty", 0) or 0)
                        po_total += qty * rate
                        updated_po_items.append(pi_copy)
                    await db.purchase_orders.update_one(
                        {"_id": ObjectId(grn_doc["po_id"])},
                        {"$set": {"items": updated_po_items, "total_amount": po_total}}
                    )

                    # Also update linked purchase bill
                    await db.purchase_bills.update_many(
                        {"grn_id": expense.grn_id},
                        {"$set": {"total_amount": expense.total_amount}}
                    )
                    # Update purchase bill items with rates
                    for pb_doc in await db.purchase_bills.find({"grn_id": expense.grn_id}).to_list(10):
                        pb_items = pb_doc.get("items", [])
                        for pbi in pb_items:
                            if pbi.get("name") in price_map and (not pbi.get("rate") or float(pbi.get("rate", 0)) == 0):
                                pbi["rate"] = price_map[pbi["name"]]
                                pbi["amount"] = float(pbi.get("qty", 0) or 0) * pbi["rate"]
                        pb_total = sum(float(i.get("amount", 0) or 0) for i in pb_items)
                        await db.purchase_bills.update_one(
                            {"_id": pb_doc["_id"]},
                            {"$set": {"items": pb_items, "total_amount": pb_total}}
                        )
        except Exception:
            pass
            
    # If this marks the payable as fully paid, update GRN + Purchase Bill status
    if expense.grn_id and expense.mark_as_paid:
        try:
            await db.grns.update_one(
                {"_id": ObjectId(expense.grn_id)},
                {"$set": {"status": "Paid"}}
            )
            # Also mark the linked purchase bill as Paid + update total with GST
            invoice_total = float(expense.base_amount or 0) + float(expense.gst_amount or 0)
            pb_update = {"status": "Paid", "paid_at": datetime.now().isoformat()}
            if invoice_total > 0:
                pb_update["total_amount"] = invoice_total
                pb_update["tax_amount"] = float(expense.gst_amount or 0)
            await db.purchase_bills.update_many(
                {"grn_id": expense.grn_id},
                {"$set": pb_update}
            )
            # Find project by name and trigger workflow
            if expense.project and expense.project != "General":
                project = await db.projects.find_one({"name": expense.project})
                if project:
                    await trigger_workflow_event(str(project["_id"]), "payment_settled", current_user, db, f"Payment settled for GRN-{expense.grn_id[-6:]}")
        except:
            pass
    elif expense.grn_id:
        # Partial payment — mark purchase bill as Partially Paid
        try:
            await db.purchase_bills.update_many(
                {"grn_id": expense.grn_id, "status": {"$ne": "Paid"}},
                {"$set": {"status": "Partially Paid"}}
            )
        except:
            pass
            
    # Notify stakeholders about payment
    try:
        sender = current_user.get("full_name") or current_user.get("username", "")
        recipients = ["Administrator"]
        if expense.project and expense.project != "General":
            stakeholders = await get_project_stakeholders(db, project_name=expense.project)
            if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
            recipients.append("Purchase Officer")
        if expense.mark_as_paid:
            await notify(db, sender, recipients, EVENT_FINANCE,
                "Payment Settled",
                f"Payment of Rs.{expense.amount:,.0f} for {expense.category or 'expense'} ({expense.project or 'General'}) fully settled by {sender}",
                entity_type="expense", entity_id=str(result.inserted_id), project_name=expense.project, priority="high")
        elif expense.grn_id:
            await notify(db, sender, recipients, EVENT_FINANCE,
                "Payment Recorded",
                f"Partial payment of Rs.{expense.amount:,.0f} recorded for {expense.project or 'General'} by {sender}",
                entity_type="expense", entity_id=str(result.inserted_id), project_name=expense.project)
    except Exception:
        pass

    expense_dict.pop("_id", None)
    return {"id": str(result.inserted_id), **expense_dict}

@router.get("/payables/{grn_id}/payments", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_voucher_payments(grn_id: str, db = Depends(get_database)):
    payments = await db.expenses.find({"grn_id": grn_id}).sort("date", -1).to_list(100)
    for p in payments:
        p["_id"] = str(p["_id"])
    return payments

# ── Client Billing (Income) ────────────────────────────────────────────────────

@router.get("/bills", dependencies=[Depends(RBACPermission("Accounts", "view", "Sales"))])
async def get_bills(db = Depends(get_database)):
    bills = await db.bills.find().to_list(500)
    result = []
    for b in bills:
        # Safely convert ObjectId
        b["id"] = str(b.pop("_id"))
        # Safely convert datetime objects to ISO strings
        for key, val in b.items():
            if hasattr(val, 'isoformat'):
                b[key] = val.isoformat()
        # Fallback for created_at
        if not b.get("created_at"):
            b["created_at"] = ""
        result.append(b)
    # Sort by created_at descending (string sort works for ISO format)
    result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return result

@router.post("/bills", dependencies=[Depends(RBACPermission("Accounts", "edit", "Sales"))])
async def create_bill(bill: BillCreate, db = Depends(get_database)):
    proj_clean = bill.project.strip()
    no_clean = bill.bill_no.strip()
    
    # ── Prevent duplicate bill numbers (Case-insensitive check) ─────────────
    existing = await db.bills.find_one({
        "project": {"$regex": f"^{re.escape(proj_clean)}$", "$options": "i"},
        "bill_no": {"$regex": f"^{re.escape(no_clean)}$", "$options": "i"}
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Bill No '{no_clean}' already exists for this project. Please use a unique number."
        )
    
    # Calculate GST
    gst_amount = round(bill.amount * bill.gst_rate / 100, 2)
    total_amount = round(bill.amount + gst_amount, 2)
    now_str = datetime.now().isoformat()

    # Build the document
    doc = {
        **bill.dict(),
        "project": proj_clean,
        "bill_no": no_clean,
        "created_at": now_str,
        "status": "Pending",
        "collection_amount": 0,
        "gst_amount": gst_amount,
        "total_amount": total_amount,
    }
    
    try:
        result = await db.bills.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None) # Remove ObjectId for JSON serialization

        # Notify PM/Admin about new client bill
        try:
            recipients = ["Administrator", "General Manager", "Project Manager"]
            stakeholders = await get_project_stakeholders(db, project_name=proj_clean)
            if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
            await notify(db, "Accountant", recipients, EVENT_FINANCE,
                "Client Bill Created",
                f"Bill #{no_clean} created for {proj_clean}. Amount: Rs.{total_amount:,.0f} (incl. GST Rs.{gst_amount:,.0f})",
                entity_type="bill", entity_id=str(result.inserted_id), project_name=proj_clean)
        except Exception:
            pass

        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/bills/{bill_id}", dependencies=[Depends(RBACPermission("Accounts", "delete"))])
async def delete_bill(bill_id: str, db = Depends(get_database)):
    oid = validate_object_id(bill_id, "bill")
    result = await db.bills.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"success": True, "message": "Bill deleted successfully"}

@router.put("/bills/{bill_id}/mark-paid", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def mark_bill_paid(bill_id: str, data: MarkPaidRequest, db = Depends(get_database)):
    oid = validate_object_id(bill_id, "bill")
    collection_amount = data.collection_amount
    bill = await db.bills.find_one({"_id": oid})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.get("status") == "Paid":
        raise HTTPException(status_code=400, detail="This bill is already fully paid")

    total = float(bill.get("total_amount", 0))
    current_collection = float(bill.get("collection_amount", 0))
    new_collection = current_collection + collection_amount

    # Prevent over-payment
    if new_collection > total * 1.01:  # 1% tolerance for rounding
        raise HTTPException(status_code=400, detail=f"Payment of {collection_amount} would exceed bill total. Remaining: {total - current_collection:.2f}")

    new_status = "Paid" if new_collection >= total else "Partially Paid"

    # Use atomic $inc to prevent race conditions
    await db.bills.update_one(
        {"_id": oid},
        {"$inc": {"collection_amount": collection_amount}, "$set": {"status": new_status}}
    )
    return {"success": True, "collection_amount": new_collection, "status": new_status}

# ── Receipts (Income) ─────────────────────────────────────────────────────────

@router.get("/receipts", dependencies=[Depends(RBACPermission("Accounts", "view", "Sales"))])
async def get_receipts(db = Depends(get_database)):
    receipts = await db.receipts.find().sort("date", -1).to_list(500)
    for r in receipts:
        r["id"] = str(r.pop("_id"))
    return receipts

@router.post("/receipts", dependencies=[Depends(RBACPermission("Accounts", "edit", "Sales"))])
async def create_receipt(receipt: ReceiptBase, db = Depends(get_database)):
    receipt_dict = receipt.dict()
    result = await db.receipts.insert_one(receipt_dict)

    # If linked to a bill, atomically update the bill's collection amount
    if receipt.bill_id:
        bill_oid = validate_object_id(receipt.bill_id, "bill")
        bill = await db.bills.find_one({"_id": bill_oid})
        if bill:
            total = float(bill.get("total_amount", 0))
            current = float(bill.get("collection_amount", 0))
            new_collection = current + receipt.amount
            new_status = "Paid" if new_collection >= total else "Partially Paid"

            await db.bills.update_one(
                {"_id": bill_oid},
                {"$inc": {"collection_amount": receipt.amount}, "$set": {"status": new_status}}
            )
            
    receipt_dict["id"] = str(result.inserted_id)
    return receipt_dict

# ── Purchase Bills ───────────────────────────────────────────────────────────

@router.get("/purchase-bills", dependencies=[Depends(RBACPermission("Accounts", "view", "PurchaseBills"))])
async def get_purchase_bills(db = Depends(get_database)):
    bills = await db.purchase_bills.find().sort("bill_date", -1).to_list(500)
    for b in bills:
        b["id"] = str(b.pop("_id"))
    return bills

@router.post("/purchase-bills", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def create_purchase_bill(bill: PurchaseBillCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # HIGH-4: Prevent duplicate purchase bills for same GRN
    if hasattr(bill, 'grn_id') and bill.grn_id:
        existing_bill = await db.purchase_bills.find_one({"grn_id": bill.grn_id})
        if existing_bill:
            raise HTTPException(status_code=400, detail=f"A purchase bill ({existing_bill.get('bill_no', 'N/A')}) already exists for this GRN. Edit the existing bill instead.")

    bill_dict = bill.dict()
    # Ensure numeric fields are properly typed
    bill_dict["total_amount"] = float(bill_dict.get("total_amount", 0) or 0)
    bill_dict["tax_amount"] = float(bill_dict.get("tax_amount", 0) or 0)
    for item in bill_dict.get("items", []):
        item["qty"] = float(item.get("qty", 0) or 0)
        item["rate"] = float(item.get("rate", 0) or 0)
        item["amount"] = float(item.get("amount", 0) or 0)
    bill_dict["created_at"] = datetime.now()
    bill_dict["status"] = "Unpaid"
    
    result = await db.purchase_bills.insert_one(bill_dict)
    
    # Update Project 'Spent' amount - but ONLY if this isn't an auto-generated bill from GRN
    # (auto-bills from GRN already update spent in grns.py)
    already_counted = False
    if hasattr(bill, 'grn_id') and bill.grn_id:
        grn_doc = await db.grns.find_one({"_id": ObjectId(bill.grn_id)}) if ObjectId.is_valid(bill.grn_id) else None
        if grn_doc:
            # Check if GRN auto-bill already incremented spent (has rates = already counted)
            existing_auto_bill = await db.purchase_bills.find_one({"grn_id": bill.grn_id, "auto_generated": True})
            if existing_auto_bill:
                already_counted = True

    project = await db.projects.find_one({"name": bill.project_name})
    if project and not already_counted:
        await db.projects.update_one(
            {"name": bill.project_name},
            {"$inc": {"spent": float(bill.total_amount)}}
        )
    if project:
        await trigger_workflow_event(str(project["_id"]), "accounts_entry", current_user, db, f"Purchase Bill entered: {bill.bill_no}")
        
    # Mark GRN as Billed if linked
    if bill.grn_id:
        try:
            await db.grns.update_one(
                {"_id": ObjectId(bill.grn_id)},
                {"$set": {"is_billed": True, "status": "Billed", "bill_id": str(result.inserted_id)}}
            )
        except Exception:
            pass
        
    return {
        "id": str(result.inserted_id),
        "bill_no": bill_dict.get("bill_no"),
        "vendor_name": bill_dict.get("vendor_name"),
        "project_name": bill_dict.get("project_name"),
        "bill_date": bill_dict.get("bill_date"),
        "total_amount": bill_dict.get("total_amount"),
        "tax_amount": bill_dict.get("tax_amount"),
        "items": bill_dict.get("items", []),
        "notes": bill_dict.get("notes", ""),
        "status": bill_dict.get("status"),
        "grn_id": bill_dict.get("grn_id"),
        "po_id": bill_dict.get("po_id"),
        "created_at": str(bill_dict.get("created_at", "")),
    }

@router.delete("/purchase-bills/{bill_id}", dependencies=[Depends(RBACPermission("Accounts", "delete"))])
async def delete_purchase_bill(bill_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Delete a purchase bill. Only Draft/Unpaid bills can be deleted."""
    oid = validate_object_id(bill_id, "purchase bill")
    bill = await db.purchase_bills.find_one({"_id": oid})
    if not bill:
        raise HTTPException(status_code=404, detail="Purchase bill not found")
    if bill.get("status") == "Paid":
        raise HTTPException(status_code=400, detail="Cannot delete a paid purchase bill")
    # Unmark linked GRN as billed
    if bill.get("grn_id"):
        try:
            await db.grns.update_one(
                {"_id": ObjectId(bill["grn_id"])},
                {"$set": {"is_billed": False, "status": "Received"}, "$unset": {"bill_id": ""}}
            )
        except Exception:
            pass
    await db.purchase_bills.delete_one({"_id": oid})
    from app.utils.logging import log_activity
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"], "Delete Purchase Bill", f"Purchase bill {bill.get('bill_no', bill_id[-6:])} deleted", "warning")
    return {"success": True, "message": "Purchase bill deleted"}

# ── Project Finance Summary ──────────────────────────────────────────────────

@router.get("/project-summary/{project_name}", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_project_finance_summary(project_name: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Return all finance data for a specific project: sales bills, purchase bills, expenses, receipts."""
    
    from urllib.parse import unquote
    project_name = unquote(project_name)
    
    # Sales Bills (Client Billing)
    sales_bills = await db.bills.find({"project": {"$regex": f"^{re.escape(project_name)}$", "$options": "i"}}).sort("created_at", -1).to_list(500)
    for b in sales_bills:
        b["id"] = str(b.pop("_id"))
        for k, v in b.items():
            if hasattr(v, 'isoformat'):
                b[k] = v.isoformat()

    # Receipts (Payments received from client)
    receipts = await db.receipts.find({"project": {"$regex": f"^{re.escape(project_name)}$", "$options": "i"}}).sort("date", -1).to_list(500)
    for r in receipts:
        r["id"] = str(r.pop("_id"))

    # Purchase Bills
    purchase_bills = await db.purchase_bills.find({"project_name": {"$regex": f"^{re.escape(project_name)}$", "$options": "i"}}).sort("bill_date", -1).to_list(500)
    for pb in purchase_bills:
        pb["id"] = str(pb.pop("_id"))
        for k, v in pb.items():
            if hasattr(v, 'isoformat'):
                pb[k] = v.isoformat()

    # Expenses
    expenses = await db.expenses.find({"project": {"$regex": f"^{re.escape(project_name)}$", "$options": "i"}}).sort("date", -1).to_list(500)
    for e in expenses:
        e["id"] = str(e.pop("_id"))
        for k, v in e.items():
            if hasattr(v, 'isoformat'):
                e[k] = v.isoformat()

    # Compute summary totals
    total_sales = sum(float(b.get("total_amount", 0)) for b in sales_bills)
    total_received = sum(float(b.get("collection_amount", 0)) for b in sales_bills)
    total_purchase = sum(float(pb.get("total_amount", 0)) for pb in purchase_bills)
    total_expenses = sum(float(e.get("amount", 0)) for e in expenses)
    total_receipts = sum(float(r.get("amount", 0)) for r in receipts)

    # Use the higher of collection_amount (from bills) or receipts total
    # to avoid double-counting (both track the same payments differently)
    actual_received = max(total_received, total_receipts)

    return {
        "sales_bills": sales_bills,
        "receipts": receipts,
        "purchase_bills": purchase_bills,
        "expenses": expenses,
        "summary": {
            "total_sales": total_sales,
            "total_received": actual_received,
            "total_purchase": total_purchase,
            "total_expenses": total_expenses,
            "gross_profit": total_sales - total_purchase - total_expenses,
            "outstanding": total_sales - actual_received
        }
    }
