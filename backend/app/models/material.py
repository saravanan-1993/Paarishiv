from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MaterialBase(BaseModel):
    name: str
    category: str
    unit: str # kg, bags, meters, etc.
    min_stock_level: float = 0
    current_stock: float = 0
    stock_handling_type: str = "Direct Site" # "Direct Site" or "Warehouse Controlled"

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    name: Optional[str]
    category: Optional[str]
    unit: Optional[str]
    min_stock_level: Optional[float]
    current_stock: Optional[float]

class InventoryLog(BaseModel):
    material_id: str
    quantity: float
    type: str # "Received", "Issued"
    project_id: Optional[str]
    remark: Optional[str]
    created_at: datetime = Field(default_factory=datetime.now)
