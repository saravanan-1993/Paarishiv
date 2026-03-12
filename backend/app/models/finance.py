from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ExpenseBase(BaseModel):
    category: Optional[str] = "Others"
    amount: float
    project: Optional[str] = "General" # Project name
    project_id: Optional[str] = None
    payee: Optional[str] = None
    paymentMode: Optional[str] = "Bank"
    reference: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    grn_id: Optional[str] = None
    voucher_no: Optional[str] = None
    invoice_no: Optional[str] = None
    base_amount: Optional[float] = 0
    gst_amount: Optional[float] = 0
    approved_by: Optional[str] = None
    receipt_url: Optional[str] = None
    mark_as_paid: Optional[bool] = False
    items: Optional[list] = None
    total_amount: Optional[float] = None
    status: Optional[str] = "Pending"

class ExpenseCreate(ExpenseBase):
    pass

class BudgetAllocation(BaseModel):
    project_id: str
    total_budget: float
    allocated_categories: dict # {"Material": 100000, "Labour": 50000}
    updated_at: datetime = Field(default_factory=datetime.now)
