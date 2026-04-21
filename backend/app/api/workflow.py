from fastapi import APIRouter, Depends, HTTPException
from database import get_database
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import List, Dict

IST = timezone(timedelta(hours=5, minutes=30))

def now_ist():
    """Return current IST datetime as timezone-aware."""
    return datetime.now(IST)

def now_ist_iso():
    """Return current IST time as ISO string with +05:30 offset."""
    return datetime.now(IST).isoformat()

router = APIRouter(prefix="/workflow", tags=["workflow"])

WORKFLOW_STAGES = [
    {"order": 1, "stage": "Project Created", "role": "Administrator", "auto_trigger": "project_created"},
    {"order": 2, "stage": "Site Engineer Assigned", "role": "Administrator", "auto_trigger": "engineer_assigned"},
    {"order": 3, "stage": "DPR Submitted", "role": "Site Engineer", "auto_trigger": "dpr_submitted"},
    {"order": 4, "stage": "DPR Verified by Project Coordinator", "role": "Project Coordinator", "auto_trigger": "dpr_verified"},
    {"order": 5, "stage": "Material Consolidated", "role": "Site Engineer", "auto_trigger": "material_consolidated"},
    {"order": 6, "stage": "Sent to Purchase Officer", "role": "Site Engineer", "auto_trigger": "sent_to_po"},
    {"order": 7, "stage": "PO Created", "role": "Purchase Officer", "auto_trigger": "po_created"},
    {"order": 8, "stage": "Vendor Dispatched", "role": "Vendor", "auto_trigger": "vendor_dispatched"},
    {"order": 9, "stage": "GRN Updated", "role": "Inventory Manager", "auto_trigger": "grn_updated"},
    {"order": 10, "stage": "Accounts Purchase Entry", "role": "Accountant", "auto_trigger": "accounts_entry"},
    {"order": 11, "stage": "Vendor Payment Settled", "role": "Accountant", "auto_trigger": "payment_settled"},
    {"order": 12, "stage": "Project Ongoing", "role": "Site Engineer", "auto_trigger": "project_ongoing"},
    {"order": 13, "stage": "Project Completed", "role": "Administrator", "auto_trigger": "project_completed"}
]

async def init_workflow_master(db):
    count = await db.workflow_stage_master.count_documents({})
    if count == 0:
        await db.workflow_stage_master.insert_many(WORKFLOW_STAGES)

async def initialize_project_workflow(project_id: str, db):
    await init_workflow_master(db)
    stages = await db.workflow_stage_master.find({}).sort("order", 1).to_list(100)
    transactions = []
    for s in stages:
        transactions.append({
            "project_id": str(project_id),
            "stage_name": s["stage"],
            "order": s["order"],
            "status": "Pending",
            "responsible_role": s["role"],
            "timestamp": None,
            "remarks": ""
        })
    await db.project_workflow_transaction.insert_many(transactions)

async def trigger_workflow_event(project_id: str, auto_trigger: str, user: dict, db, remarks: str = ""):
    stage_master = await db.workflow_stage_master.find_one({"auto_trigger": auto_trigger})
    if not stage_master:
        return

    stage_name = stage_master["stage"]
    done_by = f"{user.get('fullName', user.get('username', 'System'))} ({user.get('role', 'System')})"
    
    # 1. Update the transaction for this stage to Completed
    tx = await db.project_workflow_transaction.find_one({"project_id": str(project_id), "stage_name": stage_name})
    if not tx:
        # Auto-initialize if it doesn't exist (for existing projects)
        await initialize_project_workflow(project_id, db)
        tx = await db.project_workflow_transaction.find_one({"project_id": str(project_id), "stage_name": stage_name})
        if not tx:
            return
    
    prev_status = tx["status"]
    
    await db.project_workflow_transaction.update_one(
        {"_id": tx["_id"]},
        {"$set": {
            "status": "Completed", 
            "timestamp": now_ist_iso(),
            "remarks": remarks
        }}
    )
    
    # Update all previous stages to Completed if they were pending (Waterfall effect)
    await db.project_workflow_transaction.update_many(
        {"project_id": str(project_id), "order": {"$lt": stage_master["order"]}, "status": "Pending"},
        {"$set": {"status": "Completed", "timestamp": now_ist_iso(), "remarks": "Auto-completed by progression"}}
    )
    
    # Update the next stage to In Progress
    await db.project_workflow_transaction.update_one(
        {"project_id": str(project_id), "order": stage_master["order"] + 1},
        {"$set": {"status": "In Progress", "timestamp": now_ist_iso()}}
    )
    
    # Insert Activity Log
    await db.activity_log.insert_one({
        "project_id": str(project_id),
        "action_name": stage_name,
        "done_by": done_by,
        "timestamp": now_ist_iso(),
        "previous_status": prev_status,
        "updated_status": "Completed"
    })

