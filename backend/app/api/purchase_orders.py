from fastapi import APIRouter, HTTPException, status, Body, BackgroundTasks, Depends
from typing import List, Optional
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime
import re
from app.utils.email import send_email, generate_po_html
from app.utils.auth import get_current_user
from app.api.workflow import trigger_workflow_event
from app.utils.logging import log_activity
from app.utils.rbac import RBACPermission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_WORKFLOW, EVENT_APPROVAL
router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

class POItem(BaseModel):
    name: str
    qty: float
    unit: str
    rate: Optional[float] = None
    site_quantities: Optional[dict] = None
    vendor_name: Optional[str] = None  # Per-item vendor assignment for multi-vendor POs

class POCreate(BaseModel):
    vendor_name: str = ""  # Legacy single-vendor field; blank when multi-vendor
    project_name: str
    expected_delivery: str
    items: List[POItem]
    notes: str = ""
    status: str = "Pending"
    total_amount: Optional[float] = 0
    request_id: Optional[str] = None
    is_multi_vendor: bool = False  # True when items have individual vendor assignments

class POUpdate(BaseModel):
    vendor_name: str = ""
    project_name: str
    expected_delivery: str
    items: List[POItem]
    notes: str = ""
    admin_remarks: str = ""
    status: str = "Pending"
    total_amount: Optional[float] = 0
    request_id: Optional[str] = None
    is_multi_vendor: bool = False

def po_helper(po) -> dict:
    items = po.get("items", [])
    is_multi_vendor = po.get("is_multi_vendor", False)
    # Build list of unique vendors from items (for multi-vendor POs)
    vendor_names = list(dict.fromkeys(
        item.get("vendor_name") for item in items if item.get("vendor_name")
    ))
    # Fallback: use top-level vendor_name for legacy single-vendor POs
    display_vendor = po.get("vendor_name", "")
    if is_multi_vendor and vendor_names:
        display_vendor = ", ".join(vendor_names)
    return {
        "id": str(po["_id"]),
        "vendor_name": display_vendor,
        "project_name": po["project_name"],
        "expected_delivery": po["expected_delivery"],
        "items": items,
        "notes": po.get("notes", ""),
        "admin_remarks": po.get("admin_remarks", ""),
        "status": po.get("status", "Pending"),
        "total_amount": po.get("total_amount", 0),
        "request_id": po.get("request_id"),
        "created_at": po.get("created_at"),
        "is_multi_vendor": is_multi_vendor,
        "vendor_names": vendor_names if vendor_names else ([po.get("vendor_name", "")] if po.get("vendor_name") else [])
    }

