from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from database import get_database
from app.utils.auth import get_current_user

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/", response_model=Dict[str, List[Any]])
async def get_all_approvals(status: str = "Pending", current_user=Depends(get_current_user), db=Depends(get_database)):
    results = {
        "leaves": [],
        "purchase_orders": [],
        "materials": [],
        "expenses": [],
        "manpower": []
    }
    
    query = {}
    if status.lower() != "all":
        # Support matching exact case or capitalize gracefully
        query["status"] = {"$regex": f"^{status}$", "$options": "i"}

    # Pre-fetch employees to resolve IDs/usernames to names
    employees = await db.employees.find({}, {"fullName": 1, "_id": 1, "username": 1, "employeeCode": 1}).to_list(1000)
    emp_map = {}
    for e in employees:
        full_name = e.get("fullName", "Unknown")
        if "_id" in e: emp_map[str(e["_id"])] = full_name
        if "username" in e: emp_map[e["username"]] = full_name
        if "employeeCode" in e: emp_map[e["employeeCode"]] = full_name

    def resolve_names(item):
        """Helper to resolve engineer_id/approvedBy to fullName."""
        for field in ["engineer_id", "approvedBy", "requested_by", "submitted_by"]:
            val = item.get(field)
            if val and val in emp_map:
                item[field] = emp_map[val]
        return item

    leaves = await db.leaves.find(query).sort("_id", -1).to_list(100)
    for l in leaves:
        l["_id"] = str(l["_id"])
        resolve_names(l)
        for k, v in l.items():
            if hasattr(v, "isoformat"):
                l[k] = str(v)
    results["leaves"] = leaves
    
    pos = await db.purchase_orders.find(query).sort("_id", -1).to_list(100)
    for po in pos:
        po["_id"] = str(po["_id"])
        resolve_names(po)
        if "created_at" in po:
            po["created_at"] = str(po["created_at"])
    results["purchase_orders"] = pos
    
    mats = await db.material_requests.find(query).sort("_id", -1).to_list(100)
    for m in mats:
        m["_id"] = str(m["_id"])
        resolve_names(m)
        for k, v in m.items():
            if hasattr(v, "isoformat"):
                m[k] = str(v)
    results["materials"] = mats
    
    exps = await db.expenses.find(query).sort("_id", -1).to_list(100)
    for ex in exps:
        ex["_id"] = str(ex["_id"])
        resolve_names(ex)
        for k, v in ex.items():
            if hasattr(v, "isoformat"):
                ex[k] = str(v)
    results["expenses"] = exps
    
    manpower = await db.manpower_requests.find(query).sort("_id", -1).to_list(100)
    for mp in manpower:
        mp["_id"] = str(mp["_id"])
        resolve_names(mp)
        for k, v in mp.items():
            if hasattr(v, "isoformat"):
                mp[k] = str(v)
    results["manpower"] = manpower
    
    return results

@router.get("/pending", response_model=Dict[str, List[Any]])
async def get_pending_approvals(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Legacy wrapper for older clients
    return await get_all_approvals("Pending", current_user, db)

from fastapi import Body

@router.put("/{type}/{obj_id}/{action}")
async def action_approval(type: str, obj_id: str, action: str, request_data: dict = Body(default={}), current_user=Depends(get_current_user), db=Depends(get_database)):
    from bson import ObjectId
    print(f"DEBUG: Action Approval - Type: {type}, ID: {obj_id}, Action: {action}")
    
    status = "Approved" if action.lower() == "approve" else ("Completed" if action.lower() == "complete" else "Rejected")
    reason = request_data.get("reason", "")
    
    update_fields = {"status": status, "approvedBy": current_user.get("full_name") or current_user.get("username", "Admin")}
    if reason:
        update_fields["remarks"] = reason
    
    try:
        if type == "leaves":
            await db.leaves.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
        elif type == "purchase_orders":
            await db.purchase_orders.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
        elif type == "materials":
            await db.material_requests.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
        elif type == "expenses":
            await db.expenses.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
        elif type == "manpower":
            res = await db.manpower_requests.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
            print(f"DEBUG: Manpower Update Result - Matched: {res.matched_count}, Modified: {res.modified_count}")
        # Add other types as needed
        
        return {"message": "Success", "status": status}
    except Exception as e:
        print(f"ERROR in action_approval: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
