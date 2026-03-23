from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from app.api.auth import get_current_user
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/vendors", tags=["vendors"])

class VendorBase(BaseModel):
    name: str
    category: str
    type: str = "Material Supplier"
    rate_card: list = []
    gstin: str = ""
    contact: str = ""
    phone: str = ""
    email: Optional[str] = ""
    location: str = ""
    status: str = "Active"

class VendorCreate(VendorBase):
    pass

class VendorUpdate(VendorBase):
    pass

class VendorResponse(VendorBase):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

def vendor_helper(vendor) -> dict:
    return {
        "id": str(vendor["_id"]),
        "name": vendor["name"],
        "category": vendor.get("category", ""),
        "type": vendor.get("type", "Material Supplier"),
        "rate_card": vendor.get("rate_card", []),
        "gstin": vendor.get("gstin", ""),
        "contact": vendor.get("contact", ""),
        "phone": vendor.get("phone", ""),
        "email": vendor.get("email", ""),
        "location": vendor.get("location", ""),
        "status": vendor.get("status", "Active"),
        "created_at": vendor.get("created_at")
    }

@router.get("/", response_model=List[dict], dependencies=[Depends(RBACPermission("Procurement", "view"))])
async def get_vendors():
    vendors = await db.vendors.find().to_list(100)
    return [vendor_helper(v) for v in vendors]

@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Procurement", "edit", "Vendors"))])
async def create_vendor(vendor: VendorCreate):
    # Bug 9.3 - Prevent duplicate email entries
    if vendor.email and vendor.email.strip():
        existing = await db.vendors.find_one({"email": vendor.email.strip()})
        if existing:
            raise HTTPException(status_code=400, detail=f"Vendor with email '{vendor.email}' already exists")

    vendor_dict = vendor.model_dump()
    vendor_dict["created_at"] = datetime.now()
    result = await db.vendors.insert_one(vendor_dict)
    new_vendor = await db.vendors.find_one({"_id": result.inserted_id})
    return vendor_helper(new_vendor)

@router.put("/{id}", dependencies=[Depends(RBACPermission("Procurement", "edit", "Vendors"))])
async def update_vendor(id: str, vendor: VendorUpdate):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    await db.vendors.update_one({"_id": ObjectId(id)}, {"$set": vendor.model_dump()})
    updated_vendor = await db.vendors.find_one({"_id": ObjectId(id)})
    if not updated_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_helper(updated_vendor)

@router.delete("/{id}", dependencies=[Depends(RBACPermission("Procurement", "delete", "Vendors"))])
async def delete_vendor(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    delete_result = await db.vendors.delete_one({"_id": ObjectId(id)})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted successfully"}
@router.get("/{id}/ledger", dependencies=[Depends(RBACPermission("Procurement", "view"))])
async def get_vendor_ledger(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    vendor = await db.vendors.find_one({"_id": ObjectId(id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_name = vendor["name"]
    
    # Fetch all POs for this vendor
    pos = await db.purchase_orders.find({"vendor_name": vendor_name}).to_list(1000)
    
    # Fetch all GRNs for these POs
    po_ids = [str(p["_id"]) for p in pos]
    grns = await db.grns.find({"po_id": {"$in": po_ids}}).to_list(1000)
    
    # Fetch all payments (Expenses where payee is this vendor)
    payments = await db.expenses.find({"payee": vendor_name}).to_list(1000)
    
    ledger = []
    
    # Process POs
    for po in pos:
        ledger.append({
            "date": po.get("date") or po.get("created_at"),
            "type": "Purchase Order",
            "ref": f"PO-{str(po['_id'])[-6:].upper()}",
            "amount": float(po.get("total_amount", 0)),
            "method": "-",
            "status": po.get("status", "Pending")
        })
        
    # Process GRNs
    for grn in grns:
        # Calculate GRN value from PO rates or updated GRN prices
        if "total_amount" in grn and float(grn.get("total_amount") or 0) > 0:
            grn_value = float(grn["total_amount"])
        else:
            po = next((p for p in pos if str(p["_id"]) == grn["po_id"]), None)
            grn_value = 0
            for gi in grn.get("items", []):
                grn_price = gi.get("price")
                if grn_price is not None and str(grn_price).strip() != "":
                    try:
                        grn_value += float(gi.get("received_qty", 0)) * float(grn_price)
                        continue
                    except ValueError:
                        pass
                
                if po:
                    matching_po_item = next((pi for pi in po.get("items", []) if pi["name"] == gi["name"]), None)
                    if matching_po_item and matching_po_item.get("rate"):
                        grn_value += float(gi.get("received_qty", 0)) * float(matching_po_item.get("rate", 0))
        
        ledger.append({
            "date": grn.get("created_at"),
            "type": "GRN (Bill)",
            "ref": f"GRN-{str(grn['_id'])[-6:].upper()}",
            "amount": grn_value,
            "method": grn.get("vehicle_number", "-"),
            "status": "Invoiced"
        })
        
    # Process Payments
    for p in payments:
        ledger.append({
            "date": p.get("date"),
            "type": "Payment",
            "ref": p.get("reference") or "-",
            "amount": float(p.get("amount", 0)),
            "method": p.get("paymentMode", "Bank"),
            "status": "Paid"
        })
        
    # Sort by date (descending)
    ledger.sort(key=lambda x: str(x.get("date", "")), reverse=True)
    
    # Calculate stats
    total_po_value = sum(l["amount"] for l in ledger if l["type"] == "Purchase Order")
    total_received = sum(l["amount"] for l in ledger if l["type"] == "GRN (Bill)")
    total_paid = sum(l["amount"] for l in ledger if l["type"] == "Payment")
    
    return {
        "ledger": ledger,
        "stats": {
            "total_po": total_po_value,
            "total_received": total_received,
            "total_paid": total_paid,
            "balance": total_received - total_paid
        }
    }
