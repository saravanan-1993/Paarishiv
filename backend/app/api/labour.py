from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models.labour import LabourBase, Attendance
from database import get_database
from app.utils.auth import get_current_user
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/labour", tags=["labour"])

@router.get("/", response_model=List[LabourBase], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_labour(db = Depends(get_database)):
    labour_list = await db.labour.find().to_list(100)
    return labour_list

@router.post("/", response_model=LabourBase, dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def create_labour(labour: LabourBase, db = Depends(get_database)):
    result = await db.labour.insert_one(labour.dict())
    return {**labour.dict(), "id": str(result.inserted_id)}

@router.post("/attendance", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def record_attendance(attendance: Attendance, db = Depends(get_database)):
    result = await db.attendance.insert_one(attendance.dict())
    return {"id": str(result.inserted_id), **attendance.dict()}
