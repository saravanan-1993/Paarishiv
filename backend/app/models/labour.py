from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LabourBase(BaseModel):
    name: str
    contact: str
    category: str # Skilled, Unskilled, Operator
    daily_wage: float
    current_project_id: Optional[str]

class LabourCreate(LabourBase):
    pass

class Attendance(BaseModel):
    labour_id: str
    date: datetime
    status: str # Present, Absent, Overtime
    overtime_hours: float = 0
    project_id: str
    remark: Optional[str]

class SalaryPayment(BaseModel):
    labour_id: str
    amount: float
    period_start: datetime
    period_end: datetime
    payment_date: datetime = Field(default_factory=datetime.now)
    status: str = "Paid"
