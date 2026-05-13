from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from app.models.attendance import AttendanceRecord, ClockInRequest, AttendanceSummary
from app.utils.auth import get_current_user
from app.utils.rbac import RBACPermission, is_admin_role, role_in, get_users_with_permission
from app.utils.notifications import notify, EVENT_HR
from database import get_database
from datetime import datetime, timedelta
from bson import ObjectId
import math
import re

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
            # Case A — existing record was ALREADY closed (check_out set). Treat
            # this clock-in as a fresh new session: reset check_in to now, clear
            # check_out so the dashboard timer restarts from the new check_in.
            # The previous session's work_hours are kept (last clock-out total)
            # and breaks history is cleared for the new session.
            if existing.get("check_out"):
                now = datetime.now()
                await db.attendance.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "check_in": now,
                        "check_out": None,
                        "on_break": False,
                        "breaks": [],
                        "location": req.location or existing.get("location", "Site Office"),
                        "latitude": req.latitude if req.latitude is not None else existing.get("latitude"),
                        "longitude": req.longitude if req.longitude is not None else existing.get("longitude"),
                        "status": "Present",
                    }}
                )
                fresh = await db.attendance.find_one({"_id": existing["_id"]})
                fresh["id"] = str(fresh.pop("_id"))
                for k, v in fresh.items():
                    if isinstance(v, datetime): fresh[k] = v.isoformat(timespec='seconds')
                return {"message": "Clocked in (new session)", **fresh}

            # Case B — open session still running. Block with a clear 409 so the
            # frontend can show a meaningful toast instead of silently no-op'ing.
            existing_ci = existing.get("check_in")
            ci_str = existing_ci.strftime("%I:%M %p") if isinstance(existing_ci, datetime) else "earlier today"
            raise HTTPException(
                status_code=409,
                detail=f"You're already clocked in since {ci_str}. Clock out first to start a new session."
            )
        
        # Geofencing check — admin-class users and HR Manager bypass site fencing.
        # Uses dynamic helper for whitespace/case tolerance.
        is_admin = is_admin_role(current_user.get("role")) or role_in(current_user.get("role"), ["HR Manager"])
        
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
            "created_at": datetime.now(),
        }
        
        result = await db.attendance.insert_one(record)
        print(f"Clock-in successful for {username}. ID: {result.inserted_id}")

        record["id"] = str(result.inserted_id)
        if "_id" in record: record.pop("_id")

        # T2.8 — Late arrival detection (after 9:30 AM)
        try:
            from datetime import time as _time
            LATE_THRESHOLD = _time(9, 30)
            clock_in_time = datetime.now().time()
            if clock_in_time > LATE_THRESHOLD:
                actor = current_user.get("full_name") or username
                recipients = await get_users_with_permission(db, "HRMS", "edit")
                await notify(db, actor, recipients, EVENT_HR,
                    "Late Clock-in",
                    f"{actor} clocked in late at {clock_in_time.strftime('%I:%M %p')}.",
                    entity_type="attendance", entity_id=str(result.inserted_id),
                    priority="low")
        except Exception:
            pass

        # Format for JSON
        record["check_in"] = record["check_in"].isoformat(timespec='seconds')
        record["created_at"] = record["created_at"].isoformat(timespec='seconds')

        return record
    except Exception as e:
        print(f"CRITICAL ERROR in clock_in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Break / Official Duty / Permission tracking has been retired — the attendance
# model now only tracks check-in / check-out time. The old endpoints are kept
# as no-ops to avoid breaking any cached frontend that still calls them.
@router.post("/start-break")
async def start_break(req: BreakRequest = None, current_user = Depends(get_current_user), db = Depends(get_database)):
    return {"message": "Break tracking is disabled"}

@router.post("/end-break")
async def end_break(current_user = Depends(get_current_user), db = Depends(get_database)):
    return {"message": "Break tracking is disabled"}

@router.post("/clock-out")
async def clock_out(req: Optional[ClockInRequest] = None, current_user = Depends(get_current_user), db = Depends(get_database)):
    today = datetime.now().strftime("%Y-%m-%d")
    username = current_user["username"]
    
    existing = await db.attendance.find_one({"username": username, "date": today})
    if not existing:
        raise HTTPException(status_code=404, detail="No clock-in record found for today")

    # Geofencing check for check-out — admin-class users and HR Manager bypass.
    # Uses dynamic helper (consistent with clock-in line ~53). HR Manager kept
    # as explicit fallback to preserve existing behavior.
    is_admin = is_admin_role(current_user.get("role")) or role_in(current_user.get("role"), ["HR Manager"])
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

    # Simplified work-hours: pure (check_out − check_in). Break / official-duty
    # subtraction has been removed.
    duration = check_out_time - check_in_time
    work_hours = round(max(0, duration.total_seconds() / 3600), 2)

    await db.attendance.update_one(
        {"_id": existing["_id"]},
        {"$set": {"check_out": check_out_time, "work_hours": work_hours}}
    )

    return {"message": "Clocked out successfully", "work_hours": work_hours}

@router.get("/me/summary")
async def get_my_summary(current_user = Depends(get_current_user), db = Depends(get_database)):
    try:
        username = current_user.get("username")
        today = datetime.now().strftime("%Y-%m-%d")

        session = await db.attendance.find_one({"username": username, "date": today})

        now = datetime.now()
        month_start = f"{now.year}-{now.month:02d}"
        records = await db.attendance.find({
            "username": username,
            "date": {"$regex": f"^{re.escape(month_start)}"}
        }).to_list(100)

        # Proper present/leave/absent calculation
        present = sum(1 for r in records if r.get("status") == "Present")
        leave_days = sum(1 for r in records if r.get("status") == "Leave")
        total_hours = sum(r.get("work_hours", 0) for r in records)

        # Calculate working days elapsed (exclude Sundays)
        first_day = now.replace(day=1)
        working_days_elapsed = 0
        current_day = first_day
        while current_day <= now:
            if current_day.weekday() != 6:  # 6 = Sunday
                working_days_elapsed += 1
            current_day += timedelta(days=1)

        absent_days = max(0, working_days_elapsed - present - leave_days)

        return {
            "present_days": present,
            "leave_days": leave_days,
            "absent_days": absent_days,
            "total_hours": round(total_hours, 2),
            "working_days": working_days_elapsed,
            "current_session": {
                "check_in": session["check_in"].isoformat(timespec='seconds') if session and session.get("check_in") else None,
                "check_out": session["check_out"].isoformat(timespec='seconds') if session and session.get("check_out") else None,
            } if session else None
        }
    except Exception as e:
        print(f"Error in get_my_summary: {str(e)}")
        return {
            "present_days": 0, "leave_days": 0, "absent_days": 0, "total_hours": 0, "working_days": 0, "current_session": None, "error": str(e)
        }

@router.get("/{username}/summary", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_user_summary(username: str, db = Depends(get_database)):
    now = datetime.now()
    month_prefix = f"{now.year}-{now.month:02d}"
    records = await db.attendance.find({
        "username": username,
        "date": {"$regex": f"^{re.escape(month_prefix)}"}
    }).to_list(100)

    present = sum(1 for r in records if r.get("status") == "Present")
    leave_days = sum(1 for r in records if r.get("status") == "Leave")
    total_hours = sum(r.get("work_hours", 0) for r in records)

    # Calculate working days elapsed (exclude Sundays)
    first_day = now.replace(day=1)
    working_days_elapsed = 0
    current_day = first_day
    while current_day <= now:
        if current_day.weekday() != 6:
            working_days_elapsed += 1
        current_day += timedelta(days=1)

    absent_days = max(0, working_days_elapsed - present - leave_days)

    return {
        "present_days": present,
        "leave_days": leave_days,
        "absent_days": absent_days,
        "total_hours": round(total_hours, 2),
        "working_days": working_days_elapsed
    }
