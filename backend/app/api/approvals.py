from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import re
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/", response_model=Dict[str, List[Any]], dependencies=[Depends(RBACPermission("Approvals", "view"))])
async def get_all_approvals(status: str = "Pending", current_user=Depends(get_current_user), db=Depends(get_database)):
    results = {
        "leaves": [],
        "purchase_orders": [],
        "materials": [],
        "expenses": [],
        "manpower": [],
        "dprs": []
    }
    
    query = {}
    if status.lower() != "all":
        # C7 Fix: Escape user input in regex to prevent NoSQL injection
        query["status"] = {"$regex": f"^{re.escape(status)}$", "$options": "i"}

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

    # Bug 4.7 - DPR approvals: fetch DPRs from projects
    dpr_status_filter = status if status.lower() != "all" else None
    projects_with_dprs = await db.projects.find({"dprs": {"$exists": True, "$ne": []}}, {"dprs": 1, "name": 1}).to_list(500)
    dpr_list = []
    for proj in projects_with_dprs:
        proj_id = str(proj["_id"])
        proj_name = proj.get("name", "Unknown Project")
        for dpr in (proj.get("dprs") or []):
            dpr_s = dpr.get("status", "Pending")
            if dpr_status_filter and dpr_s.lower() != dpr_status_filter.lower():
                # For "Pending" filter, also include "Reviewed" DPRs (awaiting admin approval)
                if not (dpr_status_filter.lower() == "pending" and dpr_s == "Reviewed"):
                    continue
            dpr_entry = {
                "id": dpr.get("id", ""),
                "project_id": proj_id,
                "project_name": proj_name,
                "date": dpr.get("date", ""),
                "submitted_by": dpr.get("submitted_by", ""),
                "status": dpr_s,
                "status_updated_by": dpr.get("status_updated_by", ""),
                "created_at": dpr.get("created_at", ""),
                "progress": dpr.get("progress", ""),
                "weather": dpr.get("weather", "")
            }
            resolve_names(dpr_entry)
            dpr_list.append(dpr_entry)
    # Sort by created_at descending
    dpr_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    results["dprs"] = dpr_list

    return results

@router.get("/pending", response_model=Dict[str, List[Any]])
async def get_pending_approvals(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Legacy wrapper for older clients
    return await get_all_approvals("Pending", current_user, db)

from fastapi import Body

@router.put("/{type}/{obj_id}/{action}", dependencies=[Depends(RBACPermission("Approvals", "edit"))])
async def action_approval(type: str, obj_id: str, action: str, request_data: dict = Body(default={}), current_user=Depends(get_current_user), db=Depends(get_database)):
    from bson import ObjectId

    status = "Approved" if action.lower() == "approve" else ("Completed" if action.lower() == "complete" else "Rejected")
    reason = request_data.get("reason", "")
    
    update_fields = {"status": status, "approvedBy": current_user.get("full_name") or current_user.get("username", "Admin")}
    if reason:
        update_fields["remarks"] = reason
    
    try:
        if type != "dprs":
            oid = validate_object_id(obj_id, "approval item")

        if type == "leaves":
            await db.leaves.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "purchase_orders":
            await db.purchase_orders.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "materials":
            await db.material_requests.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "expenses":
            await db.expenses.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "manpower":
            await db.manpower_requests.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "dprs":
            # Bug 4.7 - DPR approval via approvals center
            # obj_id format: "project_id:dpr_id"
            parts = obj_id.split(":")
            if len(parts) != 2:
                raise HTTPException(status_code=400, detail="DPR ID must be in format project_id:dpr_id")
            project_id, dpr_id = parts
            from datetime import datetime

            # Role-based workflow: Coordinator -> Reviewed, Admin -> Approved
            user_role = (current_user.get("role") or "").strip()
            is_admin = user_role in ("Super Admin", "Administrator", "Admin", "Managing Director")
            is_coordinator = "coordinator" in user_role.lower()

            if action.lower() == "approve":
                # Get current DPR status
                proj = await db.projects.find_one(
                    {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                    {"dprs.$": 1}
                )
                current_dpr_status = "Pending"
                if proj and proj.get("dprs"):
                    current_dpr_status = proj["dprs"][0].get("status", "Pending")

                if is_coordinator and not is_admin and current_dpr_status == "Pending":
                    status = "Reviewed"
                else:
                    status = "Approved"

            dpr_update = {
                "dprs.$.status": status,
                "dprs.$.status_updated_by": update_fields["approvedBy"],
                "dprs.$.status_updated_at": datetime.now().isoformat()
            }
            await db.projects.update_one(
                {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                {"$set": dpr_update}
            )
        
        return {"message": "Success", "status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
