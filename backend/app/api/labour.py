from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.labour import LabourBase, Attendance
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import RBACPermission
from app.utils.logging import log_activity
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/labour", tags=["labour"])

@router.get("/", response_model=List[LabourBase], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_labour(project_id: Optional[str] = None, category: Optional[str] = None, db=Depends(get_database)):
    query = {}
    if project_id:
        query["current_project_id"] = project_id
    if category:
        query["category"] = category
    labour_list = await db.labour.find(query).to_list(500)
    for l in labour_list:
        l["_id"] = str(l["_id"])
    return labour_list

@router.post("/", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def create_labour(labour: LabourBase, db=Depends(get_database), current_user=Depends(get_current_user)):
    labour_dict = labour.dict()
    labour_dict["created_at"] = datetime.now()
    labour_dict["status"] = "Active"
    result = await db.labour.insert_one(labour_dict)
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"],
                       "Create Labour", f"Labour '{labour.name}' added ({labour.category})", "info")
    return {"id": str(result.inserted_id), **labour_dict}

@router.put("/{labour_id}", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def update_labour(labour_id: str, data: dict, db=Depends(get_database), current_user=Depends(get_current_user)):
    oid = validate_object_id(labour_id, "labour")
    existing = await db.labour.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Labour record not found")
    valid_fields = ["name", "contact", "category", "daily_wage", "current_project_id", "status", "skills", "address", "aadhar"]
    update_data = {k: v for k, v in data.items() if k in valid_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.labour.update_one({"_id": oid}, {"$set": update_data})
    updated = await db.labour.find_one({"_id": oid})
    updated["_id"] = str(updated["_id"])
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"],
                       "Update Labour", f"Labour '{existing.get('name', labour_id)}' updated", "info")
    return updated

@router.delete("/{labour_id}", dependencies=[Depends(RBACPermission("HRMS", "delete"))])
async def delete_labour(labour_id: str, db=Depends(get_database), current_user=Depends(get_current_user)):
    oid = validate_object_id(labour_id, "labour")
    existing = await db.labour.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Labour record not found")
    await db.labour.delete_one({"_id": oid})
    await log_activity(db, str(current_user.get("_id", current_user["username"])), current_user["username"],
                       "Delete Labour", f"Labour '{existing.get('name', labour_id)}' deleted", "warning")
    return {"success": True, "message": "Labour record deleted"}

@router.post("/attendance", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def record_attendance(attendance: Attendance, db=Depends(get_database)):
    result = await db.attendance.insert_one(attendance.dict())
    return {"id": str(result.inserted_id), **attendance.dict()}

@router.get("/{labour_id}", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_labour_by_id(labour_id: str, db=Depends(get_database)):
    oid = validate_object_id(labour_id, "labour")
    labour = await db.labour.find_one({"_id": oid})
    if not labour:
        raise HTTPException(status_code=404, detail="Labour record not found")
    labour["_id"] = str(labour["_id"])
    return labour
