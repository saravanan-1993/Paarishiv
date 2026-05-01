from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from database import get_database
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from app.utils.auth import get_current_user, validate_object_id
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission
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

@router.get("/warehouse")
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

@router.post("/requests", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def create_material_request(request: MaterialRequestCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
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
        recipients = ["Project Coordinator", "Administrator"]
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

@router.get("/requests")
async def get_material_requests(project_name: Optional[str] = None, status: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    
    if status:
        query["status"] = status
    
    # Check if user is Coordinator, Admin, or Purchase Officer
    allowed_roles = ["Project Coordinator", "Super Admin", "Administrator", "Purchase Officer", "Inventory Manager"]
    if current_user.get("role") in allowed_roles:
        if project_name and project_name != "all":
            query["project_name"] = project_name
    elif current_user.get("role") == "Site Engineer":
        # Bug 5.2 - Check multiple fields for Site Engineer project matching
        username = current_user.get("username")
        user_id = current_user.get("_id", "")
        project_query = {"$or": [
            {"engineer_id": username},
            {"engineer_id": str(user_id)},
        ]}
        # Also check if employee has a siteId
        emp = await db.employees.find_one({"$or": [{"employeeCode": username}, {"username": username}]})
        if emp and emp.get("siteId"):
            project_query["$or"].append({"_id": emp["siteId"]})
        projects = await db.projects.find(project_query).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]

        if project_name and project_name != "all":
            if project_name in project_names:
                query["project_name"] = project_name
            else:
                return []
        else:
            if project_names:
                query["project_name"] = {"$in": project_names}
            else:
                return []
    else:
        # Default restricted view
        return []

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

@router.post("/requests/consolidate")
async def consolidate_requests(payload: ConsolidateRequests, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Only Coordinator, Admin can consolidate
    allowed = ["Project Coordinator", "Super Admin", "Administrator"]
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized to consolidate requests")
        
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
        await notify(db, sender, ["Purchase Officer", "Administrator"], EVENT_WORKFLOW,
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

@router.delete("/requests/{request_id}", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
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

@router.get("/consolidated")
async def get_consolidated_requests(db = Depends(get_database)):
    records = await db.consolidated_requests.find().sort("created_at", -1).to_list(100)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.put("/requests/{request_id}/status")
async def update_request_status(request_id: str, payload: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(request_id, "request")
    # Only Coordinator, Admin, Purchase Officer or Inventory Manager can approve
    allowed_approvers = ["Project Coordinator", "Super Admin", "Administrator", "Purchase Officer", "Inventory Manager"]
    if current_user.get("role") not in allowed_approvers:
        raise HTTPException(status_code=403, detail="Not authorized to approve requests")

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

@router.post("/requests/{request_id}/issue")
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

@router.post("/return-requests")
async def create_return_request(body: dict = Body(...), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Site Engineer requests to return materials from site to warehouse."""
    items = body.get("items", [])
    project_name = body.get("project_name", "")
    if not items or not project_name:
        raise HTTPException(status_code=400, detail="Project name and items are required")

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
        await notify(db, requester, ["Administrator", "General Manager"], EVENT_MATERIAL,
            "Stock Return Request",
            f"Return requested from {project_name}: {items_str}. Awaiting approval.",
            entity_type="stock_return", entity_id=str(result.inserted_id),
            project_name=project_name, priority="high")
    except Exception:
        pass

    return {"id": str(result.inserted_id), "success": True}


@router.get("/return-requests")
async def get_return_requests(db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    requests = await db.stock_return_requests.find({}).sort("created_at", -1).to_list(200)
    return [{
        "id": str(r["_id"]),
        **{k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items() if k != "_id"}
    } for r in requests]


@router.put("/return-requests/{req_id}/approve")
async def approve_return_request(req_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Admin approves return — stock moves from site to warehouse."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can approve return requests")

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
        await notify(db, approver, [engineer, "Accountant"], EVENT_MATERIAL,
            "Stock Return Approved",
            f"Return from {project_name} approved by {approver}. Stock moved to warehouse.",
            entity_type="stock_return", entity_id=req_id, project_name=project_name, priority="normal")
    except Exception:
        pass

    return {"success": True, "message": "Return approved — stock moved to warehouse"}


@router.put("/return-requests/{req_id}/reject")
async def reject_return_request(req_id: str, body: dict = Body(default={}), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(req_id, "return request")
    reason = body.get("reason", "")
    rejector = current_user.get("full_name") or current_user.get("username", "")
    await db.stock_return_requests.update_one(
        {"_id": oid}, {"$set": {"status": "Rejected", "rejection_reason": reason, "processed_by": rejector}}
    )
    return {"success": True}


@router.post("/return")
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

@router.get("/ledger")
async def get_stock_ledger(material_name: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    if material_name:
        query["material_name"] = material_name
        
    if current_user.get("role") == "Site Engineer":
        # Bug 5.2 - Check multiple fields for Site Engineer project matching
        username = current_user.get("username")
        user_id = current_user.get("_id", "")
        project_query = {"$or": [
            {"engineer_id": username},
            {"engineer_id": str(user_id)},
        ]}
        emp = await db.employees.find_one({"$or": [{"employeeCode": username}, {"username": username}]})
        if emp and emp.get("siteId"):
            project_query["$or"].append({"_id": emp["siteId"]})
        projects = await db.projects.find(project_query).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        if project_names:
            query["project_name"] = {"$in": project_names}
        else:
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

@router.post("/requests/{request_id}/settle")
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

@router.post("/transfers/request", dependencies=[Depends(RBACPermission("Inventory Management", "edit"))])
async def request_material_transfer(transfer: MaterialTransferRequest, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    request_dict = transfer.dict()
    request_dict["status"] = "Pending"
    request_dict["created_at"] = datetime.now()
    request_dict["engineer_id"] = current_user.get("username")
    request_dict["requested_by"] = current_user.get("full_name") or current_user.get("username", "")

    result = await db.material_transfer_requests.insert_one(request_dict)

    # Notify Admin about new transfer request
    try:
        requester = request_dict["requested_by"]
        items_summary = ", ".join(f"{i.get('name')} x{i.get('quantity')}" for i in transfer.items[:3])
        await notify(db, requester, ["Administrator", "General Manager"], EVENT_MATERIAL,
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


@router.get("/transfers/pending")
async def get_pending_transfers(db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Get all transfer requests (not just Pending — includes Admin Approved for accountant)."""
    requests = await db.material_transfer_requests.find(
        {"status": {"$in": ["Pending", "Admin Approved", "Approved", "Completed", "Rejected"]}}
    ).sort("created_at", -1).to_list(200)
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
    """Admin approves transfer request — does NOT move stock yet. Accountant executes later."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can approve transfer requests")

    oid = validate_object_id(transfer_id, "transfer")
    request = await db.material_transfer_requests.find_one({"_id": oid})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.get("status") != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    approver = current_user.get("full_name") or current_user.get("username", "")
    await db.material_transfer_requests.update_one(
        {"_id": oid},
        {"$set": {
            "status": "Admin Approved",
            "admin_approved_by": approver,
            "admin_approved_at": datetime.now(),
        }}
    )

    # Notify Accountant + Requester
    try:
        engineer = request.get("requested_by") or request.get("engineer_id", "")
        recipients = ["Accountant"]
        if engineer: recipients.append(engineer)
        await notify(db, approver, recipients, EVENT_MATERIAL,
            "Transfer Approved — Ready for Execution",
            f"Material transfer {request['from_project']} → {request['to_project']} approved by {approver}. Accountant can now execute with cost entry.",
            entity_type="material_transfer", entity_id=transfer_id,
            project_name=request.get("from_project"), priority="high")
    except Exception:
        pass

    return {"success": True, "message": "Transfer approved. Accountant can now execute."}


@router.put("/transfers/{transfer_id}/execute")
async def execute_transfer(transfer_id: str, body: dict = Body(...), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Accountant executes the transfer with manual rate entry (M-Book based cost)."""
    oid = validate_object_id(transfer_id, "transfer")
    request = await db.material_transfer_requests.find_one({"_id": oid})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.get("status") != "Admin Approved":
        raise HTTPException(status_code=400, detail="Transfer must be admin-approved before execution")

    from_proj = request["from_project"]
    to_proj = request["to_project"]
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
        await db.inventory.update_one(
            {"project_name": to_proj, "material_name": item["name"]},
            {"$inc": {"stock": qty}, "$set": {"unit": item.get("unit", "Nos")}},
            upsert=True
        )

        # Stock ledger entries
        ref_code = f"XFER-{transfer_id[-6:].upper()}"
        now = datetime.now()
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": from_proj,
            "type": "Transfer Out", "ref": ref_code, "in_qty": 0, "out_qty": qty, "created_at": now
        })
        await db.stock_ledger.insert_one({
            "date": now, "material_name": item["name"], "project_name": to_proj,
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
        recipients = ["Administrator"]
        if engineer: recipients.append(engineer)
        await notify(db, executor, recipients, EVENT_WORKFLOW,
            "Material Transfer Completed",
            f"Transfer {from_proj} → {to_proj} executed by {executor}. Total value: Rs.{total_transfer_value:,.0f}",
            entity_type="material_transfer", entity_id=transfer_id,
            project_name=from_proj, priority="normal")
    except Exception:
        pass

    return {"success": True, "value": total_transfer_value}


@router.put("/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: str, body: dict = Body(default={}), db = Depends(get_database), current_user: dict = Depends(get_current_user)):
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


@router.post("/warehouse/bulk-issue")
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

    return {"success": True, "issued_count": len(issued), "issued_items": issued, "total_value": total_value}


@router.get("/report/material-wise")
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