@router.get("/{project_id}/timeline")
async def get_project_timeline(project_id: str, db = Depends(get_database)):
    transactions = await db.project_workflow_transaction.find({"project_id": project_id}).sort("order", 1).to_list(100)
    
    # Auto-initialize for older projects
    if not transactions:
        await initialize_project_workflow(project_id, db)
        transactions = await db.project_workflow_transaction.find({"project_id": project_id}).sort("order", 1).to_list(100)
        
    # Decorate with hold logic
    now_dt = now_ist()
    for tx in transactions:
        if tx["status"] == "In Progress" and tx.get("timestamp"):
            ts_dt = datetime.fromisoformat(tx["timestamp"])
            if ts_dt.tzinfo is None:
                ts_dt = ts_dt.replace(tzinfo=IST)
            diff_hours = (now_dt - ts_dt).total_seconds() / 3600
            if diff_hours > 24:
                tx["is_hold"] = True
                tx["hold_duration_hours"] = round(diff_hours)
            else:
                tx["is_hold"] = False
                tx["hold_duration_hours"] = 0
        tx["_id"] = str(tx["_id"])
                
    return transactions

@router.get("/{project_id}/activity-log")
async def get_activity_log(project_id: str, db = Depends(get_database)):
    logs = await db.activity_log.find({"project_id": project_id}).sort("timestamp", -1).to_list(100)
    for l in logs:
        l["_id"] = str(l["_id"])
    return logs

@router.get("/dashboard-overview")
async def get_workflow_overview(db = Depends(get_database)):
    # Find the current stage of every project
    projects = await db.projects.find({}).to_list(1000)
    overview = []
    now_dt = now_ist()
    
    for p in projects:
        pid = str(p["_id"])
        # The current stage is the one that is 'In Progress' or the highest 'Completed'
        current_tx = await db.project_workflow_transaction.find_one({"project_id": pid, "status": "In Progress"})
        if current_tx:
            diff_hours = 0
            is_hold = False
            if current_tx.get("timestamp"):
                ts_dt = datetime.fromisoformat(current_tx["timestamp"])
                if ts_dt.tzinfo is None:
                    ts_dt = ts_dt.replace(tzinfo=IST)
                diff_hours = round((now_dt - ts_dt).total_seconds() / 3600)
                is_hold = diff_hours > 24
                
            overview.append({
                "project_id": pid,
                "project_name": p.get("name"),
                "current_stage": current_tx["stage_name"],
                "pending_with": current_tx["responsible_role"],
                "status": "On Hold" if is_hold else "In Progress",
                "hold_duration": f"{diff_hours} hours" if diff_hours > 0 else "N/A"
            })
        else:
            # Check if all completed
            last_tx = await db.project_workflow_transaction.find_one({"project_id": pid}, sort=[("order", -1)])
            if last_tx and last_tx["status"] == "Completed":
                overview.append({
                    "project_id": pid,
                    "project_name": p.get("name"),
                    "current_stage": last_tx["stage_name"],
                    "pending_with": "None",
                    "status": "Completed",
                    "hold_duration": "N/A"
                })
                
    return overview
