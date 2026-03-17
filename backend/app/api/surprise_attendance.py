from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional
import json
from database import get_database
from app.utils.auth import get_current_user
from datetime import datetime
from bson import ObjectId
from app.utils.cloudinary import upload_file

router = APIRouter(prefix="/surprise-attendance", tags=["surprise-attendance"])

@router.post("/")
async def save_surprise_attendance(
    project_id: str = Form(...),
    project_name: str = Form(...),
    session: str = Form(...), # Morning / Evening
    date: str = Form(...), # YYYY-MM-DD
    location: str = Form(None), # JSON or string
    present_employees: str = Form(...), # JSON list
    remarks: str = Form(None),
    photo: Optional[UploadFile] = File(None),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    # Verify Admin role (Super Admin in the system)
    if "Super Admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Only Admins can mark surprise attendance")

    # Check daily rule: Max 2 sessions per project per day
    count = await db.surprise_attendance.count_documents({
        "project_id": project_id,
        "date": date
    })
    if count >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 surprise visits allowed per day for this project")

    # Photo upload to Cloudinary if provided
    photo_url = None
    if photo:
        content = await photo.read()
        res = await upload_file(content, filename=photo.filename)
        if res:
            photo_url = res.get("url")

    record = {
        "project_id": project_id,
        "project_name": project_name,
        "session": session,
        "date": date,
        "time": datetime.now().strftime("%H:%M:%S"),
        "location": json.loads(location) if location else None,
        "present_employees": json.loads(present_employees),
        "remarks": remarks,
        "photo_url": photo_url,
        "marked_by": current_user["username"],
        "created_at": datetime.now()
    }

    result = await db.surprise_attendance.insert_one(record)
    
    # Also sync with regular attendance if needed? 
    # Requirement says "Store separately... Must not interfere with existing attendance data"
    # So we don't sync.
    
    return {"success": True, "id": str(result.inserted_id)}

@router.get("/")
async def get_surprise_attendance(
    project_id: Optional[str] = None,
    date: Optional[str] = None,
    db = Depends(get_database)
):
    query = {}
    if project_id:
        query["project_id"] = project_id
    if date:
        query["date"] = date
        
    records = await db.surprise_attendance.find(query).sort("created_at", -1).to_list(100)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records
