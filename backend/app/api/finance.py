from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.finance import ExpenseBase
from database import get_database
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime
from app.utils.auth import get_current_user
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission

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
                # Try to get price directly from GRN item (if updated during payment)
                grn_price = gi.get("price")
                if grn_price is not None and str(grn_price).strip() != "":
                    try:
                        total_value += float(gi.get("received_qty", 0)) * float(grn_price)
                        continue
                    except ValueError:
                        pass

                # Fallback to PO item rate
                matching_po_item = next((pi for pi in po_items if pi["name"] == gi["name"]), None)
                if matching_po_item and matching_po_item.get("rate"):
                    total_value += float(gi.get("received_qty", 0)) * float(matching_po_item.get("rate", 0))
        
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

        # Prepare items for JSON serialization
        clean_items = []
        for gi in grn_items:
            clean_item = {k: v for k, v in gi.items()}
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
    expense_dict = expense.dict()
    result = await db.expenses.insert_one(expense_dict)
    
    # Update project spent amount
    if expense.project and expense.project != "General":
        await db.projects.update_one(
            {"name": expense.project},
            {"$inc": {"spent": expense.amount}}
        )
    
    # If the partial/full payment came with updated item prices, update them in the GRN
    if expense.grn_id and expense.items:
        try:
            await db.grns.update_one(
                {"_id": ObjectId(expense.grn_id)},
                {"$set": {"items": [item for item in expense.items if isinstance(item, dict)], "total_amount": expense.total_amount}}
            )
        except Exception as e:
            print("Failed to update GRN items:", e)
            
    # If this marks the payable as fully paid, update GRN status
    if expense.grn_id and expense.mark_as_paid:
        try:
            await db.grns.update_one(
                {"_id": ObjectId(expense.grn_id)},
                {"$set": {"status": "Paid"}}
            )
            # Find project by name and trigger workflow
            if expense.project and expense.project != "General":
                project = await db.projects.find_one({"name": expense.project})
                if project:
                    await trigger_workflow_event(str(project["_id"]), "payment_settled", current_user, db, f"Payment settled for GRN-{expense.grn_id[-6:]}")
        except:
            pass
            
    expense_dict.pop("_id", None)
    return {"id": str(result.inserted_id), **expense_dict}