@router.get("/", response_model=List[dict])
async def get_pos(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        query["project_name"] = {"$in": project_names}
        
    pos = await db.purchase_orders.find(query).to_list(100)
    return [po_helper(p) for p in pos]

@router.get("/{id}", dependencies=[Depends(RBACPermission("Procurement", "view"))])
async def get_po(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    po = await db.purchase_orders.find_one({"_id": ObjectId(id)})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    return po_helper(po)

@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Procurement", "edit"))])
async def create_po(po: POCreate, background_tasks: BackgroundTasks):
    # MEDIUM-6: Prevent duplicate POs from same material request
    if po.request_id and ObjectId.is_valid(po.request_id):
        existing_po = await db.purchase_orders.find_one({"request_id": po.request_id})
        if existing_po:
            raise HTTPException(status_code=400,
                detail=f"A Purchase Order already exists for this material request (PO for {existing_po.get('vendor_name', 'N/A')}). Edit the existing PO instead.")

    po_dict = po.model_dump()
    po_dict["created_at"] = datetime.now()

    # For multi-vendor POs, derive vendor_name summary from items
    if po.is_multi_vendor:
        item_vendors = list(dict.fromkeys(
            item.vendor_name for item in po.items if item.vendor_name
        ))
        if not item_vendors:
            raise HTTPException(status_code=400, detail="Multi-vendor PO requires at least one item with a vendor assigned")
        unassigned = [item.name for item in po.items if not item.vendor_name]
        if unassigned:
            raise HTTPException(status_code=400, detail=f"All items must have a vendor assigned in multi-vendor mode. Missing: {', '.join(unassigned)}")
        po_dict["vendor_name"] = ", ".join(item_vendors)

    result = await db.purchase_orders.insert_one(po_dict)

    # Update linked Material Request (Individual or Consolidated) status
    if po.request_id and ObjectId.is_valid(po.request_id):
        mr_result = await db.material_requests.update_one(
            {"_id": ObjectId(po.request_id)},
            {"$set": {"status": "PO Created", "po_id": str(result.inserted_id)}}
        )
        if mr_result.matched_count == 0:
            await db.consolidated_requests.update_one(
                {"_id": ObjectId(po.request_id)},
                {"$set": {"status": "PO Created", "po_id": str(result.inserted_id)}}
            )

    new_po = await db.purchase_orders.find_one({"_id": result.inserted_id})
    po_result = po_helper(new_po)
    vendor_display = po_result["vendor_name"]

    project = await db.projects.find_one({"name": po.project_name})
    if project:
        user = {"username": "System", "role": "Purchase Officer"}
        await trigger_workflow_event(str(project["_id"]), "po_created", user, db, f"PO generated for {vendor_display}")

    # Auto-send email to vendor(s) on PO creation
    try:
        if po.is_multi_vendor:
            # Multi-vendor: send separate email per vendor with only their items
            item_vendors = list(dict.fromkeys(
                item.vendor_name for item in po.items if item.vendor_name
            ))
            for vname in item_vendors:
                vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(vname.strip())}$", "$options": "i"}})
                if vendor and vendor.get("email"):
                    vendor_items = [it for it in po_result["items"] if it.get("vendor_name") == vname]
                    vendor_total = sum((it.get("qty", 0) or 0) * (it.get("rate", 0) or 0) for it in vendor_items)
                    vendor_po_data = {**po_result, "items": vendor_items, "total_amount": vendor_total, "vendor_name": vname}
                    vendor_data = {"name": vendor["name"], "email": vendor["email"]}
                    html_content = generate_po_html(vendor_po_data, vendor_data)
                    background_tasks.add_task(
                        send_email,
                        to_email=vendor["email"],
                        subject=f"Purchase Order: PO-{po_result['id'][-6:].upper()} - {po_result['project_name']}",
                        body=html_content,
                        is_html=True
                    )
        else:
            # Single-vendor: send one email
            vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(po.vendor_name.strip())}$", "$options": "i"}})
            if vendor and vendor.get("email"):
                vendor_data = {"name": vendor["name"], "email": vendor["email"]}
                html_content = generate_po_html(po_result, vendor_data)
                background_tasks.add_task(
                    send_email,
                    to_email=vendor["email"],
                    subject=f"Purchase Order: PO-{po_result['id'][-6:].upper()} - {po_result['project_name']}",
                    body=html_content,
                    is_html=True
                )
    except Exception:
        pass

    await log_activity(db, "system", "Purchase Officer", "Create PO", f"PO created for {vendor_display} | Project: {po.project_name}", "info")

    # Notify GM + stakeholders about new PO
    try:
        recipients = ["General Manager", "Administrator"]
        stakeholders = await get_project_stakeholders(db, project_name=po.project_name)
        if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
        if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
        po_id_short = str(result.inserted_id)[-6:].upper()
        await notify(db, "Purchase Officer", recipients, EVENT_WORKFLOW,
            "New Purchase Order",
            f"PO-{po_id_short} created for {vendor_display} | Project: {po.project_name} | Amount: Rs.{po.total_amount:,.0f}. Awaiting approval.",
            entity_type="po", entity_id=str(result.inserted_id), project_name=po.project_name, priority="high")
    except Exception:
        pass

    return po_result

