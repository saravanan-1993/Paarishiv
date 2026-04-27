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

class POCreate(BaseModel):
    vendor_name: str
    project_name: str
    expected_delivery: str
    items: List[POItem]
    notes: str = ""
    status: str = "Pending"
    total_amount: Optional[float] = 0
    request_id: Optional[str] = None

class POUpdate(BaseModel):
    vendor_name: str
    project_name: str
    expected_delivery: str
    items: List[POItem]
    notes: str = ""
    admin_remarks: str = ""
    status: str = "Pending"
    total_amount: Optional[float] = 0
    request_id: Optional[str] = None

def po_helper(po) -> dict:
    return {
        "id": str(po["_id"]),
        "vendor_name": po["vendor_name"],
        "project_name": po["project_name"],
        "expected_delivery": po["expected_delivery"],
        "items": po["items"],
        "notes": po.get("notes", ""),
        "admin_remarks": po.get("admin_remarks", ""),
        "status": po.get("status", "Pending"),
        "total_amount": po.get("total_amount", 0),
        "request_id": po.get("request_id"),
        "created_at": po.get("created_at")
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
    project = await db.projects.find_one({"name": po.project_name})
    if project:
        user = {"username": "System", "role": "Purchase Officer"}
        await trigger_workflow_event(str(project["_id"]), "po_created", user, db, f"PO generated for {po.vendor_name}")

    # Bug 6.1 - Auto-send email to vendor on PO creation
    try:
        vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(po.vendor_name.strip())}$", "$options": "i"}})
        if vendor and vendor.get("email"):
            po_data = po_helper(new_po)
            vendor_data = {"name": vendor["name"], "email": vendor["email"]}
            html_content = generate_po_html(po_data, vendor_data)
            background_tasks.add_task(
                send_email,
                to_email=vendor["email"],
                subject=f"Purchase Order: PO-{po_data['id'][-6:].upper()} - {po_data['project_name']}",
                body=html_content,
                is_html=True
            )
    except Exception as e:
        pass

    await log_activity(db, "system", "Purchase Officer", "Create PO", f"PO created for {po.vendor_name} | Project: {po.project_name}", "info")

    # Notify GM + stakeholders about new PO
    try:
        recipients = ["General Manager", "Administrator"]
        stakeholders = await get_project_stakeholders(db, project_name=po.project_name)
        if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
        if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
        po_id_short = str(result.inserted_id)[-6:].upper()
        await notify(db, "Purchase Officer", recipients, EVENT_WORKFLOW,
            "New Purchase Order",
            f"PO-{po_id_short} created for {po.vendor_name} | Project: {po.project_name} | Amount: Rs.{po.total_amount:,.0f}. Awaiting approval.",
            entity_type="po", entity_id=str(result.inserted_id), project_name=po.project_name, priority="high")
    except Exception:
        pass

    return po_helper(new_po)

@router.put("/{id}", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
@router.put("/{id}/", dependencies=[Depends(RBACPermission("Procurement", "edit"))])
async def update_po(id: str, po_data: dict = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    # Extract only valid fields to avoid injecting unexpected data
    valid_fields = ["vendor_name", "project_name", "expected_delivery", "items", "notes", "admin_remarks", "status", "total_amount"]
    update_data = {k: v for k, v in po_data.items() if k in valid_fields}
    
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
    
    # Fetch PO
    po = await db.purchase_orders.find_one({"_id": ObjectId(id)})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Fetch Vendor to get email
    # Use regex for flexible matching (ignore case and trailing/leading spaces)
    vendor_name = po["vendor_name"].strip()
    vendor = await db.vendors.find_one({"name": {"$regex": f"^{re.escape(vendor_name)}$", "$options": "i"}})
    
    if not vendor:
        # Try a more aggressive search if exact match fails
        vendor = await db.vendors.find_one({"name": {"$regex": vendor_name.replace(" ", ".*"), "$options": "i"}})
    
    if not vendor or not vendor.get("email"):
        raise HTTPException(
            status_code=400, 
            detail=f"Vendor '{po['vendor_name']}' not found or doesn't have an email address."
        )
    
    # Prepare data for helper
    po_data = po_helper(po)
    vendor_data = {
        "name": vendor["name"],
        "email": vendor["email"]
    }
    
    # Generate HTML content
    html_content = generate_po_html(po_data, vendor_data)
    
    # Send email in background
    background_tasks.add_task(
        send_email, 
        to_email=vendor["email"], 
        subject=f"Purchase Order: PO-{po_data['id'][-6:].upper()} - {po_data['project_name']}",
        body=html_content,
        is_html=True
    )
    
    return {"message": f"PO email is being sent to {vendor['email']}"}
