from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AttendanceBase(BaseModel):
    employeeId: str
    employeeName: str
    date: str # YYYY-MM-DD
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    siteId: Optional[str] = None
    siteName: Optional[str] = None
    status: str # Present, Absent, Half Day, Leave
    workHours: float = 0.0

class LeaveBase(BaseModel):
    employeeId: str
    employeeName: str
    fromDate: str
    toDate: str
    leaveType: str # CL, SL, LOP, EL
    reason: Optional[str] = None
    status: str = "Pending" # Pending, Approved, Rejected
    approvedBy: Optional[str] = None
    remarks: Optional[str] = None

class PayrollBase(BaseModel):
    employeeId: str
    employeeName: str
    month: str # YYYY-MM
    totalDays: int
    presentDays: int
    leaveDays: int
    lopDays: int
    advanceAmount: float = 0.0
    incentives: float = 0.0
    deductions: float = 0.0
    netSalary: float
    status: str = "Draft" # Draft, Processed, Paid
    processedAt: Optional[datetime] = None

class EmployeeHRMSExt(BaseModel):
    # Extension for Employee Master specific to the new requirements
    siteId: Optional[str] = None
    salaryType: str = "monthly" # monthly, daily
    dailyWage: float = 0.0