@router.put("/{id}", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
@router.put("/{id}/", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
async def update_po(id: str, po_data: dict = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    # Extract only valid fields to avoid injecting unexpected data
    valid_fields = ["vendor_name", "project_name", "expected_delivery", "items", "notes", "admin_remarks", "status", "total_amount", "is_multi_vendor"]
    update_data = {k: v for k, v in po_data.items() if k in valid_fields}

    # Recalculate vendor_name when multi-vendor items are updated
    is_multi = update_data.get("is_multi_vendor", po_data.get("is_multi_vendor", False))
    if is_multi and "items" in update_data:
        item_vendors = list(dict.fromkeys(
            item.get("vendor_name") for item in update_data["items"] if item.get("vendor_name")
        ))
        update_data["vendor_name"] = ", ".join(item_vendors) if item_vendors else ""

    await db.purchase_orders.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    updated_po = await db.purchase_orders.find_one({"_id": ObjectId(id)})
    if not updated_po:
         raise HTTPException(status_code=404, detail="PO not found after update")
         
    if po_data.get("status") == "Dispatched":
        project = await db.projects.find_one({"name": updated_po["project_name"]})
        if project:
            user = {"username": "Vendor", "role": "Vendor"}
            await trigger_workflow_event(str(project["_id"]), "vendor_dispatched", user, db, "Materials dispatched by vendor")
         
    return po_helper(updated_po)

@router.put("/{id}/approve", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
@router.put("/{id}/approve/", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
async def approve_po(id: str, current_user: dict = Depends(get_current_user)):
    # Only Super Admin, Administrator, General Manager, or Manager can approve POs
    allowed_roles = ["super admin", "administrator", "general manager", "manager"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only General Manager or Super Admin can approve Purchase Orders")
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    po = await db.purchase_orders.find_one({"_id": ObjectId(id)})
    await db.purchase_orders.update_one({"_id": ObjectId(id)}, {"$set": {"status": "Approved"}})
    await log_activity(
        db,
        str(current_user.get("_id", current_user["username"])),
        current_user["username"],
        "Approve PO",
        f"Purchase Order for {po.get('vendor_name')} approved for {po.get('project_name')}",
        "success"
    )

    # Notify PO creator + stakeholders that PO is approved
    try:
        approver = current_user.get("full_name") or current_user.get("username", "")
        recipients = ["Purchase Officer"]
        stakeholders = await get_project_stakeholders(db, project_name=po.get("project_name"))
        if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
        if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
        await notify(db, approver, recipients, EVENT_APPROVAL,
            "PO Approved",
            f"PO for {po.get('vendor_name', '')} ({po.get('project_name', '')}) has been approved by {approver}. Vendor has been notified.",
            entity_type="po", entity_id=id, project_name=po.get("project_name"), priority="high")
    except Exception:
        pass

    return {"message": "PO Approved"}

@router.post("/{id}/send-email", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
@router.post("/{id}/send-email/", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
async def send_po_email(id: str, background_tasks: BackgroundTasks):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    po = await db.purchase_orders.find_one({"_id": ObjectId(id)})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    po_data = po_helper(po)
    sent_to = []

    if po.get("is_multi_vendor"):
        # Multi-vendor: send separate emails per vendor with only their items
        vendor_names = list(dict.fromkeys(
            item.get("vendor_name") for item in po.get("items", []) if item.get("vendor_name")
        ))
        if not vendor_names:
            raise HTTPException(status_code=400, detail="No vendor assignments found on items.")

        for vname in vendor_names:
            vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(vname.strip())}$", "$options": "i"}})
            if not vendor:
                vendor = await db.vendors.find_one({"name": {"$regex": vname.strip().replace(' ', '.*'), "$options": "i"}})
            if vendor and vendor.get("email"):
                vendor_items = [it for it in po_data["items"] if it.get("vendor_name") == vname]
                vendor_total = sum((it.get("qty", 0) or 0) * (it.get("rate", 0) or 0) for it in vendor_items)
                vendor_po_data = {**po_data, "items": vendor_items, "total_amount": vendor_total, "vendor_name": vname}
                vendor_data = {"name": vendor["name"], "email": vendor["email"]}
                html_content = generate_po_html(vendor_po_data, vendor_data)
                background_tasks.add_task(
                    send_email,
                    to_email=vendor["email"],
                    subject=f"Purchase Order: PO-{po_data['id'][-6:].upper()} - {po_data['project_name']}",
                    body=html_content,
                    is_html=True
                )
                sent_to.append(vendor["email"])

        if not sent_to:
            raise HTTPException(status_code=400, detail="No vendor emails found for the assigned vendors.")
        return {"message": f"PO emails are being sent to {', '.join(sent_to)}"}
    else:
        # Single-vendor PO
        vendor_name = po.get("vendor_name", "").strip()
        vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(vendor_name)}$", "$options": "i"}})
        if not vendor:
            vendor = await db.vendors.find_one({"name": {"$regex": vendor_name.replace(' ', '.*'), "$options": "i"}})
        if not vendor or not vendor.get("email"):
            raise HTTPException(status_code=400, detail=f"Vendor '{po.get('vendor_name')}' not found or doesn't have an email address.")

        vendor_data = {"name": vendor["name"], "email": vendor["email"]}
        html_content = generate_po_html(po_data, vendor_data)
        background_tasks.add_task(
            send_email,
            to_email=vendor["email"],
            subject=f"Purchase Order: PO-{po_data['id'][-6:].upper()} - {po_data['project_name']}",
            body=html_content,
            is_html=True
        )
        return {"message": f"PO email is being sent to {vendor['email']}"}
