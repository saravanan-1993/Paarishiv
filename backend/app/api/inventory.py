from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from database import get_database
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from app.utils.auth import get_current_user, validate_object_id
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission, role_in, require_sub_tab, has_sub_tab_access, has_module_action, fetch_role_doc, is_admin_role, get_assigned_project_names, is_assignment_scoped, get_users_with_permission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_MATERIAL, EVENT_WORKFLOW

router = APIRouter(prefix="/inventory", tags=["inventory"])

class MaterialRequestCreate(BaseModel):
    project_id: str = ""
    project_name: str
    engineer_id: str = ""
    requested_items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]
    priority: str = "Medium"
    required_by_date: Optional[str] = ""
    coordinator_remarks: Optional[str] = ""
    source: Optional[str] = ""
    warehouse_issue: Optional[bool] = False
    parent_request_id: Optional[str] = ""

class StockIssue(BaseModel):
    issued_items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]

class StockSettlementCreate(BaseModel):
    request_id: str
    items: List[dict] # [{"name": "Switch", "issued": 50, "used": 40, "remaining": 10, "action": "Return"}]

class MaterialTransferRequest(BaseModel):
    from_project: str
    to_project: str
    items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]
    notes: Optional[str] = ""

@router.get("/warehouse", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def get_warehouse_inventory(db = Depends(get_database)):
    inventory = await db.warehouse_inventory.find().to_list(1000)
    wh_names = {item["material_name"] for item in inventory}

    # Also include Warehouse Controlled materials with 0 stock
    materials = await db.materials.find().to_list(500)
    result = [
        {
            "id": str(item["_id"]),
            "material_name": item["material_name"],
            "unit": item.get("unit", "Nos"),
            "stock": item.get("stock", 0)
        }
        for item in inventory
    ]
    for mat in materials:
        sht = mat.get("stock_handling_type") or mat.get("tracking_type") or "Direct Site"
        if sht in ("Warehouse Controlled", "Warehouse") and mat.get("name") not in wh_names:
            result.append({
                "id": str(mat["_id"]),
                "material_name": mat["name"],
                "unit": mat.get("unit", "Nos"),
                "stock": 0
            })
    return result

@router.post("/requests")
async def create_material_request(request: MaterialRequestCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Permission gate — submitting a material request is semantically an "add"
    # action (creating a new request). Allow it for anyone with Projects add OR
    # edit (site team), or Inventory Management add OR edit (warehouse staff
    # creating on behalf). Admin-class always passes.
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    can_submit = (
        is_admin_role(current_user.get("role"))
        or await has_module_action(db, current_user, "Projects", "add", role_doc=role_doc)
        or await has_module_action(db, current_user, "Projects", "edit", role_doc=role_doc)
        or await has_module_action(db, current_user, "Inventory Management", "add", role_doc=role_doc)
        or await has_module_action(db, current_user, "Inventory Management", "edit", role_doc=role_doc)
    )
    if not can_submit:
        raise HTTPException(status_code=403, detail="You need Projects or Inventory Management add/edit access to submit a material request.")

    # MEDIUM-3: Validate item quantities
    for item in request.requested_items:
        qty = float(item.get("quantity", 0))
        if qty <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity for '{item.get('name', 'item')}' must be greater than 0")
        if not item.get("name", "").strip():
            raise HTTPException(status_code=400, detail="Item name cannot be empty")

    request_dict = request.dict()
    request_dict["status"] = "Pending"
    request_dict["created_at"] = datetime.now()
    request_dict["issued_items"] = []

    result = await db.material_requests.insert_one(request_dict)

    # Trigger workflow
    if request.project_id:
        await trigger_workflow_event(request.project_id, "material_consolidated", current_user, db, f"Material Request created for {len(request.requested_items)} items")

    # Notify Coordinator + Admin about new material request
    try:
        recipients = await get_users_with_permission(db, "Inventory Management", "edit")
        stakeholders = await get_project_stakeholders(db, project_id=request.project_id, project_name=request.project_name)
        if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
        sender = current_user.get("full_name") or current_user.get("username", "")
        await notify(db, sender, recipients, EVENT_MATERIAL,
            "New Material Request",
            f"Material request for {request.project_name} - {len(request.requested_items)} items requested by {sender}",
            entity_type="material_request", entity_id=str(result.inserted_id), project_name=request.project_name)
    except Exception:
        pass

    return {"id": str(result.inserted_id), "success": True}

@router.get("/requests", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def get_material_requests(project_name: Optional[str] = None, status: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    
    if status:
        query["status"] = status
    
    # Dynamic scoping — no role-name strings.
    # Admin-class users + cross-project specialists (Purchase Officer, Inventory
    # Manager who don't have project assignments) see everything.
    # Only project-assignment-scoped users (Site Engineer / Project Coordinator)
    # are restricted to their assigned projects.
    if is_admin_role(current_user.get("role", "")):
        if project_name and project_name != "all":
            query["project_name"] = project_name
    elif await is_assignment_scoped(db, current_user):
        assigned_names = await get_assigned_project_names(db, current_user)
        if not assigned_names:
            return []
        if project_name and project_name != "all":
            if project_name not in assigned_names:
                return []
            query["project_name"] = project_name
        else:
            query["project_name"] = {"$in": assigned_names}
    else:
        # Cross-project specialist (Purchase Officer, Inventory Manager, etc.)
        # — sees all requests. Optionally filter by ?project_name.
        if project_name and project_name != "all":
            query["project_name"] = project_name

    requests = await db.material_requests.find(query).sort("created_at", -1).to_list(100)
    return [
        {
            "id": str(r["_id"]),
            **{k: v for k, v in r.items() if k != "_id"}
        }
        for r in requests
    ]

class ConsolidateRequests(BaseModel):
    request_ids: List[str]
    notes: Optional[str] = ""

@router.post("/requests/consolidate", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def consolidate_requests(payload: ConsolidateRequests, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Dynamic gate — anyone with Inventory Management → Coordination access can consolidate
    await require_sub_tab(db, current_user, "Inventory Management", "Coordination")
        
    # 1. Fetch all selected requests
    ids = [ObjectId(rid) for rid in payload.request_ids]
    requests = await db.material_requests.find({"_id": {"$in": ids}}).to_list(100)
    
    if not requests:
        raise HTTPException(status_code=404, detail="No valid requests found")

    # 2. Combine items
    combined_items = {} # { "item_name|unit": { "name": "...", "quantity": X, "unit": Y, "sites": ["Site A"], "site_quantities": {"Site A": X} } }
    site_names = set()
    
    for req in requests:
        project_name = req.get("project_name", "Unknown Site")
        site_names.add(project_name)
        for item in req.get("requested_items", []):
            name = item["name"]
            qty = float(item.get("quantity", 0))
            unit = item.get("unit", "Nos")
            
            key = f"{name}|{unit}"
            if key in combined_items:
                combined_items[key]["quantity"] += qty
                
                # Update site specific quantity breakdown
                if project_name in combined_items[key]["site_quantities"]:
                    combined_items[key]["site_quantities"][project_name] += qty
                else:
                    combined_items[key]["site_quantities"][project_name] = qty
                    
                # Ensure site is in the list
                if project_name not in combined_items[key]["sites"]:
                    combined_items[key]["sites"].append(project_name)
            else:
                combined_items[key] = {
                    "name": name,
                    "quantity": qty,
                    "unit": unit,
                    "sites": [project_name],
                    "site_quantities": {project_name: qty}
                }

    # 3. Create Consolidated Record
    consolidated_record = {
        "request_ids": payload.request_ids,
        "items": list(combined_items.values()),
        "sites": list(site_names),
        "notes": payload.notes,
        "status": "Consolidated",
        "created_by": current_user.get("username"),
        "created_at": datetime.now()
    }
    
    result = await db.consolidated_requests.insert_one(consolidated_record)

    # Notify Purchase Officer about consolidation
    try:
        sender = current_user.get("full_name") or current_user.get("username", "")
        recipients = await get_users_with_permission(db, "Procurement", "edit")
        await notify(db, sender, recipients, EVENT_WORKFLOW,
            "Material Requests Consolidated",
            f"Consolidated request ready: {len(list(combined_items.values()))} items across {len(site_names)} sites. Ready for PO creation.",
            entity_type="material_request", entity_id=str(result.inserted_id), priority="high")
    except Exception:
        pass

    # 4. Update individual requests
    await db.material_requests.update_many(
        {"_id": {"$in": ids}},
        {"$set": {
            "status": "Consolidated", 
            "consolidated_id": str(result.inserted_id),
            "updated_at": datetime.now()
        }}
    )
    
    return {"id": str(result.inserted_id), "success": True}

@router.delete("/requests/{request_id}", dependencies=[Depends(RBACPermission("Inventory Management", "delete"))])
async def delete_material_request(request_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Cancel/delete a material request. Only Pending requests can be deleted."""
    oid = validate_object_id(request_id, "request")
    req = await db.material_requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") not in ("Pending", "Rejected"):
        raise HTTPException(status_code=400, detail=f"Cannot delete request with status '{req.get('status')}'. Only Pending/Rejected requests can be deleted.")
    await db.material_requests.delete_one({"_id": oid})
    from app.utils.logging import log_activity
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"], "Delete Material Request", f"Material request {request_id[-6:]} for {req.get('project_name', '')} deleted", "warning")
    return {"success": True, "message": "Material request deleted"}

@router.get("/consolidated", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def get_consolidated_requests(db = Depends(get_database)):
    records = await db.consolidated_requests.find().sort("created_at", -1).to_list(100)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.put("/requests/{request_id}/status")
async def update_request_status(request_id: str, payload: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(request_id, "request")
    # Material-request status can be changed from three UI workflows:
    #   • Approvals page (Approvals → Materials sub-tab) — admin/approver
    #   • Site Reports → Material Requests sub-tab — Project Coordinator
    #   • Workflow page (Procurement → edit) — Purchase Officer pushing
    #     requests to PO creation
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    allowed = (
        is_admin_role(current_user.get("role", ""))
        or await has_sub_tab_access(db, current_user, "Approvals", "Materials", role_doc=role_doc)
        or await has_sub_tab_access(db, current_user, "Site Reports", "Material Requests", role_doc=role_doc)
        or await has_module_action(db, current_user, "Procurement", "edit", role_doc=role_doc)
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You need Approvals → Materials, Site Reports → Material Requests, or Procurement edit access.")

    status = payload.get("status")
    remarks = payload.get("remarks", "")

    update_data = {
        "status": status,
        "coordinator_remarks": remarks,
        "updated_at": datetime.now(),
        "coordinator_id": current_user.get("username")
    }

    result = await db.material_requests.update_one(
        {"_id": oid},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if status == "Approved" or status == "Sent to PO" or status == "In Progress":
        req = await db.material_requests.find_one({"_id": ObjectId(request_id)})
        if req and req.get("project_id"):
            await trigger_workflow_event(req["project_id"], "sent_to_po", current_user, db, f"Material Request {request_id[-6:]} Approved/Sent to PO")
            
    return {"success": True}

@router.post("/requests/{request_id}/issue", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def issue_stock(request_id: str, issue: StockIssue, db = Depends(get_database)):
    oid = validate_object_id(request_id, "request")
    # 1. Update Material Request
    result = await db.material_requests.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "Issued",
                "issued_items": issue.issued_items,
                "issued_at": datetime.now()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # 2. Update Stocks & Log Ledger
    request = await db.material_requests.find_one({"_id": ObjectId(request_id)})
    project_name = request.get("project_name", "Unknown")
    total_issue_value = 0
    
    for item in issue.issued_items:
        qty = float(item["quantity"])
        # C10 Fix: Atomic check-and-decrement to prevent race conditions
        # Only decrement if stock >= requested quantity
        result_update = await db.warehouse_inventory.update_one(
            {"material_name": item["name"], "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}}
        )
        if result_update.matched_count == 0:
            # Either item doesn't exist or insufficient stock
            wh_item = await db.warehouse_inventory.find_one({"material_name": item["name"]})
            wh_stock = float(wh_item.get("stock", 0)) if wh_item else 0
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient warehouse stock for '{item['name']}'. Available: {wh_stock}, Requested: {qty}"
            )
        
        # Increase Site Stock
        await db.inventory.update_one(
            {
                "project_name": project_name,
                "material_name": item["name"]
            },
            {
                "$inc": {"stock": item["quantity"]},
                "$set": {"unit": item.get("unit", "Nos")}
            },
            upsert=True
        )
        
        # Calculate cost for project spending update
        # Try multiple rate sources: purchase bill → PO → warehouse inventory → material master
        rate = 0
        last_bill = await db.purchase_bills.find_one({"items.name": item["name"]}, sort=[("bill_date", -1)])
        if last_bill:
            for bi in last_bill.get("items", []):
                if bi["name"] == item["name"] and float(bi.get("rate") or 0) > 0:
                    rate = float(bi["rate"])
                    break
        if rate == 0:
            last_po = await db.purchase_orders.find_one({"items.name": item["name"]}, sort=[("created_at", -1)])
            if last_po:
                for pi in last_po.get("items", []):
                    if pi["name"] == item["name"] and float(pi.get("rate") or 0) > 0:
                        rate = float(pi["rate"])
                        break
        if rate == 0:
            wh_item = await db.warehouse_inventory.find_one({"material_name": item["name"]})
            if wh_item and float(wh_item.get("last_rate") or wh_item.get("rate") or 0) > 0:
                rate = float(wh_item.get("last_rate") or wh_item.get("rate"))
        total_issue_value += float(item["quantity"]) * rate

        # Record in Stock Ledger (two entries: OUT from warehouse, IN to site)
        ref_code = f"REQ-{request_id[-6:].upper()}"
        now = datetime.now()
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": "Warehouse",
            "type": "Stock Issue", "ref": ref_code,
            "in_qty": 0, "out_qty": item["quantity"], "created_at": now
        })
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": project_name,
            "type": "Stock Issue", "ref": ref_code,
            "in_qty": item["quantity"], "out_qty": 0, "created_at": now
        })
    
    # Update Project Spending
    if total_issue_value > 0:
        await db.projects.update_one({"name": project_name}, {"$inc": {"spent": total_issue_value}})
        
    return {"success": True}

class StockReturn(BaseModel):
    project_name: str
    items: List[dict] # [{"name": "Switch", "quantity": 10, "unit": "Nos"}]

# ── Return to Warehouse Request Flow ──────────────────────────────────────────

@router.post("/return-requests", dependencies=[Depends(RBACPermission("Inventory Management", "add"))])
async def create_return_request(body: dict = Body(...), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Site Engineer requests to return materials from site to warehouse."""
    items = body.get("items", [])
    project_name = body.get("project_name", "")
    if not items or not project_name:
        raise HTTPException(status_code=400, detail="Project name and items are required")

    # Prevent duplicate pending return requests for the same project
    existing = await db.stock_return_requests.find_one({"project_name": project_name, "status": "Pending"})
    if existing:
        raise HTTPException(status_code=400, detail="A return request is already pending for this project. Wait for admin approval or cancel the existing request.")

    requester = current_user.get("full_name") or current_user.get("username", "")
    doc = {
        "project_name": project_name,
        "items": items,
        "notes": body.get("notes", ""),
        "status": "Pending",
        "requested_by": requester,
        "engineer_id": current_user.get("username", ""),
        "created_at": datetime.now(),
    }
    result = await db.stock_return_requests.insert_one(doc)

    try:
        items_str = ", ".join(f"{i['name']} x{i['quantity']}" for i in items[:3])
        recipients = await get_users_with_permission(db, "Approvals", "edit")
        await notify(db, requester, recipients, EVENT_MATERIAL,
            "Stock Return Request",
            f"Return requested from {project_name}: {items_str}. Awaiting approval.",
            entity_type="stock_return", entity_id=str(result.inserted_id),
            project_name=project_name, priority="high")
    except Exception:
        pass

    return {"id": str(result.inserted_id), "success": True}


@router.get("/return-requests")
async def get_return_requests(db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Permission: approvers (Approvals → Stock Returns sub-tab) view the
    # pending queue; site staff (Inventory Management edit or Projects edit)
    # may also need to track their own submitted returns.
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    allowed = (
        is_admin_role(current_user.get("role", ""))
        or await has_sub_tab_access(db, current_user, "Approvals", "Stock Returns", role_doc=role_doc)
        or await has_module_action(db, current_user, "Inventory Management", "edit", role_doc=role_doc)
        or await has_module_action(db, current_user, "Projects", "edit", role_doc=role_doc)
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You don't have permission to view stock return requests.")

    requests = await db.stock_return_requests.find({}).sort("created_at", -1).to_list(200)
    return [{
        "id": str(r["_id"]),
        **{k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items() if k != "_id"}
    } for r in requests]


@router.put("/return-requests/{req_id}/approve", dependencies=[Depends(RBACPermission("Approvals", "edit"))])
async def approve_return_request(req_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Anyone with Approvals → Stock Returns access can approve — stock moves from site to warehouse."""
    await require_sub_tab(db, current_user, "Approvals", "Stock Returns")

    oid = validate_object_id(req_id, "return request")
    req = await db.stock_return_requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Return request not found")
    if req.get("status") != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    project_name = req["project_name"]
    for item in req.get("items", []):
        qty = float(item.get("quantity", 0))
        # Deduct from site inventory (atomic)
        deduct = await db.inventory.update_one(
            {"project_name": project_name, "material_name": item["name"], "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}}
        )
        if deduct.matched_count == 0:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item['name']} at {project_name}")

        # Add to warehouse
        await db.warehouse_inventory.update_one(
            {"material_name": item["name"]},
            {"$inc": {"stock": qty}},
            upsert=True
        )

        # Stock ledger entries
        now = datetime.now()
        ref = f"RET-{req_id[-6:].upper()}"
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": project_name,
            "type": "Stock Return", "ref": ref, "in_qty": 0, "out_qty": qty, "created_at": now
        })
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": "Warehouse",
            "type": "Stock Return", "ref": ref, "in_qty": qty, "out_qty": 0, "created_at": now
        })

    approver = current_user.get("full_name") or current_user.get("username", "")
    await db.stock_return_requests.update_one(
        {"_id": oid},
        {"$set": {"status": "Approved", "approved_by": approver, "approved_at": datetime.now()}}
    )

    try:
        engineer = req.get("requested_by") or req.get("engineer_id", "")
        recipients = await get_users_with_permission(db, "Accounts", "edit")
        if engineer:
            recipients.append(engineer)
        await notify(db, approver, recipients, EVENT_MATERIAL,
            "Stock Return Approved",
            f"Return from {project_name} approved by {approver}. Stock moved to warehouse.",
            entity_type="stock_return", entity_id=req_id, project_name=project_name, priority="normal")
    except Exception:
        pass

    return {"success": True, "message": "Return approved — stock moved to warehouse"}


@router.put("/return-requests/{req_id}/reject", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def reject_return_request(req_id: str, body: dict = Body(default={}), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(req_id, "return request")
    reason = body.get("reason", "")
    rejector = current_user.get("full_name") or current_user.get("username", "")
    await db.stock_return_requests.update_one(
        {"_id": oid}, {"$set": {"status": "Rejected", "rejection_reason": reason, "processed_by": rejector}}
    )
    return {"success": True}


@router.post("/return", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def return_stock(ret: StockReturn, db = Depends(get_database)):
    for item in ret.items:
        qty = float(item["quantity"])
        # Bug 5.4 Fix: Atomic check-and-decrement to prevent negative site stock
        result_update = await db.inventory.update_one(
            {
                "project_name": ret.project_name,
                "material_name": item["name"],
                "stock": {"$gte": qty}
            },
            {"$inc": {"stock": -qty}}
        )
        if result_update.matched_count == 0:
            site_item = await db.inventory.find_one({
                "project_name": ret.project_name,
                "material_name": item["name"]
            })
            available = float(site_item.get("stock", 0)) if site_item else 0
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient site stock for '{item['name']}'. Available: {available}, Return qty: {qty}"
            )
        
        # 2. Increase Warehouse Stock
        await db.warehouse_inventory.update_one(
            {"material_name": item["name"]},
            {"$inc": {"stock": item["quantity"]}},
            upsert=True
        )
        
        # 3. Record in Stock Ledger
        await db.stock_ledger.insert_one({
            "date": datetime.now(),
            "material_name": item["name"],
            "project_name": ret.project_name,
            "type": "Stock Return",
            "ref": "RETURN",
            "in_qty": item["quantity"], # In for Warehouse
            "out_qty": item["quantity"], # Out for Site
            "created_at": datetime.now()
        })
        
    return {"success": True}

@router.get("/ledger", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def get_stock_ledger(material_name: Optional[str] = None, project_name: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    if material_name:
        query["material_name"] = material_name
    if project_name:
        # Match direct project_name OR transfer entries involving this project
        query["$or"] = [
            {"project_name": project_name},
            {"from_project": project_name},
            {"to_project": project_name}
        ]

    # Dynamic scoping — admin-class + cross-project specialists see all;
    # only project-assignment-scoped users (Site Engineer / Project Coordinator)
    # are restricted to their assigned projects' ledger.
    if not is_admin_role(current_user.get("role", "")) and await is_assignment_scoped(db, current_user):
        assigned_names = await get_assigned_project_names(db, current_user)
        if assigned_names:
            query["$or"] = [
                {"project_name": {"$in": assigned_names}},
                {"from_project": {"$in": assigned_names}},
                {"to_project": {"$in": assigned_names}}
            ]
        else:
            # No assignments and not admin — no rows.
            return []

    logs = await db.stock_ledger.find(query).sort("date", -1).to_list(1000)
    
    # Calculate running balance if material specified?
    # Requirement says "Show Balance"
    # To show balance correctly, we might need to sort ASC, calc, then return DESC.
    
    if material_name:
        logs.reverse() # Sort ASC for calc
        current_balance = 0
        for log in logs:
            # This is tricky because ledger includes both Site and Warehouse
            # For simplicity, we'll just show the movement
            if log["type"] in ["GRN", "Stock Return", "GRN (Direct)"]:
                current_balance += log["in_qty"]
            elif log["type"] in ["Stock Issue"]:
                # For a specific site, Issue is IN. For warehouse, it's OUT.
                # Since this is a global ledger, maybe we just show IN/OUT.
                pass 
            # Re-evaluating: The user wants a standard ledger.
            # Let's just return what's in the log for now.
            log["balance"] = 0 # Placeholder if not specific enough
        logs.reverse() # Back to DESC
        
    return [
        {
            "id": str(l["_id"]),
            "date": l["date"],
            "material_name": l["material_name"],
            "project_name": l.get("project_name", ""),
            "type": l["type"],
            "ref": l.get("ref", ""),
            "in": l.get("in_qty", 0),
            "out": l.get("out_qty", 0),
            "balance": l.get("balance", 0)
        }
        for l in logs
    ]

@router.post("/requests/{request_id}/settle", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def settle_stock(request_id: str, settlement: StockSettlementCreate, db = Depends(get_database)):
    oid = validate_object_id(request_id, "request")
    # 1. Update Material Request
    await db.material_requests.update_one(
        {"_id": oid},
        {"$set": {"status": "Settled", "settled_at": datetime.now()}}
    )

    # 2. Log Settlement
    request = await db.material_requests.find_one({"_id": ObjectId(request_id)})
    settlement_dict = {
        "request_id": request_id,
        "project_name": request.get("project_name"),
        "date": datetime.now(),
        "items": settlement.items
    }
    await db.stock_settlements.insert_one(settlement_dict)
    
    # 3. Handle Remaining Stock (Return to Warehouse or Add to Site Inventory)
    for item in settlement.items:
        remaining = float(item.get("remaining", 0))
        if remaining > 0:
            if item.get("action") == "Return":
                # Add back to Warehouse
                await db.warehouse_inventory.update_one(
                    {"material_name": item["name"]},
                    {"$inc": {"stock": remaining}},
                    upsert=True
                )
            else:
                # Keep at Side -> Add to Site Inventory
                await db.inventory.update_one(
                    {
                        "project_name": request.get("project_name"),
                        "material_name": item["name"]
                    },
                    {
                        "$inc": {"stock": remaining},
                        "$set": {"unit": item.get("unit", "Nos")}
                    },
                    upsert=True
                )
                
    return {"success": True}

class MaterialTransfer(BaseModel):
    from_project: str
    to_project: str
    items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos", "price": 100}]
    notes: Optional[str] = ""

@router.post("/transfers/request", dependencies=[Depends(RBACPermission("Inventory Management", "add"))])
async def request_material_transfer(transfer: MaterialTransferRequest, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    request_dict = transfer.dict()
    request_dict["from_project"] = request_dict.get("from_project", "").strip()
    request_dict["to_project"] = request_dict.get("to_project", "").strip()
    request_dict["status"] = "Pending"
    request_dict["created_at"] = datetime.now()
    request_dict["engineer_id"] = current_user.get("username")
    request_dict["requested_by"] = current_user.get("full_name") or current_user.get("username", "")

    result = await db.material_transfer_requests.insert_one(request_dict)

    # Notify Admin about new transfer request
    try:
        requester = request_dict["requested_by"]
        items_summary = ", ".join(f"{i.get('name')} x{i.get('quantity')}" for i in transfer.items[:3])
        recipients = await get_users_with_permission(db, "Approvals", "edit")
        await notify(db, requester, recipients, EVENT_MATERIAL,
            "Material Transfer Request",
            f"Transfer requested: {transfer.from_project} → {transfer.to_project} ({items_summary}). Awaiting admin approval.",
            entity_type="material_transfer", entity_id=str(result.inserted_id),
            project_name=transfer.from_project, priority="high")
    except Exception:
        pass

    return {"id": str(result.inserted_id), "success": True}


def _transfer_helper(r):
    """Convert transfer request doc to JSON-safe dict."""
    d = {k: v for k, v in r.items() if k != "_id"}
    d["id"] = str(r["_id"])
    for field in ["created_at", "approval_date", "executed_at", "updated_at"]:
        if field in d and hasattr(d[field], "isoformat"):
            d[field] = d[field].isoformat()
    return d


@router.get("/transfers/pending", dependencies=[Depends(RBACPermission("Approvals", "view"))])
async def get_pending_transfers(db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Get all transfer requests — filtered by assigned projects for coordinator-class approvers."""
    query = {}
    # Dynamic detection — whoever has Inventory Management → Transfers sub-tab access
    # AND is not admin-class is treated as a coordinator-level approver (scoped to
    # their assigned projects). Admin-class sees everything (no filter).
    is_coordinator_approver = (
        await has_sub_tab_access(db, current_user, "Inventory Management", "Transfers")
        and not is_admin_role(current_user.get("role", ""))
    )
    if is_coordinator_approver:
        emp_username = current_user.get("username")
        emp_id = current_user.get("id") or current_user.get("_id", "")
        or_conditions = [
            {"coordinator_id": emp_username},
            {"coordinator_id": str(emp_id)},
        ]
        try:
            emp = await db.employees.find_one({"$or": [{"employeeCode": emp_username}, {"username": emp_username}]})
            if emp:
                or_conditions.append({"coordinator_id": str(emp["_id"])})
                if emp.get("employeeCode"):
                    or_conditions.append({"coordinator_id": emp["employeeCode"]})
        except Exception:
            pass
        assigned = await db.projects.find({"$or": or_conditions}).to_list(100)
        assigned_names = [p.get("name") for p in assigned if p.get("name")]
        if assigned_names:
            query["$or"] = [
                {"from_project": {"$in": assigned_names}},
                {"to_project": {"$in": assigned_names}},
            ]
        else:
            return []

    requests = await db.material_transfer_requests.find(query).sort("created_at", -1).to_list(200)
    return [_transfer_helper(r) for r in requests]

async def get_lifo_rate(db, material_name, project_name):
    # LIFO: Get the rate of the LAST purchase or issue for this project
    # 1. Check Purchase Bills for this project
    last_bill = await db.purchase_bills.find_one(
        {"project_name": project_name, "items.name": material_name},
        sort=[("bill_date", -1)]
    )
    if last_bill:
        for item in last_bill["items"]:
            if item["name"] == material_name:
                return float(item.get("rate") or 0)

    # 2. Check globally (last purchase anywhere) to get current market value
    global_last = await db.purchase_bills.find_one(
        {"items.name": material_name},
        sort=[("bill_date", -1)]
    )
    if global_last:
        for item in global_last["items"]:
            if item["name"] == material_name:
                return float(item.get("rate") or 0)
    
    return 0

@router.put("/transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Transfer approval is reachable from three UI workflows:
      • Approvals page (Approvals → Transfers sub-tab) — admin/PO approver
      • Materials Coordination tab (Inventory Management → Coordination) — coordinator
      • Site Reports → Transfer Requests sub-tab — coordinator's site-reports view
    Accept any of the matching sub-tabs; admin-class always passes.
    """
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    can_approvals = await has_sub_tab_access(db, current_user, "Approvals", "Transfers", role_doc=role_doc)
    can_inv_coord = await has_sub_tab_access(db, current_user, "Inventory Management", "Coordination", role_doc=role_doc)
    can_site_reports = await has_sub_tab_access(db, current_user, "Site Reports", "Transfer Requests", role_doc=role_doc)
    if not (is_admin_role(current_user.get("role", "")) or can_approvals or can_inv_coord or can_site_reports):
        raise HTTPException(status_code=403, detail="You need Approvals → Transfers, Inventory Management → Coordination, or Site Reports → Transfer Requests access to approve transfers.")

    oid = validate_object_id(transfer_id, "transfer")
    request = await db.material_transfer_requests.find_one({"_id": oid})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.get("status") != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    approver = current_user.get("full_name") or current_user.get("username", "")
    approver_role = current_user.get("role", "Admin")
    approval_status = f"{approver_role} Approved"
    await db.material_transfer_requests.update_one(
        {"_id": oid},
        {"$set": {
            "status": approval_status,
            "admin_approved_by": approver,
            "admin_approved_at": datetime.now(),
        }}
    )

    # Notify Accountant + Requester
    try:
        engineer = request.get("requested_by") or request.get("engineer_id", "")
        recipients = await get_users_with_permission(db, "Accounts", "edit")
        if engineer: recipients.append(engineer)
        await notify(db, approver, recipients, EVENT_MATERIAL,
            "Transfer Approved — Ready for Execution",
            f"Material transfer {request['from_project']} → {request['to_project']} approved by {approver}. Accountant can now execute with cost entry.",
            entity_type="material_transfer", entity_id=transfer_id,
            project_name=request.get("from_project"), priority="high")
    except Exception:
        pass

    return {"success": True, "message": "Transfer approved. Accountant can now execute."}


@router.put("/transfers/{transfer_id}/execute", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def execute_transfer(transfer_id: str, body: dict = Body(...), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Accountant executes the transfer with manual rate entry (M-Book based cost)."""
    oid = validate_object_id(transfer_id, "transfer")
    request = await db.material_transfer_requests.find_one({"_id": oid})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if not request.get("status", "").endswith("Approved"):
        raise HTTPException(status_code=400, detail="Transfer must be approved before execution")

    from_proj = request["from_project"].strip()
    to_proj = request["to_project"].strip()
    # Accountant provides items with rates
    accountant_items = body.get("items", request.get("items", []))
    total_transfer_value = 0
    calculated_items = []

    for item in accountant_items:
        qty = float(item.get("quantity", 0))
        rate = float(item.get("rate", 0))

        # Atomic check-and-decrement from source
        deduct_result = await db.inventory.update_one(
            {"project_name": from_proj, "material_name": item["name"], "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}}
        )
        if deduct_result.matched_count == 0:
            source_inv = await db.inventory.find_one({"project_name": from_proj, "material_name": item["name"]})
            available = float(source_inv.get("stock", 0)) if source_inv else 0
            raise HTTPException(status_code=400,
                detail=f"Insufficient stock for '{item['name']}' at {from_proj}. Available: {available}, Requested: {qty}")

        item_val = qty * rate
        total_transfer_value += item_val
        calculated_items.append({**item, "rate": rate, "value": item_val, "quantity": qty})

        # Add to destination
        dest_result = await db.inventory.update_one(
            {"project_name": to_proj, "material_name": item["name"]},
            {"$inc": {"stock": qty}, "$set": {"unit": item.get("unit", "Nos")}},
            upsert=True
        )
        # Verify destination was updated
        if dest_result.modified_count == 0 and dest_result.upserted_id is None:
            # Upsert failed silently — force insert the inventory record
            print(f"[TRANSFER WARNING] Upsert failed for {to_proj}/{item['name']}. Forcing insert.")
            existing = await db.inventory.find_one({"project_name": to_proj, "material_name": item["name"]})
            if existing:
                await db.inventory.update_one({"_id": existing["_id"]}, {"$inc": {"stock": qty}})
            else:
                await db.inventory.insert_one({
                    "project_name": to_proj,
                    "material_name": item["name"],
                    "stock": qty,
                    "unit": item.get("unit", "Nos"),
                    "min_stock": 10
                })

        # Stock ledger entries
        ref_code = f"XFER-{transfer_id[-6:].upper()}"
        now = datetime.now()
        transfer_project_name = f"{from_proj} -> {to_proj}"
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": transfer_project_name,
            "from_project": from_proj, "to_project": to_proj,
            "type": "Transfer Out", "ref": ref_code, "in_qty": 0, "out_qty": qty, "created_at": now
        })
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": transfer_project_name,
            "from_project": from_proj, "to_project": to_proj,
            "type": "Transfer In", "ref": ref_code, "in_qty": qty, "out_qty": 0, "created_at": now
        })

    # Accounting: symmetric project.spent adjustment
    source_project = await db.projects.find_one({"name": from_proj})
    source_spent = float(source_project.get("spent", 0)) if source_project else 0
    transfer_deduction = min(total_transfer_value, source_spent)

    if transfer_deduction > 0:
        await db.projects.update_one({"name": from_proj}, {"$inc": {"spent": -transfer_deduction}})
    await db.projects.update_one({"name": to_proj}, {"$inc": {"spent": transfer_deduction}})

    # Expense audit trail
    await db.expenses.insert_one({
        "category": "Material Transfer Out", "project": from_proj, "amount": -total_transfer_value,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "description": f"Transfer to {to_proj} (Ref: {transfer_id[-6:].upper()})",
        "items": calculated_items, "created_at": datetime.now()
    })
    await db.expenses.insert_one({
        "category": "Material Transfer In", "project": to_proj, "amount": total_transfer_value,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "description": f"Transfer from {from_proj} (Ref: {transfer_id[-6:].upper()})",
        "items": calculated_items, "created_at": datetime.now()
    })

    executor = current_user.get("full_name") or current_user.get("username", "")
    await db.material_transfer_requests.update_one(
        {"_id": oid},
        {"$set": {
            "status": "Completed",
            "executed_by": executor,
            "executed_at": datetime.now(),
            "total_value": total_transfer_value,
            "items": calculated_items
        }}
    )

    # Notify Admin + Requester
    try:
        engineer = request.get("requested_by") or request.get("engineer_id", "")
        recipients = await get_users_with_permission(db, "Approvals", "edit")
        if engineer: recipients.append(engineer)
        await notify(db, executor, recipients, EVENT_WORKFLOW,
            "Material Transfer Completed",
            f"Transfer {from_proj} → {to_proj} executed by {executor}. Total value: Rs.{total_transfer_value:,.0f}",
            entity_type="material_transfer", entity_id=transfer_id,
            project_name=from_proj, priority="normal")
    except Exception:
        pass

    return {"success": True, "value": total_transfer_value}


@router.post("/transfers/reconcile", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def reconcile_transfers(db=Depends(get_database), current_user=Depends(get_current_user)):
    """Fix inventory for completed transfers where destination stock was never added."""
    completed = await db.material_transfer_requests.find({"status": "Completed"}).to_list(500)
    fixed = []

    for transfer in completed:
        to_proj = transfer.get("to_project", "")
        for item in transfer.get("items", []):
            name = item.get("name", "")
            qty = float(item.get("quantity", 0))
            if not name or qty <= 0 or not to_proj:
                continue

            # Check if destination has this material in inventory
            dest_inv = await db.inventory.find_one({"project_name": to_proj, "material_name": name})
            if not dest_inv:
                # Stock was never added — insert it
                await db.inventory.insert_one({
                    "project_name": to_proj,
                    "material_name": name,
                    "stock": qty,
                    "unit": item.get("unit", "Nos"),
                    "min_stock": 10
                })
                fixed.append({"project": to_proj, "material": name, "qty": qty, "action": "created"})

    return {"success": True, "fixed_count": len(fixed), "details": fixed}


@router.put("/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: str, body: dict = Body(default={}), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Same multi-source flow as transfers/approve — accept Approvals → Transfers,
    # Inventory Management → Coordination, or Site Reports → Transfer Requests.
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    can_approvals = await has_sub_tab_access(db, current_user, "Approvals", "Transfers", role_doc=role_doc)
    can_inv_coord = await has_sub_tab_access(db, current_user, "Inventory Management", "Coordination", role_doc=role_doc)
    can_site_reports = await has_sub_tab_access(db, current_user, "Site Reports", "Transfer Requests", role_doc=role_doc)
    if not (is_admin_role(current_user.get("role", "")) or can_approvals or can_inv_coord or can_site_reports):
        raise HTTPException(status_code=403, detail="You need Approvals → Transfers, Inventory Management → Coordination, or Site Reports → Transfer Requests access to reject transfers.")

    oid = validate_object_id(transfer_id, "transfer")
    request = await db.material_transfer_requests.find_one({"_id": oid})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    rejector = current_user.get("full_name") or current_user.get("username", "")
    reason = body.get("reason", "")
    await db.material_transfer_requests.update_one(
        {"_id": oid},
        {"$set": {
            "status": "Rejected",
            "updated_at": datetime.now(),
            "processed_by": rejector,
            "rejection_reason": reason,
        }}
    )

    # Notify requester
    try:
        engineer = request.get("requested_by") or request.get("engineer_id", "")
        if engineer:
            await notify(db, rejector, [engineer], EVENT_MATERIAL,
                "Transfer Rejected",
                f"Transfer {request.get('from_project')} → {request.get('to_project')} rejected by {rejector}." + (f" Reason: {reason}" if reason else ""),
                entity_type="material_transfer", entity_id=transfer_id,
                project_name=request.get("from_project"), priority="high")
    except Exception:
        pass

    return {"success": True}


# ── Warehouse-Aware PO Flow ──────────────────────────────────────────────────

class WarehouseCheckRequest(BaseModel):
    material_names: List[str]

class WarehouseBulkIssueItem(BaseModel):
    name: str
    quantity: float
    unit: str = "Nos"

class WarehouseBulkIssue(BaseModel):
    request_id: Optional[str] = ""
    project_name: str
    items: List[WarehouseBulkIssueItem]
    # Optional: when admin acts on a pending warehouse deployment, the
    # client sends per-item PO attributions so we can mark fulfillment
    # against the originating PO line. Shape:
    #   [{ po_id: "...", material_name: "Fan", quantity: 5 }, ...]
    po_attributions: Optional[List[dict]] = None
    # Optional: same idea at the material-request (DPR) level. Used when
    # the shortfall came from "DPR asked more than warehouse had at PO time"
    # rather than from an under-fulfilled PO. Shape:
    #   [{ request_id: "...", material_name: "PVC", quantity: 5 }, ...]
    request_attributions: Optional[List[dict]] = None


@router.post("/warehouse/check-availability")
async def check_warehouse_availability(
    payload: WarehouseCheckRequest,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    """Check warehouse stock + last purchase rate for a list of materials."""
    # Get last known rates from purchase bills
    bills = await db.purchase_bills.find().sort("bill_date", -1).to_list(500)
    rate_map = {}
    for b in bills:
        for bi in b.get("items", []):
            name = bi.get("name", "")
            rate = float(bi.get("rate", 0) or 0)
            if name and rate > 0 and name not in rate_map:
                rate_map[name] = rate
    # Also check PO rates as fallback
    pos = await db.purchase_orders.find().sort("created_at", -1).to_list(500)
    for po in pos:
        for pi in po.get("items", []):
            name = pi.get("name", "")
            rate = float(pi.get("rate", 0) or 0)
            if name and rate > 0 and name not in rate_map:
                rate_map[name] = rate

    result = {}
    for name in payload.material_names:
        wh = await db.warehouse_inventory.find_one({"material_name": name})
        result[name] = {
            "stock": float(wh.get("stock", 0)) if wh else 0,
            "unit": wh.get("unit", "Nos") if wh else "Nos",
            "last_rate": rate_map.get(name, 0),
        }
    return result


@router.get("/warehouse/pending-deployments", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def pending_warehouse_deployments(db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Returns PO line items where the warehouse was the source vendor and
    fewer units have been shipped to the requesting project than ordered.

    Used by the Inventory Management → Send to Site alert. Each row tells
    admin: "Project X still needs Y units of Material Z, and the warehouse
    currently has W in stock you could send right now."

    Pending formula:
        pending = ordered − GRN_received_against_this_PO
                          − warehouse_fulfilled_qty (set when admin uses Send to Site)
    """
    pos = await db.purchase_orders.find({}).to_list(2000)
    grns = await db.grns.find({}).to_list(5000)
    warehouse_docs = await db.warehouse_inventory.find({}).to_list(1000)
    wh_stock = {w.get("material_name", ""): float(w.get("stock", 0) or 0) for w in warehouse_docs}

    # Group GRNs by po_id for quick lookup.
    grns_by_po: dict = {}
    for g in grns:
        pid = g.get("po_id")
        if not pid:
            continue
        grns_by_po.setdefault(str(pid), []).append(g)

    pending = []
    EXCLUDED_PO_STATUSES = {"Cancelled", "Rejected"}

    for po in pos:
        if (po.get("status") or "") in EXCLUDED_PO_STATUSES:
            continue
        po_id = str(po["_id"])
        po_number = po.get("po_number") or f"PO-{po_id[-6:].upper()}"
        project = (po.get("project_name") or "").strip()
        if not project or project.lower() == "warehouse":
            # Skip non-project POs (e.g., warehouse-replenishment POs)
            continue
        is_multi = bool(po.get("is_multi_vendor"))
        top_vendor = (po.get("vendor_name") or "").strip().lower()

        for pi in po.get("items", []):
            name = (pi.get("name") or "").strip()
            if not name:
                continue

            # Determine item-level source vendor
            item_vendor = (pi.get("vendor_name") or "").strip().lower() if is_multi else top_vendor
            if item_vendor != "warehouse":
                continue

            ordered = float(pi.get("qty", 0) or 0)
            if ordered <= 0:
                continue

            # GRN-recorded fulfillment for this PO + item
            grn_filled = 0.0
            for g in grns_by_po.get(po_id, []):
                for gi in g.get("items", []):
                    if (gi.get("name") or "").strip() == name:
                        recv = float(gi.get("received_qty", 0) or 0)
                        rej = float(gi.get("rejected_qty", 0) or 0)
                        grn_filled += max(0.0, recv - rej)

            # Additional fulfillment tracked when admin uses Send to Site
            extra_filled = float(pi.get("warehouse_fulfilled_qty", 0) or 0)

            pending_qty = ordered - grn_filled - extra_filled
            if pending_qty <= 0.0001:
                continue

            current_wh = wh_stock.get(name, 0.0)
            pending.append({
                "source": "po",
                "po_id": po_id,
                "po_number": po_number,
                "project_name": project,
                "material_name": name,
                "unit": pi.get("unit", "Nos"),
                "ordered_qty": ordered,
                "fulfilled_qty": grn_filled + extra_filled,
                "pending_qty": pending_qty,
                "warehouse_stock": current_wh,
                # `actionable` = there's stock in warehouse right now that admin
                # can issue against this pending line.
                "actionable": current_wh > 0,
                "po_status": po.get("status") or "",
            })

    # ── Material-request-level shortfall ────────────────────────────────────
    # A DPR / Material Request may ask for more than the warehouse currently
    # holds. The POModal now blocks warehouse-vendor POs that exceed stock,
    # which means the rest of the demand stays unallocated on the
    # material_request. When the warehouse later receives more stock, the
    # Send-to-Site alert should resurface the shortfall against the original
    # project so admin can issue the remainder directly.
    #
    #   pending = requested_qty
    #             − Σ(linked PO line qty across all vendors)
    #             − direct_issued_qty (set when admin uses Send-to-Site)
    #
    # PO line qty (not GRN-received) is used because the PO already represents
    # a commitment — once a PO exists for those units the demand is "covered"
    # from the request's POV; PO-internal pending is tracked separately above.
    # Statuses representing "request is still open" — exclude terminal states
    # (Rejected, Closed, Fulfilled). "PO Created" is INCLUDED because creating
    # a PO doesn't mean the original demand is met — the PO might cover only
    # part of the request (e.g., warehouse was short at PO time).
    mrs = await db.material_requests.find(
        {"status": {"$in": [
            "Pending", "Approved", "Sent to PO", "PO Created",
            "Partial", "Partially Fulfilled", "In Progress",
        ]}}
    ).to_list(2000)

    # Index POs by request_id for O(n) lookup instead of O(n²).
    pos_by_request: dict = {}
    for po in pos:
        if (po.get("status") or "") in EXCLUDED_PO_STATUSES:
            continue
        rid = po.get("request_id")
        if not rid:
            continue
        pos_by_request.setdefault(str(rid), []).append(po)

    for mr in mrs:
        mr_id = str(mr["_id"])
        project = (mr.get("project_name") or "").strip()
        if not project:
            continue
        for ri in mr.get("requested_items", []):
            name = (ri.get("name") or "").strip()
            if not name:
                continue
            requested = float(ri.get("quantity", 0) or 0)
            if requested <= 0:
                continue

            po_covered = 0.0
            for po in pos_by_request.get(mr_id, []):
                for pi in po.get("items", []):
                    if (pi.get("name") or "").strip() == name:
                        po_covered += float(pi.get("qty", 0) or 0)

            direct_filled = float(ri.get("direct_issued_qty", 0) or 0)
            pending_qty = requested - po_covered - direct_filled
            if pending_qty <= 0.0001:
                continue

            current_wh = wh_stock.get(name, 0.0)
            pending.append({
                "source": "material_request",
                "request_id": mr_id,
                "project_name": project,
                "material_name": name,
                "unit": ri.get("unit", "Nos"),
                "ordered_qty": requested,
                "fulfilled_qty": po_covered + direct_filled,
                "pending_qty": pending_qty,
                "warehouse_stock": current_wh,
                "actionable": current_wh > 0,
                "request_source": mr.get("source", ""),  # e.g. "DPR"
            })

    return pending


@router.post("/warehouse/bulk-issue", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def bulk_warehouse_issue(
    payload: WarehouseBulkIssue,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    """Issue materials from warehouse to a project site during PO creation.
    Items available in warehouse are issued directly; remaining go to PO."""
    issued = []
    total_value = 0

    for item in payload.items:
        qty = float(item.quantity)
        if qty <= 0:
            continue

        # Atomic check-and-decrement (same pattern as issue_stock)
        res = await db.warehouse_inventory.update_one(
            {"material_name": item.name, "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}},
        )
        if res.matched_count == 0:
            wh = await db.warehouse_inventory.find_one({"material_name": item.name})
            available = float(wh.get("stock", 0)) if wh else 0
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient warehouse stock for '{item.name}'. Available: {available}, Requested: {qty}",
            )

        # Increment site inventory
        await db.inventory.update_one(
            {"project_name": payload.project_name, "material_name": item.name},
            {"$inc": {"stock": qty}, "$set": {"unit": item.unit}},
            upsert=True,
        )

        # Find last known rate for value calculation
        rate = 0
        last_bill = await db.purchase_bills.find_one(
            {"items.name": item.name}, sort=[("bill_date", -1)]
        )
        if last_bill:
            for bi in last_bill.get("items", []):
                if bi["name"] == item.name and bi.get("rate"):
                    rate = float(bi["rate"])
                    break
        item_value = qty * rate
        total_value += item_value

        # Stock ledger entries (two: OUT from warehouse, IN to site)
        ref_code = f"WH-{payload.request_id[-6:].upper()}" if payload.request_id else f"WH-DIRECT-{datetime.now().strftime('%H%M%S')}"
        now = datetime.now()
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item.name, "project_name": "Warehouse",
            "type": "Warehouse Issue", "ref": ref_code,
            "in_qty": 0, "out_qty": qty, "created_at": now
        })
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item.name, "project_name": payload.project_name,
            "type": "Warehouse Issue", "ref": ref_code,
            "in_qty": qty, "out_qty": 0, "created_at": now
        })

        issued.append({"name": item.name, "quantity": qty, "unit": item.unit, "value": item_value})

    # Update project spending
    if total_value > 0:
        await db.projects.update_one(
            {"name": payload.project_name},
            {"$inc": {"spent": total_value}},
        )

    # Mark warehouse-issued items on the material request
    if payload.request_id and ObjectId.is_valid(payload.request_id):
        await db.material_requests.update_one(
            {"_id": ObjectId(payload.request_id)},
            {"$set": {"warehouse_issued_items": issued, "warehouse_issued_at": datetime.now()}},
        )

    # Mark fulfillment on the originating material request when admin acts
    # on a request-level shortfall (DPR demanded more than the original PO
    # could absorb). Increments `requested_items[i].direct_issued_qty` on
    # the matching request item.
    if payload.request_attributions:
        by_req: dict = {}
        for att in payload.request_attributions:
            rid = att.get("request_id")
            if not rid or not ObjectId.is_valid(rid):
                continue
            by_req.setdefault(rid, []).append(att)
        for rid, atts in by_req.items():
            mr_doc = await db.material_requests.find_one({"_id": ObjectId(rid)})
            if not mr_doc:
                continue
            new_req_items = []
            for ri in mr_doc.get("requested_items", []):
                ri_name = (ri.get("name") or "").strip()
                add_qty = 0.0
                for a in atts:
                    if (a.get("material_name") or "").strip() == ri_name:
                        add_qty += float(a.get("quantity", 0) or 0)
                if add_qty > 0:
                    current = float(ri.get("direct_issued_qty", 0) or 0)
                    ri["direct_issued_qty"] = current + add_qty
                new_req_items.append(ri)
            await db.material_requests.update_one(
                {"_id": ObjectId(rid)},
                {"$set": {"requested_items": new_req_items}},
            )

    # Mark fulfillment on the originating PO line(s) when admin acts on a
    # pending warehouse deployment. Each attribution increments the matching
    # PO item's `warehouse_fulfilled_qty`, which the
    # `/warehouse/pending-deployments` endpoint subtracts from the ordered
    # quantity to compute remaining pending. Multiple POs (one per attribution)
    # are supported in a single bulk-issue.
    if payload.po_attributions:
        # Group attributions by PO so we can do one update per PO doc.
        by_po: dict = {}
        for att in payload.po_attributions:
            pid = att.get("po_id")
            if not pid or not ObjectId.is_valid(pid):
                continue
            by_po.setdefault(pid, []).append(att)
        for pid, atts in by_po.items():
            po_doc = await db.purchase_orders.find_one({"_id": ObjectId(pid)})
            if not po_doc:
                continue
            new_items = []
            for pi in po_doc.get("items", []):
                pi_name = (pi.get("name") or "").strip()
                add_qty = 0.0
                for a in atts:
                    if (a.get("material_name") or "").strip() == pi_name:
                        add_qty += float(a.get("quantity", 0) or 0)
                if add_qty > 0:
                    current = float(pi.get("warehouse_fulfilled_qty", 0) or 0)
                    pi["warehouse_fulfilled_qty"] = current + add_qty
                new_items.append(pi)
            await db.purchase_orders.update_one(
                {"_id": ObjectId(pid)},
                {"$set": {"items": new_items}},
            )

    return {"success": True, "issued_count": len(issued), "issued_items": issued, "total_value": total_value}


@router.get("/report/material-wise", dependencies=[Depends(RBACPermission("Inventory Management", "view"))])
async def material_wise_report(
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    """Comprehensive material stock report: warehouse + site-wise qty + last rate + value."""
    materials = await db.materials.find().to_list(500)
    wh_items = await db.warehouse_inventory.find().to_list(500)
    site_items = await db.inventory.find().to_list(2000)
    bills = await db.purchase_bills.find().sort("bill_date", -1).to_list(500)

    # Build lookups
    wh_map = {w["material_name"]: float(w.get("stock", 0)) for w in wh_items}
    site_map = {}  # material → {project: qty}
    for s in site_items:
        mat = s.get("material_name", "")
        proj = s.get("project_name", "")
        qty = float(s.get("stock", 0))
        if qty <= 0:
            continue
        if mat not in site_map:
            site_map[mat] = {}
        site_map[mat][proj] = site_map[mat].get(proj, 0) + qty

    # Rate from latest purchase bill
    rate_map = {}
    for b in bills:
        for bi in b.get("items", []):
            name = bi.get("name", "")
            rate = float(bi.get("rate", 0) or 0)
            if name and rate > 0 and name not in rate_map:
                rate_map[name] = rate

    report = []
    seen = set()
    # Include all materials from master + any with stock
    all_names = set(m.get("name", "") for m in materials)
    all_names.update(wh_map.keys())
    all_names.update(site_map.keys())

    for name in sorted(all_names):
        if not name or name in seen:
            continue
        seen.add(name)
        mat = next((m for m in materials if m.get("name") == name), {})
        wh_qty = wh_map.get(name, 0)
        sites = site_map.get(name, {})
        total_site = sum(sites.values())
        total_qty = wh_qty + total_site
        rate = rate_map.get(name, 0)

        report.append({
            "material_name": name,
            "category": mat.get("category", ""),
            "unit": mat.get("unit", "Nos"),
            "warehouse_qty": wh_qty,
            "site_stocks": sites,
            "total_site_qty": total_site,
            "total_qty": total_qty,
            "last_rate": rate,
            "total_value": round(total_qty * rate, 2),
        })

    return report

