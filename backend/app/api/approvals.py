from fastapi import APIRouter, Depends
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
        "expenses": []
    }
    
    query = {}
    if status.lower() != "all":
        # Support matching exact case or capitalize gracefully
        query["status"] = {"$regex": f"^{status}$", "$options": "i"}
        
    leaves = await db.leaves.find(query).sort("_id", -1).to_list(100)
    for l in leaves:
        l["_id"] = str(l["_id"])
        for k, v in l.items():
            if hasattr(v, "isoformat"):
                l[k] = str(v)
    results["leaves"] = leaves
    
    pos = await db.purchase_orders.find(query).sort("_id", -1).to_list(100)
    for po in pos:
        po["_id"] = str(po["_id"])
        if "created_at" in po:
            po["created_at"] = str(po["created_at"])
    results["purchase_orders"] = pos
    
    mats = await db.material_requests.find(query).sort("_id", -1).to_list(100)
    for m in mats:
        m["_id"] = str(m["_id"])
        for k, v in m.items():
            if hasattr(v, "isoformat"):
                m[k] = str(v)
    results["materials"] = mats
    
    exps = await db.expenses.find(query).sort("_id", -1).to_list(100)
    for ex in exps:
        ex["_id"] = str(ex["_id"])
        for k, v in ex.items():
            if hasattr(v, "isoformat"):
                ex[k] = str(v)
    results["expenses"] = exps
    
    return results

@router.get("/pending", response_model=Dict[str, List[Any]])
async def get_pending_approvals(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Legacy wrapper for older clients
    return await get_all_approvals("Pending", current_user, db)

from fastapi import Body

@router.put("/{type}/{id}/{action}")
async def action_approval(type: str, id: str, action: str, request_data: dict = Body(default={}), current_user=Depends(get_current_user), db=Depends(get_database)):
    from bson import ObjectId
    
    status = "Approved" if action.lower() == "approve" else "Rejected"
    reason = request_data.get("reason", "")
    
    update_fields = {"status": status, "approvedBy": current_user["username"]}
    if reason:
        update_fields["remarks"] = reason
    
    if type == "leaves":
        await db.leaves.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    elif type == "purchase_orders":
        await db.purchase_orders.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    elif type == "materials":
        await db.material_requests.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    elif type == "expenses":
        await db.expenses.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    # Add other types as needed
    
    return {"message": "Success", "status": status}
