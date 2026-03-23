from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class VehicleBase(BaseModel):
    vehicleNumber: str
    vehicleType: str  # Tipper, Lorry, JCB, Tractor, etc.
    ownerType: str    # Company, Rental, Own
    fuelType: str
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    rcExpiry: Optional[str] = None
    insuranceExpiry: Optional[str] = None
    fcExpiry: Optional[str] = None
    avgMileage: float = 0.0
    lastServiceDate: Optional[str] = None
    serviceDueKm: Optional[int] = None
    currentKm: int = 0
    status: str = "Active"

class TripExpense(BaseModel):
    category: str  # Driver Bata, Toll, Fuel, Loading/Unloading, Maintenance, Repair, Other
    amount: float
    remarks: Optional[str] = None

class TripBase(BaseModel):
    tripId: str # Auto generated or Custom
    vehicleId: str
    vehicleNumber: str
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    loadType: str
    fromLocation: str
    toLocation: str
    projectId: Optional[str] = None
    projectName: Optional[str] = None
    tripType: str  # Project Trip, Private Trip
    ratePerLoad: float = 0.0
    customerName: Optional[str] = None
    expenses: List[TripExpense] = []
    totalRevenue: float = 0.0
    totalExpense: float = 0.0
    netProfit: float = 0.0
    status: str = "Open" # Open, Closed
    date: datetime = Field(default_factory=datetime.now)
    paymentStatus: str = "Pending" # Pending, Partial, Paid

class MaintenanceRecord(BaseModel):
    vehicleId: str
    date: str
    serviceType: str
    cost: float
    description: Optional[str] = None
    odometer: int

class FuelStock(BaseModel):
    date: datetime = Field(default_factory=datetime.now)
    qty: float
    rate: float
    totalAmount: float
    supplier: Optional[str] = None
    billNo: Optional[str] = None
    site: Optional[str] = None # Project/Site name
    remarks: Optional[str] = None
    addedBy: Optional[str] = None

class FuelLog(BaseModel):
    date: str
    assetId: str
    assetName: str
    site: str
    qty: float
    hoursRun: float
    engineer: str
    type: str = "Consumption" # Consumption, Adjustment
    remarks: Optional[str] = None
