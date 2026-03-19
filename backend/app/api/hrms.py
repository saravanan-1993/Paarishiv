from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.hrms import AttendanceBase, LeaveBase, PayrollBase
from database import get_database
from bson import ObjectId
from datetime import datetime, timedelta
import calendar
import re
from app.utils.auth import get_current_user
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/hrms", tags=["hrms"])

# ── Settings ────────────────────────────────────────────────────────────────
@router.get("/settings", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_hrms_settings(db = Depends(get_database)):
    settings = await db.settings.find_one({"type": "hrms_config"})
    if not settings:
        # Default settings
        return {
            "officeStartTime": "09:00",
            "gracePeriod": 15,
            "workAnniversaryWishes": True,
            "birthdayWishes": True
        }
    settings["id"] = str(settings["_id"])
    del settings["_id"]
    return settings

@router.post("/settings", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def update_hrms_settings(data: dict, db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "hrms_config"
    await db.settings.update_one(
        {"type": "hrms_config"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_hrms_stats(db = Depends(get_database)):
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    month_str = now.strftime("%Y-%m")
    
    total_employees = await db.employees.count_documents({"status": "Active"})
    today_present = await db.attendance.count_documents({"date": today_str, "status": "Present"})
    pending_leaves = await db.leaves.count_documents({"status": "Pending"})
    
    # Calculate this month's salary payable (sum of basicSalary for active employees)
    active_employees = await db.employees.find({"status": "Active"}).to_list(1000)
    monthly_payable = sum(float(emp.get("basicSalary", 0) or 0) for emp in active_employees if emp.get("salaryType") in ["monthly", None])
    daily_wage_payable = sum(float(emp.get("dailyWage", 0) or 0) * 25 for emp in active_employees if emp.get("salaryType") == "daily") # Estimate 25 days
    
    # Bug 2.1 - Today's birthdays and latecomers
    today_mm_dd = now.strftime("-%m-%d")  # e.g. "-03-18"
    birthdays = []
    for emp in active_employees:
        dob = emp.get("dob") or emp.get("dateOfBirth") or ""
        if isinstance(dob, datetime):
            dob = dob.strftime("%Y-%m-%d")
        if dob and dob.endswith(today_mm_dd):
            birthdays.append({"name": emp.get("fullName", ""), "employeeCode": emp.get("employeeCode", "")})

    # Latecomers - employees who clocked in after office start time
    hrms_settings = await db.settings.find_one({"type": "hrms_config"})
    office_start = (hrms_settings or {}).get("officeStartTime", "09:00")
    grace = (hrms_settings or {}).get("gracePeriod", 15)
    try:
        start_h, start_m = map(int, office_start.split(":"))
        late_threshold = f"{start_h:02d}:{(start_m + grace):02d}"
    except Exception:
        late_threshold = "09:15"
    today_attendance = await db.attendance.find({"date": today_str}).to_list(1000)
    latecomers_count = sum(1 for a in today_attendance if (a.get("clockIn") or "") > late_threshold and a.get("status") == "Present")

    return {
        "totalEmployees": total_employees,
        "todayPresent": today_present,
        "pendingLeaves": pending_leaves,
        "monthlyPayable": monthly_payable + daily_wage_payable,
        "latecomers": latecomers_count,
        "birthdays": birthdays
    }

# ── Attendance ───────────────────────────────────────────────────────────────

@router.get("/attendance", response_model=List[dict], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_attendance(date: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if date:
        query["date"] = date
    records = await db.attendance.find(query).to_list(1000)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.get("/attendance/range", response_model=List[dict], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_attendance_range(from_date: str, to_date: str, db = Depends(get_database)):
    query = {
        "date": {"$gte": from_date, "$lte": to_date}
    }
    records = await db.attendance.find(query).sort("date", 1).to_list(2000)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.post("/attendance", dependencies=[Depends(RBACPermission("HRMS", "edit", "Attendance"))])
async def save_attendance(records: List[AttendanceBase], db = Depends(get_database)):
    for record in records:
        data = record.dict()
        emp_id = data["employeeId"]

        # Bug 2.2 & 2.4 - Remove all duplicate entries first, then insert single record
        await db.attendance.delete_many({
            "$or": [
                {"employeeId": emp_id, "date": data["date"]},
                {"username": emp_id, "date": data["date"]},
                {"user_id": emp_id, "date": data["date"]}
            ]
        })

        # Upsert the single correct record using employeeId as the primary key
        await db.attendance.update_one(
            {"employeeId": emp_id, "date": data["date"]},
            {"$set": data},
            upsert=True
        )
    return {"success": True}

# ── Leaves ────────────────────────────────────────────────────────────────────

@router.get("/leaves", response_model=List[dict], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_leaves(db = Depends(get_database)):
    leaves = await db.leaves.find().sort("fromDate", -1).to_list(500)
    for l in leaves:
        l["id"] = str(l["_id"])
        del l["_id"]
    return leaves

@router.post("/leaves", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def apply_leave(leave: LeaveBase, db = Depends(get_database)):
    result = await db.leaves.insert_one(leave.dict())
    
    # Logic: If leave is approved (e.g. applied by HR/Admin directly), mark attendance
    # For now, just insert the leave request
    return {"id": str(result.inserted_id)}

@router.put("/leaves/{leave_id}", dependencies=[Depends(RBACPermission("HRMS", "edit", "Leave Management"))])
async def update_leave_status(leave_id: str, status_update: dict, db = Depends(get_database)):
    status = status_update.get("status")
    approved_by = status_update.get("approvedBy")
    remarks = status_update.get("remarks")
    
    await db.leaves.update_one(
        {"_id": ObjectId(leave_id)},
        {"$set": {"status": status, "approvedBy": approved_by, "remarks": remarks}}
    )
    
    # Logic: If Approved, auto-mark attendance as 'Leave' for those dates
    if status == "Approved":
        leave = await db.leaves.find_one({"_id": ObjectId(leave_id)})
        if leave:
            start_date = datetime.strptime(leave["fromDate"], "%Y-%m-%d")
            end_date = datetime.strptime(leave["toDate"], "%Y-%m-%d")
            
            curr = start_date
            while curr <= end_date:
                curr_str = curr.strftime("%Y-%m-%d")
                await db.attendance.update_one(
                    {"employeeId": leave["employeeId"], "date": curr_str},
                    {"$set": {
                        "employeeId": leave["employeeId"],
                        "employeeName": leave["employeeName"],
                        "date": curr_str,
                        "status": "Leave",
                        "remarks": f"Leave Approved ID: {leave_id}"
                    }},
                    upsert=True
                )
                curr += timedelta(days=1)

    return {"success": True}

# ── Payroll ───────────────────────────────────────────────────────────────────

@router.get("/payroll", response_model=List[dict], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_payroll(month: str, db = Depends(get_database)):
    records = await db.payroll.find({"month": month}).to_list(500)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.post("/payroll/generate", dependencies=[Depends(RBACPermission("HRMS", "edit", "Payroll"))])
async def generate_payroll(month: str, db = Depends(get_database)):
    # 1. Get all active employees
    employees = await db.employees.find({"status": "Active"}).to_list(1000)
    
    year, mon = map(int, month.split('-'))
    total_days = calendar.monthrange(year, mon)[1]
    
    payroll_records = []
    
    for emp in employees:
        emp_id = str(emp["_id"])
        # 2. Count present days and leaves from attendance
        present_days = await db.attendance.count_documents({
            "employeeId": emp_id,
            "date": {"$regex": f"^{re.escape(month)}"},
            "status": "Present"
        })
        
        leave_days = await db.attendance.count_documents({
            "employeeId": emp_id,
            "date": {"$regex": f"^{re.escape(month)}"},
            "status": "Leave"
        })
        
        lop_days = await db.attendance.count_documents({
            "employeeId": emp_id,
            "date": {"$regex": f"^{re.escape(month)}"},
            "status": "Absent"
        })
        
        # 3. Calculate salary
        basic = emp.get("basicSalary", 0)
        daily = emp.get("dailyWage", 0)
        
        net_salary = 0
        if emp.get("salaryType") == "daily":
            net_salary = (present_days + leave_days) * daily # Adjust if leaves are paid or unpaid
        else:
            # Monthly: Deduct LOP
            day_rate = basic / total_days
            net_salary = basic - (lop_days * day_rate)
            
        record = {
            "employeeId": emp_id,
            "employeeName": emp.get("fullName"),
            "month": month,
            "totalDays": total_days,
            "presentDays": present_days,
            "leaveDays": leave_days,
            "lopDays": lop_days,
            "netSalary": round(net_salary, 2),
            "status": "Draft"
        }
        
        await db.payroll.update_one(
            {"employeeId": record["employeeId"], "month": month},
            {"$set": record},
            upsert=True
        )
        payroll_records.append(record)
        
    return {"message": f"Payroll generated for {len(employees)} employees", "count": len(employees)}
