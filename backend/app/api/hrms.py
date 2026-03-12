from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.hrms import AttendanceBase, LeaveBase, PayrollBase
from database import get_database
from bson import ObjectId
from datetime import datetime, timedelta
import calendar

router = APIRouter(prefix="/hrms", tags=["hrms"])

# ── Settings ────────────────────────────────────────────────────────────────
@router.get("/settings")
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

@router.post("/settings")
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

@router.get("/dashboard/stats")
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
    
    return {
        "totalEmployees": total_employees,
        "todayPresent": today_present,
        "pendingLeaves": pending_leaves,
        "monthlyPayable": monthly_payable + daily_wage_payable
    }

# ── Attendance ───────────────────────────────────────────────────────────────

@router.get("/attendance", response_model=List[dict])
async def get_attendance(date: Optional[str] = None, db = Depends(get_database)):
    query = {}
    if date:
        query["date"] = date
    records = await db.attendance.find(query).to_list(1000)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.get("/attendance/range", response_model=List[dict])
async def get_attendance_range(from_date: str, to_date: str, db = Depends(get_database)):
    query = {
        "date": {"$gte": from_date, "$lte": to_date}
    }
    records = await db.attendance.find(query).sort("date", 1).to_list(2000)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.post("/attendance")
async def save_attendance(records: List[AttendanceBase], db = Depends(get_database)):
    for record in records:
        data = record.dict()
        # Find if record already exists for this employee and date (using multiple possible ID fields for robustness)
        await db.attendance.update_one(
            {
                "$or": [
                    {"employeeId": data["employeeId"]},
                    {"username": data["employeeId"]},
                    {"user_id": data["employeeId"]}
                ],
                "date": data["date"]
            },
            {"$set": data},
            upsert=True
        )
    return {"success": True}

# ── Leaves ────────────────────────────────────────────────────────────────────

@router.get("/leaves", response_model=List[dict])
async def get_leaves(db = Depends(get_database)):
    leaves = await db.leaves.find().sort("fromDate", -1).to_list(500)
    for l in leaves:
        l["id"] = str(l["_id"])
        del l["_id"]
    return leaves

@router.post("/leaves")
async def apply_leave(leave: LeaveBase, db = Depends(get_database)):
    result = await db.leaves.insert_one(leave.dict())
    
    # Logic: If leave is approved (e.g. applied by HR/Admin directly), mark attendance
    # For now, just insert the leave request
    return {"id": str(result.inserted_id)}

@router.put("/leaves/{leave_id}")
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

@router.get("/payroll", response_model=List[dict])
async def get_payroll(month: str, db = Depends(get_database)):
    records = await db.payroll.find({"month": month}).to_list(500)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.post("/payroll/generate")
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
            "date": {"$regex": f"^{month}"},
            "status": "Present"
        })
        
        leave_days = await db.attendance.count_documents({
            "employeeId": emp_id,
            "date": {"$regex": f"^{month}"},
            "status": "Leave"
        })
        
        lop_days = await db.attendance.count_documents({
            "employeeId": emp_id,
            "date": {"$regex": f"^{month}"},
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
