from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AttendanceRecord(BaseModel):
    user_id: str
    username: str
    date: str # YYYY-MM-DD
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str = "Present" # Present, Half-Day, Absent
    work_hours: float = 0
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.now)

class ClockInRequest(BaseModel):
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AttendanceSummary(BaseModel):
    present_days: int
    absent_days: int
    total_hours: float
