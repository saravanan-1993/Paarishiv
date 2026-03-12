from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.material import MaterialBase
from database import get_database
from bson import ObjectId
from datetime import datetime
from app.utils.auth import get_current_user

router = APIRouter(prefix="/materials", tags=["materials"])

@router.get("/", response_model=List[dict])
async def get_materials(db = Depends(get_database)):
    materials = await db.materials.find().to_list(100)
    return [{"id": str(m["_id"]), **{k: v for k, v in m.items() if k != "_id"}} for m in materials]

@router.get("/project/{project_name}")
async def get_project_inventory(project_name: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        
        if project_name == "all":
            query["project_name"] = {"$in": project_names}
        elif project_name in project_names:
            query["project_name"] = project_name
        else:
            return []
    else:
        if project_name != "all":
            query["project_name"] = project_name
            
    inventory = await db.inventory.find(query).to_list(1000)
        
    # If "all", aggregate by material_name to avoid dupes across projects (or just show per project if you prefer)
    # We will just return everything and let frontend handle it or we aggregate it here.
    if project_name == "all":
        aggregated = {}
        for item in inventory:
            m_name = item.get("material_name", "Unknown")
            if m_name not in aggregated:
                aggregated[m_name] = {
                    "id": str(item["_id"]),
                    "material_name": m_name,
                    "unit": item.get("unit", "Nos"),
                    "stock": 0,
                    "min_stock": item.get("min_stock", 10), # use first found min_stock
                    "project_name": "All Sites"
                }
            aggregated[m_name]["stock"] += item.get("stock", 0)
        return list(aggregated.values())

    return [
        {
            "id": str(item["_id"]),
            "material_name": item["material_name"],
            "unit": item.get("unit", "Nos"),
            "stock": item.get("stock", 0),
            "min_stock": item.get("min_stock", 10),
            "project_name": item.get("project_name", "")
        }
        for item in inventory
    ]

@router.put("/inventory/{inventory_id}")
async def update_inventory(inventory_id: str, data: dict, db = Depends(get_database)):
    # Allow updating min_stock limit
    if "min_stock" in data:
         await db.inventory.update_one(
             {"_id": ObjectId(inventory_id)},
             {"$set": {"min_stock": float(data["min_stock"])}}
         )
    return {"success": True}

@router.get("/sync-inventory")
async def sync_inventory(db = Depends(get_database)):
    # Clear current inventory to rebuild it correctly
    await db.inventory.delete_many({})
    
    # Fetch all GRNs
    grns = await db.grns.find().to_list(1000)
    
    count = 0
    for grn in grns:
        po_id = grn.get("po_id")
        project_name = "Unknown"
        
        if po_id and ObjectId.is_valid(po_id):
            po = await db.purchase_orders.find_one({"_id": ObjectId(po_id)})
            if po:
                project_name = po.get("project_name", "Unknown")
        
        for item in grn.get("items", []):
            await db.inventory.update_one(
                {
                    "project_name": project_name,
                    "material_name": item.get("name")
                },
                {
                    "$inc": {"stock": float(item.get("received_qty", 0))},
                    "$set": {"unit": item.get("unit", "Nos")}
                },
                upsert=True
            )
            count += 1
            
    return {"message": f"Inventory synced from {len(grns)} GRNs. Total {count} item updates processed."}

@router.post("/")
async def create_material(material: MaterialBase, db = Depends(get_database)):
    result = await db.materials.insert_one(material.dict())
    return {"id": str(result.inserted_id), **material.dict()}

@router.get("/inventory/ledger")
async def get_material_ledger(project_name: str, material_name: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Fetch all POs to map them to project names
    pos = await db.purchase_orders.find().to_list(2000)
    po_project_map = {str(p["_id"]): p.get("project_name", "Unknown") for p in pos}
    
    # Fetch all GRNs
    grns = await db.grns.find().to_list(2000)
    
    ledger = []
    balance = 0
    
    # Sort GRNs by creation date to calculate running balance correctly
    # Use a fallback for missing created_at
    grns.sort(key=lambda x: x.get("created_at") if x.get("created_at") else datetime.min)
    
    for grn in grns:
        po_id = grn.get("po_id")
        current_grn_project = po_project_map.get(str(po_id), "Unknown")
        
        # Determine allowed projects
        allowed_projects = None
        if current_user.get("role") == "Site Engineer":
            projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
            allowed_projects = [p.get("name") for p in projects if p.get("name")]
            
            # If not in allowed projects, skip
            if current_grn_project not in allowed_projects:
                continue

        # Filter by requested project if not 'All Sites'
        if project_name not in ["All Sites", "all"] and current_grn_project != project_name:
            continue
            
        for item in grn.get("items", []):
            if item.get("name") == material_name:
                qty_in = float(item.get("received_qty", 0))
                # Note: This balance calculation is simplified and only works 
                # correctly if we are viewing 'All Sites' or if we start from 0 for the project.
                # For now, it's consistent with the previous logic.
                balance += qty_in
                ledger.append({
                    "date": grn.get("created_at") or datetime.now().isoformat(),
                    "type": "GRN (Inward)",
                    "ref": f"GRN-{str(grn['_id'])[-6:].upper()}",
                    "in_qty": qty_in,
                    "out_qty": 0,
                    "balance": balance,
                    "remarks": f"Project: {current_grn_project}"
                })
    
    # Fetch Stock Ledger (Transfers)
    stock_entries = await db.stock_ledger.find({"material_name": material_name}).to_list(2000)
    for entry in stock_entries:
        entry_project_string = entry.get("project_name", "") # e.g. "Site A -> Site B"
        is_all_sites = project_name in ["All Sites", "all"]
        
        # Determine if it's a transfer OUT of or INTO the requested project
        parts = entry_project_string.split(" -> ")
        from_proj = parts[0] if len(parts) > 0 else ""
        to_proj = parts[1] if len(parts) > 1 else ""
        
        # If user is a Site Engineer, ensure they have access to either from_proj or to_proj
        if current_user.get("role") == "Site Engineer" and allowed_projects is not None:
            if from_proj not in allowed_projects and to_proj not in allowed_projects:
                continue
                
        # If looking at a specific project
        if not is_all_sites:
            if from_proj == project_name:
                # It's a Transfer OUT
                qty_out = float(entry.get("out_qty", 0))
                balance -= qty_out
                ledger.append({
                    "date": entry.get("created_at") or datetime.now().isoformat(),
                    "type": "Transfer (Outward)",
                    "ref": entry.get("ref", "XFER"),
                    "in_qty": 0,
                    "out_qty": qty_out,
                    "balance": balance,
                    "remarks": f"To: {to_proj}"
                })
            elif to_proj == project_name:
                # It's a Transfer IN
                qty_in = float(entry.get("in_qty", 0))
                balance += qty_in
                ledger.append({
                    "date": entry.get("created_at") or datetime.now().isoformat(),
                    "type": "Transfer (Inward)",
                    "ref": entry.get("ref", "XFER"),
                    "in_qty": qty_in,
                    "out_qty": 0,
                    "balance": balance,
                    "remarks": f"From: {from_proj}"
                })
        else:
            # For 'All Sites', we might show both or just one to keep total balance correct.
            # Showing both would result in a net 0 change to the 'All Sites' combined balance.
            qty = float(entry.get("in_qty", 0))
            ledger.append({
                "date": entry.get("created_at") or datetime.now().isoformat(),
                "type": "Inter-Site Transfer",
                "ref": entry.get("ref", "XFER"),
                "in_qty": 0, # Net 0 at company level
                "out_qty": 0,
                "balance": balance,
                "remarks": f"{from_proj} -> {to_proj} ({qty} qty)"
            })
            
    # Calculate running balance accurately locally by sorting all chronologically
    ledger.sort(key=lambda x: str(x.get("date") if x.get("date") else ""), reverse=False)
    
    current_balance = 0
    for l in ledger:
        current_balance = current_balance + float(l.get("in_qty", 0)) - float(l.get("out_qty", 0))
        l["balance"] = current_balance

    # Return sorted by date descending for the UI
    return sorted(ledger, key=lambda x: x.get("date") if x.get("date") else "", reverse=True)
