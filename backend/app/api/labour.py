from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models.labour import LabourBase, Attendance
from database import get_database

router = APIRouter(prefix="/labour", tags=["labour"])

@router.get("/", response_model=List[LabourBase])
async def get_labour(db = Depends(get_database)):
    labour_list = await db.labour.find().to_list(100)
    return labour_list

@router.post("/", response_model=LabourBase)
async def create_labour(labour: LabourBase, db = Depends(get_database)):
    result = await db.labour.insert_one(labour.dict())
    return {**labour.dict(), "id": str(result.inserted_id)}

@router.post("/attendance")
async def record_attendance(attendance: Attendance, db = Depends(get_database)):
    result = await db.attendance.insert_one(attendance.dict())
    return {"id": str(result.inserted_id), **attendance.dict()}
