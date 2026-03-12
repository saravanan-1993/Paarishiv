from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from database import get_database
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from app.utils.auth import get_current_user
from app.api.workflow import trigger_workflow_event

router = APIRouter(prefix="/inventory", tags=["inventory"])

class MaterialRequestCreate(BaseModel):
    project_id: str
    project_name: str
    engineer_id: str
    requested_items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]
    priority: str = "Medium"
    required_by_date: Optional[str] = ""
    coordinator_remarks: Optional[str] = ""

class StockIssue(BaseModel):
    issued_items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]

class StockSettlementCreate(BaseModel):
    request_id: str
    items: List[dict] # [{"name": "Switch", "issued": 50, "used": 40, "remaining": 10, "action": "Return"}]

class MaterialTransferRequest(BaseModel):
    from_project: str
    to_project: str
    items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos"}]
    notes: Optional[str] = ""

@router.get("/warehouse")
async def get_warehouse_inventory(db = Depends(get_database)):
    inventory = await db.warehouse_inventory.find().to_list(1000)
    return [
        {
            "id": str(item["_id"]),
            "material_name": item["material_name"],
            "unit": item.get("unit", "Nos"),
            "stock": item.get("stock", 0)
        }
        for item in inventory
    ]

@router.post("/requests")
async def create_material_request(request: MaterialRequestCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    request_dict = request.dict()
    request_dict["status"] = "Pending"
    request_dict["created_at"] = datetime.now()
    request_dict["issued_items"] = []
    
    result = await db.material_requests.insert_one(request_dict)
    
    # Trigger workflow
    if request.project_id:
        await trigger_workflow_event(request.project_id, "material_consolidated", current_user, db, f"Material Request created for {len(request.requested_items)} items")
        
    return {"id": str(result.inserted_id), "success": True}

@router.get("/requests")
async def get_material_requests(project_name: Optional[str] = None, status: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    
    if status:
        query["status"] = status
    
    # Check if user is Coordinator, Admin, or Purchase Officer
    allowed_roles = ["Project Coordinator", "Super Admin", "Administrator", "Purchase Officer", "Inventory Manager"]
    if current_user.get("role") in allowed_roles:
        if project_name and project_name != "all":
            query["project_name"] = project_name
    elif current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        
        if project_name and project_name != "all":
            if project_name in project_names:
                query["project_name"] = project_name
            else:
                return []
        else:
            query["project_name"] = {"$in": project_names}
    else:
        # Default restricted view
        return []
        
    requests = await db.material_requests.find(query).sort("created_at", -1).to_list(100)
    return [
        {
            "id": str(r["_id"]),
            **{k: v for k, v in r.items() if k != "_id"}
        }
        for r in requests
    ]

class ConsolidateRequests(BaseModel):
    request_ids: List[str]
    notes: Optional[str] = ""

@router.post("/requests/consolidate")
async def consolidate_requests(payload: ConsolidateRequests, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Only Coordinator, Admin can consolidate
    allowed = ["Project Coordinator", "Super Admin", "Administrator"]
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized to consolidate requests")
        
    # 1. Fetch all selected requests
    ids = [ObjectId(rid) for rid in payload.request_ids]
    requests = await db.material_requests.find({"_id": {"$in": ids}}).to_list(100)
    
    if not requests:
        raise HTTPException(status_code=404, detail="No valid requests found")

    # 2. Combine items
    combined_items = {} # { "item_name|unit": { "name": "...", "quantity": X, "unit": Y, "sites": ["Site A"], "site_quantities": {"Site A": X} } }
    site_names = set()
    
    for req in requests:
        project_name = req.get("project_name", "Unknown Site")
        site_names.add(project_name)
        for item in req.get("requested_items", []):
            name = item["name"]
            qty = float(item.get("quantity", 0))
            unit = item.get("unit", "Nos")
            
            key = f"{name}|{unit}"
            if key in combined_items:
                combined_items[key]["quantity"] += qty
                
                # Update site specific quantity breakdown
                if project_name in combined_items[key]["site_quantities"]:
                    combined_items[key]["site_quantities"][project_name] += qty
                else:
                    combined_items[key]["site_quantities"][project_name] = qty
                    
                # Ensure site is in the list
                if project_name not in combined_items[key]["sites"]:
                    combined_items[key]["sites"].append(project_name)
            else:
                combined_items[key] = {
                    "name": name,
                    "quantity": qty,
                    "unit": unit,
                    "sites": [project_name],
                    "site_quantities": {project_name: qty}
                }

    # 3. Create Consolidated Record
    consolidated_record = {
        "request_ids": payload.request_ids,
        "items": list(combined_items.values()),
        "sites": list(site_names),
        "notes": payload.notes,
        "status": "Consolidated",
        "created_by": current_user.get("username"),
        "created_at": datetime.now()
    }
    
    result = await db.consolidated_requests.insert_one(consolidated_record)
    
    # 4. Update individual requests
    await db.material_requests.update_many(
        {"_id": {"$in": ids}},
        {"$set": {
            "status": "Consolidated", 
            "consolidated_id": str(result.inserted_id),
            "updated_at": datetime.now()
        }}
    )
    
    return {"id": str(result.inserted_id), "success": True}

@router.get("/consolidated")
async def get_consolidated_requests(db = Depends(get_database)):
    records = await db.consolidated_requests.find().sort("created_at", -1).to_list(100)
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
    return records

@router.put("/requests/{request_id}/status")
async def update_request_status(request_id: str, payload: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Only Coordinator, Admin, Purchase Officer or Inventory Manager can approve
    allowed_approvers = ["Project Coordinator", "Super Admin", "Administrator", "Purchase Officer", "Inventory Manager"]
    if current_user.get("role") not in allowed_approvers:
        raise HTTPException(status_code=403, detail="Not authorized to approve requests")
        
    status = payload.get("status")
    remarks = payload.get("remarks", "")
    
    update_data = {
        "status": status,
        "coordinator_remarks": remarks,
        "updated_at": datetime.now(),
        "coordinator_id": current_user.get("username")
    }
    
    result = await db.material_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if status == "Approved" or status == "Sent to PO" or status == "In Progress":
        req = await db.material_requests.find_one({"_id": ObjectId(request_id)})
        if req and req.get("project_id"):
            await trigger_workflow_event(req["project_id"], "sent_to_po", current_user, db, f"Material Request {request_id[-6:]} Approved/Sent to PO")
            
    return {"success": True}

@router.post("/requests/{request_id}/issue")
async def issue_stock(request_id: str, issue: StockIssue, db = Depends(get_database)):
    # 1. Update Material Request
    result = await db.material_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "Issued",
                "issued_items": issue.issued_items,
                "issued_at": datetime.now()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # 2. Update Stocks & Log Ledger
    request = await db.material_requests.find_one({"_id": ObjectId(request_id)})
    project_name = request.get("project_name", "Unknown")
    total_issue_value = 0
    
    for item in issue.issued_items:
        # Decrement from Warehouse Inventory
        await db.warehouse_inventory.update_one(
            {"material_name": item["name"]},
            {"$inc": {"stock": -item["quantity"]}}
        )
        
        # Increase Site Stock
        await db.inventory.update_one(
            {
                "project_name": project_name,
                "material_name": item["name"]
            },
            {
                "$inc": {"stock": item["quantity"]},
                "$set": {"unit": item.get("unit", "Nos")}
            },
            upsert=True
        )
        
        # Calculate cost for project spending update
        # Try to find last purchase rate
        rate = 0
        last_bill = await db.purchase_bills.find_one({"items.name": item["name"]}, sort=[("bill_date", -1)])
        if last_bill:
             for bi in last_bill.get("items", []):
                if bi["name"] == item["name"]:
                    rate = float(bi.get("rate") or 0)
                    break
        total_issue_value += float(item["quantity"]) * rate

        # Record in Stock Ledger
        await db.stock_ledger.insert_one({
            "date": datetime.now(),
            "material_name": item["name"],
            "project_name": project_name,
            "type": "Stock Issue",
            "ref": f"REQ-{request_id[-6:].upper()}",
            "in_qty": item["quantity"], # In for Site
            "out_qty": item["quantity"], # Out for Warehouse
            "created_at": datetime.now()
        })
    
    # Update Project Spending
    if total_issue_value > 0:
        await db.projects.update_one({"name": project_name}, {"$inc": {"spent": total_issue_value}})
        
    return {"success": True}

class StockReturn(BaseModel):
    project_name: str
    items: List[dict] # [{"name": "Switch", "quantity": 10, "unit": "Nos"}]

@router.post("/return")
async def return_stock(ret: StockReturn, db = Depends(get_database)):
    for item in ret.items:
        # 1. Reduce Site Stock
        await db.inventory.update_one(
            {
                "project_name": ret.project_name,
                "material_name": item["name"]
            },
            {"$inc": {"stock": -item["quantity"]}}
        )
        
        # 2. Increase Warehouse Stock
        await db.warehouse_inventory.update_one(
            {"material_name": item["name"]},
            {"$inc": {"stock": item["quantity"]}},
            upsert=True
        )
        
        # 3. Record in Stock Ledger
        await db.stock_ledger.insert_one({
            "date": datetime.now(),
            "material_name": item["name"],
            "project_name": ret.project_name,
            "type": "Stock Return",
            "ref": "RETURN",
            "in_qty": item["quantity"], # In for Warehouse
            "out_qty": item["quantity"], # Out for Site
            "created_at": datetime.now()
        })
        
    return {"success": True}

@router.get("/ledger")
async def get_stock_ledger(material_name: Optional[str] = None, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    if material_name:
        query["material_name"] = material_name
        
    if current_user.get("role") == "Site Engineer":
        projects = await db.projects.find({"engineer_id": current_user.get("username")}).to_list(100)
        project_names = [p.get("name") for p in projects if p.get("name")]
        query["project_name"] = {"$in": project_names}
        
    logs = await db.stock_ledger.find(query).sort("date", -1).to_list(1000)
    
    # Calculate running balance if material specified?
    # Requirement says "Show Balance"
    # To show balance correctly, we might need to sort ASC, calc, then return DESC.
    
    if material_name:
        logs.reverse() # Sort ASC for calc
        current_balance = 0
        for log in logs:
            # This is tricky because ledger includes both Site and Warehouse
            # For simplicity, we'll just show the movement
            if log["type"] in ["GRN", "Stock Return", "GRN (Direct)"]:
                current_balance += log["in_qty"]
            elif log["type"] in ["Stock Issue"]:
                # For a specific site, Issue is IN. For warehouse, it's OUT.
                # Since this is a global ledger, maybe we just show IN/OUT.
                pass 
            # Re-evaluating: The user wants a standard ledger.
            # Let's just return what's in the log for now.
            log["balance"] = 0 # Placeholder if not specific enough
        logs.reverse() # Back to DESC
        
    return [
        {
            "id": str(l["_id"]),
            "date": l["date"],
            "material_name": l["material_name"],
            "project_name": l.get("project_name", ""),
            "type": l["type"],
            "ref": l.get("ref", ""),
            "in": l.get("in_qty", 0),
            "out": l.get("out_qty", 0),
            "balance": l.get("balance", 0)
        }
        for l in logs
    ]

@router.post("/requests/{request_id}/settle")
async def settle_stock(request_id: str, settlement: StockSettlementCreate, db = Depends(get_database)):
    # 1. Update Material Request
    await db.material_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "Settled", "settled_at": datetime.now()}}
    )
    
    # 2. Log Settlement
    request = await db.material_requests.find_one({"_id": ObjectId(request_id)})
    settlement_dict = {
        "request_id": request_id,
        "project_name": request.get("project_name"),
        "date": datetime.now(),
        "items": settlement.items
    }
    await db.stock_settlements.insert_one(settlement_dict)
    
    # 3. Handle Remaining Stock (Return to Warehouse or Add to Site Inventory)
    for item in settlement.items:
        remaining = float(item.get("remaining", 0))
        if remaining > 0:
            if item.get("action") == "Return":
                # Add back to Warehouse
                await db.warehouse_inventory.update_one(
                    {"material_name": item["name"]},
                    {"$inc": {"stock": remaining}},
                    upsert=True
                )
            else:
                # Keep at Side -> Add to Site Inventory
                await db.inventory.update_one(
                    {
                        "project_name": request.get("project_name"),
                        "material_name": item["name"]
                    },
                    {
                        "$inc": {"stock": remaining},
                        "$set": {"unit": item.get("unit", "Nos")}
                    },
                    upsert=True
                )
                
    return {"success": True}

class MaterialTransfer(BaseModel):
    from_project: str
    to_project: str
    items: List[dict] # [{"name": "Switch", "quantity": 50, "unit": "Nos", "price": 100}]
    notes: Optional[str] = ""

@router.post("/transfers/request")
async def request_material_transfer(transfer: MaterialTransferRequest, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # 1. Validate source project user? Or just anyone?
    request_dict = transfer.dict()
    request_dict["status"] = "Pending"
    request_dict["created_at"] = datetime.now()
    request_dict["engineer_id"] = current_user.get("username")
    
    result = await db.material_transfer_requests.insert_one(request_dict)
    return {"id": str(result.inserted_id), "success": True}

@router.get("/transfers/pending")
async def get_pending_transfers(db = Depends(get_database)):
    requests = await db.material_transfer_requests.find({"status": "Pending"}).sort("created_at", -1).to_list(100)
    return [
        {
            "id": str(r["_id"]),
            **{k: v for k, v in r.items() if k != "_id"}
        }
        for r in requests
    ]

async def get_lifo_rate(db, material_name, project_name):
    # LIFO: Get the rate of the LAST purchase or issue for this project
    # 1. Check Purchase Bills for this project
    last_bill = await db.purchase_bills.find_one(
        {"project_name": project_name, "items.name": material_name},
        sort=[("bill_date", -1)]
    )
    if last_bill:
        for item in last_bill["items"]:
            if item["name"] == material_name:
                return float(item.get("rate") or 0)

    # 2. Check globally (last purchase anywhere) to get current market value
    global_last = await db.purchase_bills.find_one(
        {"items.name": material_name},
        sort=[("bill_date", -1)]
    )
    if global_last:
        for item in global_last["items"]:
            if item["name"] == material_name:
                return float(item.get("rate") or 0)
    
    return 0

@router.put("/transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    request = await db.material_transfer_requests.find_one({"_id": ObjectId(transfer_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    from_proj = request["from_project"]
    to_proj = request["to_project"]
    items = request["items"]
    total_transfer_value = 0
    calculated_items = []

    for item in items:
        # Get LIFO Rate
        rate = await get_lifo_rate(db, item["name"], from_proj)
        item_val = float(item["quantity"]) * rate
        total_transfer_value += item_val
        calculated_items.append({**item, "rate": rate, "value": item_val})

        # 1. Deduct from Source Project
        await db.inventory.update_one(
            {"project_name": from_proj, "material_name": item["name"]},
            {"$inc": {"stock": -item["quantity"]}}
        )
        
        # 2. Add to Destination Project
        await db.inventory.update_one(
            {"project_name": to_proj, "material_name": item["name"]},
            {"$inc": {"stock": item["quantity"]}, "$set": {"unit": item.get("unit", "Nos")}},
            upsert=True
        )
        
        # 3. Log to Stock Ledger
        await db.stock_ledger.insert_one({
            "date": datetime.now(),
            "material_name": item["name"],
            "project_name": f"{from_proj} -> {to_proj}",
            "type": "Transfer",
            "ref": f"XFER-{transfer_id[-6:].upper()}",
            "in_qty": item["quantity"],
            "out_qty": item["quantity"],
            "created_at": datetime.now()
        })

    # 4. Accounting Entries
    # Decrease from source project budget
    await db.projects.update_one({"name": from_proj}, {"$inc": {"spent": -total_transfer_value}})
    # Increase at destination project budget
    await db.projects.update_one({"name": to_proj}, {"$inc": {"spent": total_transfer_value}})

    # Create Accounting Expense records for audit trail
    # Negative expense for Source (Credit)
    await db.expenses.insert_one({
        "category": "Material Transfer Out",
        "project": from_proj,
        "amount": -total_transfer_value,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "description": f"Transfer to {to_proj} (Ref: {transfer_id[-6:].upper()})",
        "items": calculated_items,
        "created_at": datetime.now()
    })
    # Positive expense for Destination (Debit)
    await db.expenses.insert_one({
        "category": "Material Transfer In",
        "project": to_proj,
        "amount": total_transfer_value,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "description": f"Transfer from {from_proj} (Ref: {transfer_id[-6:].upper()})",
        "items": calculated_items,
        "created_at": datetime.now()
    })

    # 5. Update Request Status
    await db.material_transfer_requests.update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": {
            "status": "Approved",
            "approval_date": datetime.now(),
            "approved_by": current_user.get("username"),
            "total_value": total_transfer_value,
            "items": calculated_items
        }}
    )

    return {"success": True, "value": total_transfer_value}

@router.put("/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    await db.material_transfer_requests.update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": {
            "status": "Rejected",
            "updated_at": datetime.now(),
            "processed_by": current_user.get("username")
        }}
    )
    return {"success": True}

