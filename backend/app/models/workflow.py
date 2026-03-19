from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DailyProgressReport(BaseModel):
    project_id: str
    engineer_id: str
    date: datetime = Field(default_factory=datetime.now)
    work_done_description: str
    labour_count: int
    material_consumed: List[dict] # [{"material_id": "...", "quantity": 10}]
    site_photo_urls: List[str] = []
    issues_faced: Optional[str]

class MaterialRequest(BaseModel):
    project_id: str
    engineer_id: str
    requested_items: List[dict] # [{"name": "Cement", "quantity": 100, "unit": "bags"}]
    issued_items: List[dict] = [] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]
    priority: str = "Medium" # Low, Medium, High, Urgent
    status: str = "Pending" # Pending, Approved, Rejected, Issued
    required_by_date: datetime
    created_at: datetime = Field(default_factory=datetime.now)

class StockSettlement(BaseModel):
    project_id: str
    engineer_id: str
    request_id: str
    date: datetime = Field(default_factory=datetime.now)
    items: List[dict] # [{"name": "Switch", "issued": 50, "used": 40, "remaining": 10, "action": "Return"}]
    status: str = "Completed" # Completed