@router.get("/payables/{grn_id}/payments")
async def get_voucher_payments(grn_id: str, db = Depends(get_database)):
    payments = await db.expenses.find({"grn_id": grn_id}).to_list(100)
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
    print(f"DEBUG: Creating bill for project: {bill.project}, bill_no: {bill.bill_no}")
    print(f"DEBUG: Payload: {bill.model_dump() if hasattr(bill, 'model_dump') else bill.dict()}")
    
    proj_clean = bill.project.strip()
    no_clean = bill.bill_no.strip()
    
    # ── Prevent duplicate bill numbers (Case-insensitive check) ─────────────
    existing = await db.bills.find_one({
        "project": {"$regex": f"^{proj_clean}$", "$options": "i"},
        "bill_no": {"$regex": f"^{no_clean}$", "$options": "i"}
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
        print(f"DEBUG: Bill inserted with ID: {doc['id']}")
        
        return doc
    except Exception as e:
        print(f"DEBUG: Error inserting bill: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, db = Depends(get_database)):
    result = await db.bills.delete_one({"_id": ObjectId(bill_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"success": True, "message": "Bill deleted successfully"}

@router.put("/bills/{bill_id}/mark-paid")
async def mark_bill_paid(bill_id: str, data: MarkPaidRequest, db = Depends(get_database)):
    collection_amount = data.collection_amount
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    new_collection = float(bill.get("collection_amount", 0)) + collection_amount
    total = float(bill.get("total_amount", 0))
    new_status = "Paid" if new_collection >= total else "Partially Paid"
    
    await db.bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {"collection_amount": new_collection, "status": new_status}}
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
    
    # If linked to a bill, update the bill's collection amount
    if receipt.bill_id:
        bill = await db.bills.find_one({"_id": ObjectId(receipt.bill_id)})
        if bill:
            new_collection = float(bill.get("collection_amount", 0)) + receipt.amount
            total = float(bill.get("total_amount", 0))
            new_status = "Paid" if new_collection >= total else "Partially Paid"
            
            await db.bills.update_one(
                {"_id": ObjectId(receipt.bill_id)},
                {"$set": {"collection_amount": new_collection, "status": new_status}}
            )
            
    receipt_dict["id"] = str(result.inserted_id)
    return receipt_dict

# ── Purchase Bills ───────────────────────────────────────────────────────────

@router.get("/purchase-bills")
async def get_purchase_bills(db = Depends(get_database)):
    bills = await db.purchase_bills.find().sort("bill_date", -1).to_list(500)
    for b in bills:
        b["id"] = str(b.pop("_id"))
    return bills

@router.post("/purchase-bills")
async def create_purchase_bill(bill: PurchaseBillCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    bill_dict = bill.dict()
    bill_dict["created_at"] = datetime.now()
    bill_dict["status"] = "Unpaid"
    
    result = await db.purchase_bills.insert_one(bill_dict)
    
    # Update Project 'Spent' amount
    project = await db.projects.find_one({"name": bill.project_name})
    if project:
        new_spent = float(project.get("spent", 0)) + float(bill.total_amount)
        await db.projects.update_one(
            {"name": bill.project_name},
            {"$set": {"spent": new_spent}}
        )
        await trigger_workflow_event(str(project["_id"]), "accounts_entry", current_user, db, f"Purchase Bill entered: {bill.bill_no}")
        
    # Mark GRN as Billed if linked
    if bill.grn_id:
        try:
            await db.grns.update_one(
                {"_id": ObjectId(bill.grn_id)},
                {"$set": {"is_billed": True, "bill_id": str(result.inserted_id)}}
            )
        except: pass
        
    bill_dict["id"] = str(result.inserted_id)
    return bill_dict

# ── Project Finance Summary ──────────────────────────────────────────────────

@router.get("/project-summary/{project_name}")
async def get_project_finance_summary(project_name: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Return all finance data for a specific project: sales bills, purchase bills, expenses, receipts."""
    
    from urllib.parse import unquote
    project_name = unquote(project_name)
    
    # Sales Bills (Client Billing)
    sales_bills = await db.bills.find({"project": {"$regex": f"^{project_name}$", "$options": "i"}}).sort("created_at", -1).to_list(500)
    for b in sales_bills:
        b["id"] = str(b.pop("_id"))
        for k, v in b.items():
            if hasattr(v, 'isoformat'):
                b[k] = v.isoformat()

    # Receipts (Payments received from client)
    receipts = await db.receipts.find({"project": {"$regex": f"^{project_name}$", "$options": "i"}}).sort("date", -1).to_list(500)
    for r in receipts:
        r["id"] = str(r.pop("_id"))

    # Purchase Bills
    purchase_bills = await db.purchase_bills.find({"project_name": {"$regex": f"^{project_name}$", "$options": "i"}}).sort("bill_date", -1).to_list(500)
    for pb in purchase_bills:
        pb["id"] = str(pb.pop("_id"))
        for k, v in pb.items():
            if hasattr(v, 'isoformat'):
                pb[k] = v.isoformat()

    # Expenses
    expenses = await db.expenses.find({"project": {"$regex": f"^{project_name}$", "$options": "i"}}).sort("date", -1).to_list(500)
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

    return {
        "sales_bills": sales_bills,
        "receipts": receipts,
        "purchase_bills": purchase_bills,
        "expenses": expenses,
        "summary": {
            "total_sales": total_sales,
            "total_received": max(total_received, total_receipts),
            "total_purchase": total_purchase,
            "total_expenses": total_expenses,
            "gross_profit": total_sales - total_purchase - total_expenses,
            "outstanding": total_sales - max(total_received, total_receipts)
        }
    }
