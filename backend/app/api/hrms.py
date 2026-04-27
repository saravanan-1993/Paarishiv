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
from app.utils.notifications import notify, EVENT_HR

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
        total_min = start_h * 60 + start_m + int(grace)
        late_h, late_m = divmod(total_min, 60)
        late_threshold = f"{late_h:02d}:{late_m:02d}"
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

@router.post("/leaves", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def apply_leave(leave: LeaveBase, db = Depends(get_database)):
    # Validate date range
    from_date = getattr(leave, 'fromDate', None) or getattr(leave, 'from_date', None)
    to_date = getattr(leave, 'toDate', None) or getattr(leave, 'to_date', None)
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="To Date cannot be before From Date")

    # Check for overlapping approved leaves
    emp_id = getattr(leave, 'employeeId', None) or getattr(leave, 'employee_id', None)
    if emp_id and from_date and to_date:
        overlap = await db.leaves.find_one({
            "employeeId": emp_id,
            "status": "Approved",
            "$or": [
                {"fromDate": {"$lte": to_date}, "toDate": {"$gte": from_date}},
            ]
        })
        if overlap:
            raise HTTPException(status_code=400, detail=f"Overlapping leave already approved from {overlap.get('fromDate')} to {overlap.get('toDate')}")

    result = await db.leaves.insert_one(leave.dict())

    # Notify HR Manager + Admin about new leave application
    try:
        emp_name = leave.employeeName if hasattr(leave, 'employeeName') else "Employee"
        await notify(db, emp_name, ["HR Manager", "Administrator", "Project Manager"], EVENT_HR,
            "Leave Applied",
            f"{emp_name} applied for {leave.leaveType if hasattr(leave, 'leaveType') else 'leave'} from {leave.fromDate if hasattr(leave, 'fromDate') else ''} to {leave.toDate if hasattr(leave, 'toDate') else ''}",
            entity_type="leave", entity_id=str(result.inserted_id))
    except Exception:
        pass

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
    
    # Notify employee about leave status
    try:
        leave_doc = await db.leaves.find_one({"_id": ObjectId(leave_id)})
        if leave_doc:
            emp_id = leave_doc.get("employeeId", "")
            emp = await db.employees.find_one({"_id": ObjectId(emp_id)}) if ObjectId.is_valid(emp_id) else None
            emp_username = emp.get("employeeCode") or emp.get("username", "") if emp else ""
            if emp_username:
                await notify(db, approved_by or "HR", [emp_username], EVENT_HR,
                    f"Leave {status}",
                    f"Your leave request ({leave_doc.get('fromDate', '')} to {leave_doc.get('toDate', '')}) has been {status.lower()} by {approved_by or 'HR'}" + (f". Remarks: {remarks}" if remarks else ""),
                    entity_type="leave", entity_id=leave_id, priority="high")
    except Exception:
        pass

    # Logic: If Approved, auto-mark attendance as 'Leave' for those dates
    if status == "Approved":
        leave = await db.leaves.find_one({"_id": ObjectId(leave_id)})
        if leave:
            start_date = datetime.strptime(leave["fromDate"], "%Y-%m-%d")
            end_date = datetime.strptime(leave["toDate"], "%Y-%m-%d")
            
            curr = start_date
            while curr <= end_date:
                # Skip Sundays (weekday 6) - don't mark non-working days as Leave
                if curr.weekday() != 6:
                    curr_str = curr.strftime("%Y-%m-%d")
                    # Only mark as Leave if not already Present (don't overwrite attendance)
                    existing = await db.attendance.find_one(
                        {"employeeId": leave["employeeId"], "date": curr_str, "status": "Present"}
                    )
                    if not existing:
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
    # Calculate working days (exclude Sundays)
    working_days = sum(1 for d in range(1, total_days + 1)
                       if datetime(year, mon, d).weekday() != 6)  # 6 = Sunday
    
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
        basic = float(emp.get("basicSalary", 0) or 0)
        daily = float(emp.get("dailyWage", 0) or 0)

        net_salary = 0
        if emp.get("salaryType") == "daily":
            # Daily wage: pay for present days + paid leave days
            net_salary = (present_days + leave_days) * daily
        else:
            # Monthly: Deduct LOP based on working days (not calendar days)
            day_rate = basic / max(working_days, 1)
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
        
    # Notify Admin about payroll generation
    try:
        total_payable = sum(r["netSalary"] for r in payroll_records)
        await notify(db, "HR System", ["Administrator", "General Manager"], EVENT_HR,
            "Payroll Generated",
            f"Payroll generated for {month}: {len(employees)} employees, Total payable: Rs.{total_payable:,.0f}",
            entity_type="payroll", priority="high")
    except Exception:
        pass

    return {"message": f"Payroll generated for {len(employees)} employees", "count": len(employees)}

# ── Master Data (Designations & Departments) ──────────────────────────────────

@router.get("/designations", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_designations(db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Get from master_data collection
    master = await db.master_data.find({"type": "designation"}).to_list(500)
    master_values = [m["value"] for m in master]
    # Also get unique designations from employees
    employees = await db.employees.find({"designation": {"$exists": True, "$ne": ""}}).to_list(5000)
    emp_values = list(set(e.get("designation", "") for e in employees if e.get("designation")))
    # Merge and deduplicate
    all_values = sorted(set(master_values + emp_values))
    return all_values

@router.post("/designations", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def add_designation(data: dict, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    value = data.get("value", "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Designation value is required")
    existing = await db.master_data.find_one({"type": "designation", "value": {"$regex": f"^{re.escape(value)}$", "$options": "i"}})
    if existing:
        return {"message": "Already exists", "value": existing["value"]}
    await db.master_data.insert_one({"type": "designation", "value": value, "created_at": datetime.now(), "created_by": current_user.get("username")})
    return {"message": "Designation added", "value": value}

@router.get("/departments", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_departments(db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    master = await db.master_data.find({"type": "department"}).to_list(500)
    master_values = [m["value"] for m in master]
    employees = await db.employees.find({"department": {"$exists": True, "$ne": ""}}).to_list(5000)
    emp_values = list(set(e.get("department", "") for e in employees if e.get("department")))
    all_values = sorted(set(master_values + emp_values))
    return all_values

@router.post("/departments", dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def add_department(data: dict, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    value = data.get("value", "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Department value is required")
    existing = await db.master_data.find_one({"type": "department", "value": {"$regex": f"^{re.escape(value)}$", "$options": "i"}})
    if existing:
        return {"message": "Already exists", "value": existing["value"]}
    await db.master_data.insert_one({"type": "department", "value": value, "created_at": datetime.now(), "created_by": current_user.get("username")})
    return {"message": "Department added", "value": value}
