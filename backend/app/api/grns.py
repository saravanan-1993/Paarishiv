from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from app.utils.auth import get_current_user
from app.api.workflow import trigger_workflow_event
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/grns", tags=["grns"])

class GRNItem(BaseModel):
    name: str
    po_qty: float
    received_qty: float
    rejected_qty: float
    unit: str
    remarks: str = ""

class GRNCreate(BaseModel):
    po_id: str
    vehicle_number: str = ""
    invoice_number: str = ""
    receipt_type: str = "Partial" # "Partial" or "Final"
    items: List[GRNItem]

def grn_helper(grn) -> dict:
    return {
        "id": str(grn["_id"]),
        "po_id": grn["po_id"],
        "vehicle_number": grn.get("vehicle_number", ""),
        "invoice_number": grn.get("invoice_number", ""),
        "receipt_type": grn.get("receipt_type", "Partial"),
        "items": grn["items"],
        "status": grn.get("status", "Received"),
        "is_billed": grn.get("is_billed", False),
        "vendor_name": grn.get("vendor_name", ""),
        "project_name": grn.get("project_name", ""),
        "created_at": grn.get("created_at")
    }

@router.get("/", response_model=List[dict])
async def get_grns(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        
        pos = await db.purchase_orders.find({"project_name": {"$in": project_names}}).to_list(100)
        po_ids = [str(po["_id"]) for po in pos]
        
        query["po_id"] = {"$in": po_ids}

    grns = await db.grns.find(query).sort("created_at", -1).to_list(100)
    
    # Enrich with PO details
    enriched_grns = []
    for g in grns:
        helper_g = grn_helper(g)
        try:
            if ObjectId.is_valid(g["po_id"]):
                po = await db.purchase_orders.find_one({"_id": ObjectId(g["po_id"])})
                if po:
                    helper_g["vendor_name"] = po.get("vendor_name", "Unknown Vendor")
                    helper_g["project_name"] = po.get("project_name", "Unknown Project")
        except Exception as e:
            pass
        enriched_grns.append(helper_g)
        
    return enriched_grns

@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Procurement", "edit", "GRN"))])
async def create_grn(grn: GRNCreate, current_user: dict = Depends(get_current_user)):
    grn_dict = grn.model_dump()
    grn_dict["created_at"] = datetime.now()
    result = await db.grns.insert_one(grn_dict)
    
    # Fetch PO to get project name
    project_name = "Unknown"
    try:
        if ObjectId.is_valid(grn.po_id):
            po = await db.purchase_orders.find_one({"_id": ObjectId(grn.po_id)})
            if po:
                project_name = po.get("project_name", "Unknown")
            else:
                pass
    except Exception as e:
        pass

    # Bug 5.1 - Update PO status properly when GRN is created
    po_status = "Partially Received" if grn.receipt_type == "Partial" else "Completed"
    try:
        if ObjectId.is_valid(grn.po_id):
            await db.purchase_orders.update_one(
                {"_id": ObjectId(grn.po_id)},
                {"$set": {"status": po_status}}
            )

            project = await db.projects.find_one({"name": project_name})
            if project:
                await trigger_workflow_event(str(project["_id"]), "grn_updated", current_user, db, f"GRN recorded for PO-{grn.po_id[-6:]}")

    except Exception as e:
        pass

    # Update Inventory Stock
    for item in grn.items:
        
        # Check stock handling type of the material
        material = await db.materials.find_one({"name": item.name})
        handling_type = "Direct Site"
        if material:
            # Handle legacy 'tracking_type' if it exists or use new 'stock_handling_type'
            handling_type = material.get("stock_handling_type") or material.get("tracking_type") or "Direct Site"
            # Map legacy values
            if handling_type == "Direct": handling_type = "Direct Site"
            if handling_type == "Warehouse": handling_type = "Warehouse Controlled"
        
        if handling_type == "Warehouse Controlled":
            # Add to main warehouse inventory
            await db.warehouse_inventory.update_one(
                {"material_name": item.name},
                {
                    "$inc": {"stock": item.received_qty},
                    "$set": {"unit": item.unit}
                },
                upsert=True
            )
            # Record in Stock Ledger
            await db.stock_ledger.insert_one({
                "date": datetime.now(),
                "material_name": item.name,
                "project_name": "Warehouse",
                "type": "GRN",
                "ref": f"GRN-{str(result.inserted_id)[-6:].upper()}",
                "in_qty": item.received_qty,
                "out_qty": 0,
                "created_at": datetime.now()
            })
        else:
            # Direct to site inventory
            await db.inventory.update_one(
                {
                    "project_name": project_name,
                    "material_name": item.name
                },
                {
                    "$inc": {"stock": item.received_qty},
                    "$set": {"unit": item.unit}
                },
                upsert=True
            )
            # Record in Stock Ledger
            await db.stock_ledger.insert_one({
                "date": datetime.now(),
                "material_name": item.name,
                "project_name": project_name,
                "type": "GRN (Direct)",
                "ref": f"GRN-{str(result.inserted_id)[-6:].upper()}",
                "in_qty": item.received_qty,
                "out_qty": 0,
                "created_at": datetime.now()
            })

    new_grn = await db.grns.find_one({"_id": result.inserted_id})
    return grn_helper(new_grn)
