from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from app.models.attendance import AttendanceRecord, ClockInRequest, AttendanceSummary
from app.utils.auth import get_current_user
from database import get_database
from datetime import datetime
from bson import ObjectId
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters using Haversine formula."""
    if None in [lat1, lon1, lat2, lon2]:
        return float('inf')
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

router = APIRouter(prefix="/attendance", tags=["attendance"])

class BreakRequest(BaseModel):
    type: str = "Break"

@router.post("/clock-in")
async def clock_in(req: ClockInRequest, current_user = Depends(get_current_user), db = Depends(get_database)):
    today = datetime.now().strftime("%Y-%m-%d")
    username = current_user.get("username")
    print(f"Clock-in attempt for: {username} at {today}")
    
    try:
        # Check if already clocked in today
        existing = await db.attendance.find_one({"username": username, "date": today})
        if existing:
            print(f"User {username} already clocked in today.")
            existing["id"] = str(existing.pop("_id"))
            for k, v in existing.items():
                if isinstance(v, datetime): existing[k] = v.isoformat()
                if k == "breaks":
                    for bk in v:
                        if bk.get("start") and isinstance(bk["start"], datetime): bk["start"] = bk["start"].isoformat()
                        if bk.get("end") and isinstance(bk["end"], datetime): bk["end"] = bk["end"].isoformat()
            return {"message": "Already clocked in", **existing}
        
        # Geofencing check
        is_admin = current_user.get("role") in ["Super Admin", "Administrator", "HR Manager"]
        
        if not is_admin:
            # 1. Get employee data to find assigned site
            employee = await db.employees.find_one({"username": username})
            if not employee or not employee.get("siteId"):
                # If no site assigned, maybe allow or block? Let's check if there's a default.
                pass 
            else:
                site_id = employee.get("siteId")
                project = await db.projects.find_one({"_id": ObjectId(site_id)})
                if project and project.get("latitude") and project.get("longitude") and req.latitude and req.longitude:
                    dist = calculate_distance(
                        req.latitude, req.longitude, 
                        project.get("latitude"), project.get("longitude")
                    )
                    # Use 500 meters as threshold
                    if dist > 500:
                        raise HTTPException(status_code=400, detail=f"You are too far from the site ({round(dist)}m). Maximum allowed: 500m")

        record = {
            "user_id": str(current_user.get("_id", username)),
            "username": username,
            "employeeId": username,
            "employeeName": current_user.get("full_name") or username,
            "date": today,
            "check_in": datetime.now(),
            "status": "Present",
            "location": req.location or "Site Office",
            "latitude": req.latitude,
            "longitude": req.longitude,
            "on_break": False,
            "breaks": [],
            "created_at": datetime.now()
        }
        
        result = await db.attendance.insert_one(record)
        print(f"Clock-in successful for {username}. ID: {result.inserted_id}")
        
        record["id"] = str(result.inserted_id)
        if "_id" in record: record.pop("_id")
        
        # Format for JSON
        record["check_in"] = record["check_in"].isoformat()
        record["created_at"] = record["created_at"].isoformat()
        
        return record
    except Exception as e:
        print(f"CRITICAL ERROR in clock_in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/start-break")
async def start_break(req: BreakRequest = None, current_user = Depends(get_current_user), db = Depends(get_database)):
    today = datetime.now().strftime("%Y-%m-%d")
    b_type = req.type if req else "Break"
    username = current_user["username"]
    existing = await db.attendance.find_one({"username": username, "date": today})
    if not existing:
        raise HTTPException(status_code=400, detail="Must clock in first")
    if existing.get("on_break"): return {"message": "Already on break"}
    
    await db.attendance.update_one(
        {"_id": existing["_id"]},
        {"$set": {"on_break": True}, "$push": {"breaks": {"start": datetime.now(), "end": None, "type": b_type}}}
    )
    return {"message": "Break started"}

@router.post("/end-break")
async def end_break(current_user = Depends(get_current_user), db = Depends(get_database)):
    today = datetime.now().strftime("%Y-%m-%d")
    username = current_user["username"]
    existing = await db.attendance.find_one({"username": username, "date": today})
    if not existing or not existing.get("on_break"):
        raise HTTPException(status_code=400, detail="Not on break")
    
    breaks = existing.get("breaks", [])
    last_break = breaks[-1]
    end_time = datetime.now()
    duration = (end_time - last_break["start"]).total_seconds() / 3600
    
    await db.attendance.update_one(
        {"_id": existing["_id"], "breaks.start": last_break["start"]},
        {"$set": {"on_break": False, "breaks.$.end": end_time, "breaks.$.duration": duration}}
    )
    return {"message": "Break ended"}

@router.post("/clock-out")
async def clock_out(req: Optional[ClockInRequest] = None, current_user = Depends(get_current_user), db = Depends(get_database)):
    today = datetime.now().strftime("%Y-%m-%d")
    username = current_user["username"]
    
    existing = await db.attendance.find_one({"username": username, "date": today})
    if not existing:
        raise HTTPException(status_code=404, detail="No clock-in record found for today")

    # Geofencing check for check-out
    is_admin = current_user.get("role") in ["Super Admin", "Administrator", "HR Manager"]
    if not is_admin and req and req.latitude and req.longitude:
        employee = await db.employees.find_one({"username": username})
        if employee and employee.get("siteId"):
            project = await db.projects.find_one({"_id": ObjectId(employee["siteId"])})
            if project and project.get("latitude") and project.get("longitude") and req.latitude and req.longitude:
                dist = calculate_distance(req.latitude, req.longitude, project["latitude"], project["longitude"])
                if dist > 500:
                    raise HTTPException(status_code=400, detail=f"You must be at the site to check out. Current distance: {round(dist)}m")
    
    check_out_time = datetime.now()
    check_in_time = existing["check_in"]
    
    # End break if still on break
    on_bk = existing.get("on_break", False)
    breaks = existing.get("breaks", [])
    if on_bk:
        last_bk = breaks[-1]
        last_bk["end"] = check_out_time
        last_bk["duration"] = (check_out_time - last_bk["start"]).total_seconds() / 3600
        breaks[-1] = last_bk
    
    total_break_hours = sum(b.get("duration", 0) for b in breaks if b.get("type", "Break") != "Official Duty")
    duration = check_out_time - check_in_time
    gross_hours = duration.total_seconds() / 3600
    work_hours = round(max(0, gross_hours - total_break_hours), 2)
    
    await db.attendance.update_one(
        {"_id": existing["_id"]},
        {"$set": {"check_out": check_out_time, "work_hours": work_hours, "breaks": breaks, "on_break": False}}
    )
    
    return {"message": "Clocked out successfully", "work_hours": work_hours}

@router.get("/me/summary")
async def get_my_summary(current_user = Depends(get_current_user), db = Depends(get_database)):
    try:
        username = current_user.get("username")
        today = datetime.now().strftime("%Y-%m-%d")
        
        session = await db.attendance.find_one({"username": username, "date": today})
        
        now = datetime.now()
        # Find all records for the current month
        month_start = f"{now.year}-{now.month:02d}"
        records = await db.attendance.find({
            "username": username,
            "date": {"$regex": f"^{month_start}"}
        }).to_list(100)
        
        present = len(records)
        total_hours = sum(r.get("work_hours", 0) for r in records)
        
        return {
            "present_days": present,
            "absent_days": 0,
            "total_hours": round(total_hours, 2),
            "current_session": {
                "check_in": session["check_in"].isoformat() if session and session.get("check_in") else None,
                "check_out": session["check_out"].isoformat() if session and session.get("check_out") else None,
                "on_break": session.get("on_break", False),
                "breaks": [
                    {
                        **b, 
                        "start": b["start"].isoformat() if b.get("start") else None,
                        "end": b["end"].isoformat() if b.get("end") else None
                    } for b in session.get("breaks", [])
                ] if session else []
            } if session else None
        }
    except Exception as e:
        print(f"Error in get_my_summary: {str(e)}")
        return {
            "present_days": 0, "absent_days": 0, "total_hours": 0, "current_session": None, "error": str(e)
        }

@router.get("/{username}/summary")
async def get_user_summary(username: str, db = Depends(get_database)):
    now = datetime.now()
    records = await db.attendance.find({
        "username": username,
        "date": {"$regex": f"^{now.year}-{now.month:02d}"}
    }).to_list(100)
    
    present = len(records)
    total_hours = sum(r.get("work_hours", 0) for r in records)
    
    # Logic to return 0 for non-existent users
    return {
        "present_days": present,
        "absent_days": 1, # Mocking 1 absent day
        "total_hours": total_hours
    }
