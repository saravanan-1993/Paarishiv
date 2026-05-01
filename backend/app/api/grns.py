from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from app.utils.auth import get_current_user, validate_object_id
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_WORKFLOW
from app.utils.logging import log_activity

router = APIRouter(prefix="/grns", tags=["grns"])

class GRNItem(BaseModel):
    name: str
    po_qty: float
    received_qty: float
    rejected_qty: float
    unit: str
    remarks: str = ""

class GRNCreate(BaseModel):
    po_id: str
    vehicle_number: str = ""
    invoice_number: str = ""
    receipt_type: str = "Partial" # "Partial" or "Final"
    items: List[GRNItem]

def grn_helper(grn) -> dict:
    return {
        "id": str(grn["_id"]),
        "po_id": grn["po_id"],
        "vehicle_number": grn.get("vehicle_number", ""),
        "invoice_number": grn.get("invoice_number", ""),
        "receipt_type": grn.get("receipt_type", "Partial"),
        "items": grn["items"],
        "status": grn.get("status", "Received"),
        "is_billed": grn.get("is_billed", False),
        "vendor_name": grn.get("vendor_name", ""),
        "project_name": grn.get("project_name", ""),
        "created_at": grn.get("created_at")
    }

@router.get("/", response_model=List[dict])
async def get_grns(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        
        pos = await db.purchase_orders.find({"project_name": {"$in": project_names}}).to_list(100)
        po_ids = [str(po["_id"]) for po in pos]
        
        query["po_id"] = {"$in": po_ids}

    grns = await db.grns.find(query).sort("created_at", -1).to_list(100)
    
    # Enrich with PO details + rates
    enriched_grns = []
    for g in grns:
        helper_g = grn_helper(g)
        try:
            if ObjectId.is_valid(g["po_id"]):
                po = await db.purchase_orders.find_one({"_id": ObjectId(g["po_id"])})
                if po:
                    helper_g["vendor_name"] = po.get("vendor_name", "Unknown Vendor")
                    helper_g["project_name"] = po.get("project_name", "Unknown Project")
                    helper_g["total_amount"] = po.get("total_amount", 0)

                    # Only use rates from THIS linked PO (no global fallback)
                    po_rate_map = {}
                    for pit in po.get("items", []):
                        if pit.get("name") and pit.get("rate") is not None and float(pit.get("rate", 0)) > 0:
                            po_rate_map[pit["name"]] = float(pit["rate"])
                    helper_g["po_rates"] = po_rate_map
        except Exception as e:
            pass
        enriched_grns.append(helper_g)

    return enriched_grns

@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Procurement", "edit", "GRN"))])
async def create_grn(grn: GRNCreate, current_user: dict = Depends(get_current_user)):
    # CRITICAL-3: Calculate net received qty (received - rejected)
    for item in grn.items:
        if item.rejected_qty < 0:
            raise HTTPException(status_code=400, detail=f"Rejected quantity for '{item.name}' cannot be negative")
        if item.received_qty < 0:
            raise HTTPException(status_code=400, detail=f"Received quantity for '{item.name}' cannot be negative")

    grn_dict = grn.model_dump()
    grn_dict["created_at"] = datetime.now()

    # Fetch PO to get project name and validate quantities
    project_name = "Unknown"
    po = None
    if ObjectId.is_valid(grn.po_id):
        po = await db.purchase_orders.find_one({"_id": ObjectId(grn.po_id)})
        if po:
            project_name = po.get("project_name", "Unknown")

    # CRITICAL-2: Check cumulative received qty doesn't exceed PO qty
    if po:
        # Get all existing GRNs for this PO
        existing_grns = await db.grns.find({"po_id": grn.po_id}).to_list(100)
        po_item_map = {item.get("name"): float(item.get("qty", 0)) for item in po.get("items", [])}

        # Sum previously received quantities
        prev_received = {}
        for eg in existing_grns:
            for ei in eg.get("items", []):
                name = ei.get("name", "")
                prev_received[name] = prev_received.get(name, 0) + float(ei.get("received_qty", 0))

        # Validate new GRN won't exceed PO
        for item in grn.items:
            po_qty = po_item_map.get(item.name, 0)
            if po_qty > 0:
                total_after = prev_received.get(item.name, 0) + item.received_qty
                if total_after > po_qty * 1.1:  # Allow 10% tolerance for measurement differences
                    raise HTTPException(status_code=400,
                        detail=f"Over-receiving: '{item.name}' - PO qty: {po_qty}, already received: {prev_received.get(item.name, 0)}, this GRN: {item.received_qty}")

    result = await db.grns.insert_one(grn_dict)

    # CRITICAL-2: Calculate PO status based on cumulative received vs PO qty
    if po and ObjectId.is_valid(grn.po_id):
        try:
            all_grns = await db.grns.find({"po_id": grn.po_id}).to_list(100)
            total_received_all = {}
            for g in all_grns:
                for gi in g.get("items", []):
                    name = gi.get("name", "")
                    total_received_all[name] = total_received_all.get(name, 0) + float(gi.get("received_qty", 0))

            po_item_map = {item.get("name"): float(item.get("qty", 0)) for item in po.get("items", [])}

            # Check if all PO items are fully received
            all_received = True
            any_received = False
            for name, po_qty in po_item_map.items():
                received = total_received_all.get(name, 0)
                if received > 0:
                    any_received = True
                if received < po_qty:
                    all_received = False

            if all_received and any_received:
                po_status = "Completed"
            elif any_received:
                po_status = "Partially Received"
            else:
                po_status = "Pending"

            await db.purchase_orders.update_one(
                {"_id": ObjectId(grn.po_id)},
                {"$set": {"status": po_status}}
            )

            project = await db.projects.find_one({"name": project_name})
            if project:
                await trigger_workflow_event(str(project["_id"]), "grn_updated", current_user, db, f"GRN recorded for PO-{grn.po_id[-6:]}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"PO status update error: {e}")

    # Update Inventory Stock (CRITICAL-3: use net qty = received - rejected)
    # Check if this PO's vendor is "Warehouse" (internal stock issue)
    is_warehouse_vendor = po and (po.get("vendor_name", "") or "").strip().lower() == "warehouse"
    # For multi-vendor POs, check per-item vendor
    po_items_map = {}
    if po:
        for pit in po.get("items", []):
            po_items_map[pit.get("name", "")] = pit

    grn_ref = f"GRN-{str(result.inserted_id)[-6:].upper()}"

    for item in grn.items:
        net_qty = item.received_qty - item.rejected_qty
        if net_qty <= 0:
            continue

        # Check if THIS item's vendor is Warehouse (multi-vendor PO)
        po_item = po_items_map.get(item.name, {})
        item_vendor = (po_item.get("vendor_name") or "").strip().lower()
        is_wh_item = is_warehouse_vendor or item_vendor == "warehouse"

        if is_wh_item:
            # Warehouse vendor: DEDUCT from warehouse, ADD to site
            await db.warehouse_inventory.update_one(
                {"material_name": item.name, "stock": {"$gte": net_qty}},
                {"$inc": {"stock": -net_qty}}
            )
            await db.inventory.update_one(
                {"project_name": project_name, "material_name": item.name},
                {"$inc": {"stock": net_qty}, "$set": {"unit": item.unit}},
                upsert=True
            )
            now = datetime.now()
            await db.stock_ledger.insert_one({
                "date": now, "material_name": item.name, "project_name": "Warehouse",
                "type": "Warehouse Issue", "ref": grn_ref, "in_qty": 0, "out_qty": net_qty, "created_at": now
            })
            await db.stock_ledger.insert_one({
                "date": now, "material_name": item.name, "project_name": project_name,
                "type": "GRN (Direct)", "ref": grn_ref, "in_qty": net_qty, "out_qty": 0, "created_at": now
            })
        else:
            # External vendor: check stock handling type
            material = await db.materials.find_one({"name": item.name})
            handling_type = "Direct Site"
            if material:
                handling_type = material.get("stock_handling_type") or material.get("tracking_type") or "Direct Site"
                if handling_type == "Direct": handling_type = "Direct Site"
                if handling_type == "Warehouse": handling_type = "Warehouse Controlled"

            if handling_type == "Warehouse Controlled":
                await db.warehouse_inventory.update_one(
                    {"material_name": item.name},
                    {"$inc": {"stock": net_qty}, "$set": {"unit": item.unit}},
                    upsert=True
                )
                await db.stock_ledger.insert_one({
                    "date": datetime.now(), "material_name": item.name, "project_name": "Warehouse",
                    "type": "GRN", "ref": grn_ref, "in_qty": net_qty, "out_qty": 0, "created_at": datetime.now()
                })
            else:
                await db.inventory.update_one(
                    {"project_name": project_name, "material_name": item.name},
                    {"$inc": {"stock": net_qty}, "$set": {"unit": item.unit}},
                    upsert=True
                )
                await db.stock_ledger.insert_one({
                    "date": datetime.now(), "material_name": item.name, "project_name": project_name,
                    "type": "GRN (Direct)", "ref": grn_ref, "in_qty": net_qty, "out_qty": 0, "created_at": datetime.now()
                })

    # ── Auto-create Purchase Bill if PO has rate data (Purchase Officer filled) ──
    try:
        if ObjectId.is_valid(grn.po_id):
            po = await db.purchase_orders.find_one({"_id": ObjectId(grn.po_id)})
            if po:
                po_items = po.get("items", [])
                # Build item→rate lookup from PO
                rate_map = {}
                for pit in po_items:
                    if pit.get("name") and pit.get("rate"):
                        rate_map[pit["name"]] = float(pit["rate"])

                has_rates = len(rate_map) > 0

                # Build purchase bill items from GRN net qty (received - rejected) + PO rates
                bill_items = []
                bill_total = 0
                for item in grn.items:
                    item_net = item.received_qty - item.rejected_qty
                    if item_net <= 0:
                        continue
                    rate = rate_map.get(item.name, 0)
                    amount = item_net * rate
                    bill_items.append({
                        "name": item.name,
                        "qty": item_net,
                        "unit": item.unit,
                        "rate": rate,
                        "gst": 0,
                        "amount": amount,
                    })
                    bill_total += amount

                if bill_items:
                    # Generate bill number
                    counter = await db.counters.find_one_and_update(
                        {"_id": "purchase_bill"},
                        {"$inc": {"seq": 1}},
                        upsert=True,
                        return_document=True,
                    )
                    seq = (counter or {}).get("seq", 1)
                    bill_no = f"PB-{seq:05d}"

                    vendor_name = po.get("vendor_name", "")
                    proj_name = po.get("project_name", project_name)

                    bill_doc = {
                        "grn_id": str(result.inserted_id),
                        "po_id": grn.po_id,
                        "bill_no": bill_no,
                        "bill_date": datetime.now().strftime("%Y-%m-%d"),
                        "vendor_name": vendor_name,
                        "project_name": proj_name,
                        "items": bill_items,
                        "total_amount": bill_total,
                        "tax_amount": 0,
                        "notes": f"Auto-generated from GRN-{str(result.inserted_id)[-6:].upper()}",
                        "created_at": datetime.now(),
                        "status": "Unpaid" if has_rates else "Draft",
                        "auto_generated": True,
                        "has_rates": has_rates,
                    }
                    bill_result = await db.purchase_bills.insert_one(bill_doc)

                    # Mark GRN as billed
                    await db.grns.update_one(
                        {"_id": result.inserted_id},
                        {"$set": {"is_billed": True, "status": "Billed", "bill_id": str(bill_result.inserted_id)}}
                    )

                    # If PO had rates, update project spent
                    if has_rates and bill_total > 0:
                        project = await db.projects.find_one({"name": proj_name})
                        if project:
                            await db.projects.update_one(
                                {"name": proj_name},
                                {"$inc": {"spent": bill_total}}
                            )
    except Exception as e:
        # Don't fail GRN creation if auto-bill fails
        import logging
        logging.getLogger(__name__).warning("Auto purchase bill creation failed: %s", e)

    # Notify stakeholders about GRN creation
    try:
        sender = current_user.get("full_name") or current_user.get("username", "")
        recipients = ["Accountant", "Administrator"]
        stakeholders = await get_project_stakeholders(db, project_name=project_name)
        if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
        if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
        recipients.append("Purchase Officer")
        grn_ref = str(result.inserted_id)[-6:].upper()
        vendor_name = ""
        if ObjectId.is_valid(grn.po_id):
            po_doc = await db.purchase_orders.find_one({"_id": ObjectId(grn.po_id)})
            if po_doc: vendor_name = po_doc.get("vendor_name", "")
        await notify(db, sender, recipients, EVENT_WORKFLOW,
            "GRN Created",
            f"GRN-{grn_ref} recorded for {project_name} from {vendor_name}. {len(grn.items)} items received. Purchase bill auto-created.",
            entity_type="grn", entity_id=str(result.inserted_id), project_name=project_name, priority="high")
    except Exception:
        pass

    new_grn = await db.grns.find_one({"_id": result.inserted_id})
    return grn_helper(new_grn)

@router.put("/{id}", dependencies=[Depends(RBACPermission("Procurement", "edit", "GRN"))])
async def update_grn(id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update GRN metadata. Items cannot be changed after billing."""
    oid = validate_object_id(id, "GRN")
    grn = await db.grns.find_one({"_id": oid})
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    # MEDIUM-4: Prevent item edits on billed GRNs
    if grn.get("is_billed") and "items" in data:
        raise HTTPException(status_code=400, detail="Cannot modify items on a billed GRN. Edit the purchase bill instead.")
    if grn.get("status") == "Paid" and "status" in data:
        raise HTTPException(status_code=400, detail="Cannot change status of a paid GRN.")
    valid_fields = ["vehicle_number", "invoice_number", "receipt_type"]
    if not grn.get("is_billed"):
        valid_fields.append("items")
    update_data = {k: v for k, v in data.items() if k in valid_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.grns.update_one({"_id": oid}, {"$set": update_data})
    updated = await db.grns.find_one({"_id": oid})
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"], "Update GRN", f"GRN {id[-6:]} updated", "info")
    return grn_helper(updated)

@router.delete("/{id}", dependencies=[Depends(RBACPermission("Procurement", "delete"))])
async def delete_grn(id: str, current_user: dict = Depends(get_current_user)):
    """Delete/void a GRN. Reverses inventory and ledger entries."""
    oid = validate_object_id(id, "GRN")
    grn = await db.grns.find_one({"_id": oid})
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    if grn.get("is_billed"):
        raise HTTPException(status_code=400, detail="Cannot delete a billed GRN. Void the purchase bill first.")

    # MEDIUM-5: Reverse inventory updates
    po = None
    if ObjectId.is_valid(grn.get("po_id", "")):
        po = await db.purchase_orders.find_one({"_id": ObjectId(grn["po_id"])})
    project_name = po.get("project_name", "Unknown") if po else grn.get("project_name", "Unknown")

    for item in grn.get("items", []):
        received = float(item.get("received_qty", 0))
        rejected = float(item.get("rejected_qty", 0))
        net_qty = received - rejected
        if net_qty <= 0:
            continue

        material = await db.materials.find_one({"name": item.get("name")})
        handling_type = "Direct Site"
        if material:
            handling_type = material.get("stock_handling_type") or material.get("tracking_type") or "Direct Site"
            if handling_type == "Warehouse": handling_type = "Warehouse Controlled"

        if handling_type == "Warehouse Controlled":
            await db.warehouse_inventory.update_one(
                {"material_name": item["name"], "stock": {"$gte": net_qty}},
                {"$inc": {"stock": -net_qty}}
            )
        else:
            await db.inventory.update_one(
                {"project_name": project_name, "material_name": item["name"], "stock": {"$gte": net_qty}},
                {"$inc": {"stock": -net_qty}}
            )

    # Remove related stock ledger entries
    grn_ref = f"GRN-{str(oid)[-6:].upper()}"
    await db.stock_ledger.delete_many({"ref": grn_ref})

    await db.grns.delete_one({"_id": oid})
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"], "Delete GRN", f"GRN {id[-6:]} deleted with inventory reversal", "warning")
    return {"success": True, "message": "GRN deleted and inventory reversed"}
