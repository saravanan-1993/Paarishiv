from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class EmployeeBase(BaseModel):
    fullName: str
    employeeCode: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joiningDate: Optional[str] = None
    dob: Optional[str] = None
    basicSalary: Optional[float] = 0
    hra: Optional[float] = 0
    pfNumber: Optional[str] = None
    esiNumber: Optional[str] = None
    bankAccount: Optional[str] = None
    bankName: Optional[str] = None
    ifsc: Optional[str] = None
    roles: List[str] = []
    status: str = "Active"
    siteId: Optional[str] = None
    siteName: Optional[str] = None
    salaryType: str = "monthly" # monthly, daily
    dailyWage: float = 0.0
    licenseNumber: Optional[str] = None
    licenseExpiry: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    password: str

class EmployeeUpdate(BaseModel):
    fullName: Optional[str] = None
    employeeCode: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joiningDate: Optional[str] = None
    dob: Optional[str] = None
    basicSalary: Optional[float] = None
    hra: Optional[float] = None
    pfNumber: Optional[str] = None
    esiNumber: Optional[str] = None
    bankAccount: Optional[str] = None
    bankName: Optional[str] = None
    ifsc: Optional[str] = None
    status: Optional[str] = None
    roles: Optional[List[str]] = None
    password: Optional[str] = None
    siteId: Optional[str] = None
    salaryType: Optional[str] = None
    dailyWage: Optional[float] = None
    licenseNumber: Optional[str] = None
    licenseExpiry: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }
