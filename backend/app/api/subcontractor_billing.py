from fastapi import APIRouter, HTTPException, status, Body, Depends
from typing import List, Optional
from database import db
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime
from app.utils.auth import get_current_user
from app.utils.logging import log_activity
from app.utils.rbac import RBACPermission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_APPROVAL, EVENT_WORKFLOW

router = APIRouter(prefix="/subcontractor-billing", tags=["subcontractor-billing"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def bill_helper(bill) -> dict:
    # Safely convert datetime fields to strings
    created_at = bill.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    approved_at = bill.get("approved_at")
    if hasattr(approved_at, "isoformat"):
        approved_at = approved_at.isoformat()

    return {
        "id": str(bill["_id"]),
        "bill_no": bill.get("bill_no", ""),
        "project_id": bill.get("project_id", ""),
        "project_name": bill.get("project_name", ""),
        "contractor_name": bill.get("contractor_name", ""),
        "bill_type": bill.get("bill_type", "work_based"),
        "bill_date": bill.get("bill_date", ""),
        "period_from": bill.get("period_from", ""),
        "period_to": bill.get("period_to", ""),
        "agreement_no": bill.get("agreement_no", ""),
        "mbook_entries": bill.get("mbook_entries", []),
        "day_entries": bill.get("day_entries", []),
        "dpr_references": bill.get("dpr_references", []),
        "labour_attendance_refs": bill.get("labour_attendance_refs", []),
        "gross_amount": bill.get("gross_amount", 0),
        "deductions": bill.get("deductions", []),
        "total_deductions": bill.get("total_deductions", 0),
        "net_amount": bill.get("net_amount", 0),
        "gst_percent": bill.get("gst_percent", 0),
        "gst_amount": bill.get("gst_amount", 0),
        "payable_amount": bill.get("payable_amount", 0),
        "status": bill.get("status", "Draft"),
        "created_by": bill.get("created_by", ""),
        "created_at": created_at,
        "approved_by": bill.get("approved_by", ""),
        "approved_at": approved_at,
        "rejection_reason": bill.get("rejection_reason", ""),
        "paid_amount": bill.get("paid_amount", 0),
        "balance": bill.get("balance", 0),
        "payments": bill.get("payments", []),
        "advance_adjustments": bill.get("advance_adjustments", []),
        "advance_recovery_total": bill.get("advance_recovery_total", 0),
        "mbook_page_no": bill.get("mbook_page_no", ""),
        "mbook_serial_no": bill.get("mbook_serial_no", ""),
        "measured_by": bill.get("measured_by") or {"name": "", "designation": "", "date": ""},
        "checked_by": bill.get("checked_by") or {"name": "", "designation": "", "date": ""},
        "verified_by": bill.get("verified_by") or {"name": "", "designation": "", "date": ""},
        "notes": bill.get("notes", ""),
    }


async def generate_bill_no():
    """Generate sequential bill number: SCB-YYMMDD-NNN"""
    today = datetime.now().strftime("%y%m%d")
    prefix = f"SCB-{today}-"
    try:
        last = await db.subcontractor_bills.find(
            {"bill_no": {"$regex": f"^{prefix}"}},
            {"bill_no": 1}
        ).sort("bill_no", -1).to_list(1)
        if last:
            last_seq = int(last[0]["bill_no"].split("-")[-1])
            return f"{prefix}{last_seq + 1:03d}"
    except (ValueError, IndexError, KeyError):
        pass
    return f"{prefix}001"


async def generate_advance_no():
    """Generate sequential advance number: ADV-YYMMDD-NNN"""
    today = datetime.now().strftime("%y%m%d")
    prefix = f"ADV-{today}-"
    try:
        last = await db.subcontractor_advances.find(
            {"advance_no": {"$regex": f"^{prefix}"}},
            {"advance_no": 1}
        ).sort("advance_no", -1).to_list(1)
        if last:
            last_seq = int(last[0]["advance_no"].split("-")[-1])
            return f"{prefix}{last_seq + 1:03d}"
    except (ValueError, IndexError, KeyError):
        pass
    return f"{prefix}001"


async def _restore_advance(advance_id: str, amount: float, bill_no: str = ""):
    """Restore a previously deducted amount back into the advance (used on rollback / bill rejection / delete)."""
    if not ObjectId.is_valid(advance_id) or amount <= 0:
        return
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        return
    new_adjusted = max((adv.get("adjusted_amount", 0) or 0) - amount, 0)
    new_outstanding = (adv.get("outstanding_balance", 0) or 0) + amount
    # Clamp outstanding to original amount in case of rounding drift
    new_outstanding = min(new_outstanding, adv.get("amount", new_outstanding))
    new_status = "Active" if new_adjusted <= 0.01 else "Partially Adjusted"
    set_dict = {
        "adjusted_amount": new_adjusted,
        "outstanding_balance": new_outstanding,
        "status": new_status,
        "closed_at": None,
    }
    log_entry = {
        "bill_no": bill_no,
        "amount": -amount,
        "adjusted_at": datetime.now().isoformat(),
        "note": "restored",
    }
    await db.subcontractor_advances.update_one(
        {"_id": ObjectId(advance_id)},
        {"$push": {"adjustments": log_entry}, "$set": set_dict}
    )


def advance_helper(adv) -> dict:
    created_at = adv.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    closed_at = adv.get("closed_at")
    if hasattr(closed_at, "isoformat"):
        closed_at = closed_at.isoformat()
    approved_at = adv.get("approved_at")
    if hasattr(approved_at, "isoformat"):
        approved_at = approved_at.isoformat()
    return {
        "id": str(adv["_id"]),
        "advance_no": adv.get("advance_no", ""),
        "contractor_name": adv.get("contractor_name", ""),
        "project_id": adv.get("project_id", ""),
        "project_name": adv.get("project_name", ""),
        "amount": adv.get("amount", 0),
        "adjusted_amount": adv.get("adjusted_amount", 0),
        "outstanding_balance": adv.get("outstanding_balance", 0),
        "payment_mode": adv.get("payment_mode", ""),
        "reference_no": adv.get("reference_no", ""),
        "payment_date": adv.get("payment_date", ""),
        "remarks": adv.get("remarks", ""),
        "status": adv.get("status", "Active"),
        "approval_status": adv.get("approval_status", "Draft"),
        "approved_by": adv.get("approved_by", ""),
        "approved_at": approved_at,
        "rejection_reason": adv.get("rejection_reason", ""),
        "adjustments": adv.get("adjustments", []),
        "created_by": adv.get("created_by", ""),
        "created_at": created_at,
        "closed_at": closed_at,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────


# ── Advance endpoints (must come before /{bill_id} dynamic routes) ────────────

@router.get("/advances", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def list_advances(
    contractor_name: Optional[str] = None,
    project_name: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if contractor_name:
        query["contractor_name"] = contractor_name
    if project_name:
        query["project_name"] = project_name
    if status_filter:
        query["status"] = status_filter
    advs = await db.subcontractor_advances.find(query).sort("created_at", -1).to_list(500)
    return [advance_helper(a) for a in advs]


@router.get("/advances/available", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def list_available_advances(
    contractor_name: str,
    project_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Return Approved + Active/Partially Adjusted advances with positive outstanding for a contractor (optionally a project)."""
    if not contractor_name:
        raise HTTPException(status_code=400, detail="contractor_name is required")
    query = {
        "contractor_name": contractor_name,
        "approval_status": "Approved",
        "status": {"$in": ["Active", "Partially Adjusted"]},
        "outstanding_balance": {"$gt": 0},
    }
    if project_name:
        query["project_name"] = project_name
    advs = await db.subcontractor_advances.find(query).sort("created_at", 1).to_list(100)
    return [advance_helper(a) for a in advs]


@router.post("/advances", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def create_advance(
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    contractor = (data.get("contractor_name") or "").strip()
    if not contractor:
        raise HTTPException(status_code=400, detail="Contractor name is required")
    if not data.get("project_name"):
        raise HTTPException(status_code=400, detail="Project name is required")

    amount = float(data.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Advance amount must be positive")

    advance_no = await generate_advance_no()
    adv_dict = {
        "advance_no": advance_no,
        "contractor_name": contractor,
        "project_id": data.get("project_id", ""),
        "project_name": data["project_name"],
        "amount": amount,
        "adjusted_amount": 0.0,
        "outstanding_balance": amount,
        "payment_mode": data.get("payment_mode", "Cash"),
        "reference_no": data.get("reference_no", ""),
        "payment_date": data.get("payment_date") or datetime.now().strftime("%Y-%m-%d"),
        "remarks": data.get("remarks", ""),
        "status": "Active",
        "approval_status": "Draft",
        "approved_by": "",
        "approved_at": None,
        "rejection_reason": "",
        "adjustments": [],
        "created_by": current_user.get("full_name") or current_user.get("username", ""),
        "created_at": datetime.now().isoformat(),
        "closed_at": None,
    }

    result = await db.subcontractor_advances.insert_one(adv_dict)

    # Note: expense is NOT created here. It will be created on admin approval.

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Create SC Advance",
        f"Advance {advance_no} of Rs.{amount:,.0f} drafted for {contractor} | Project: {adv_dict['project_name']}",
        "info"
    )

    new_adv = await db.subcontractor_advances.find_one({"_id": result.inserted_id})
    return advance_helper(new_adv)


@router.get("/advances/{advance_id}", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_advance(advance_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    return advance_helper(adv)


@router.put("/advances/{advance_id}", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def update_advance(
    advance_id: str,
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")

    if adv.get("adjusted_amount", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot edit an advance that has already been adjusted against bills")

    valid_fields = ["contractor_name", "project_id", "project_name", "amount",
                    "payment_mode", "reference_no", "payment_date", "remarks"]
    update_data = {k: v for k, v in data.items() if k in valid_fields}

    if "amount" in update_data:
        new_amount = float(update_data["amount"] or 0)
        if new_amount <= 0:
            raise HTTPException(status_code=400, detail="Advance amount must be positive")
        update_data["amount"] = new_amount
        update_data["outstanding_balance"] = new_amount

    await db.subcontractor_advances.update_one({"_id": ObjectId(advance_id)}, {"$set": update_data})
    updated = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    return advance_helper(updated)


@router.delete("/advances/{advance_id}", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def delete_advance(advance_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    if adv.get("adjusted_amount", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete an advance that has already been adjusted against bills")
    if adv.get("approval_status") == "Approved":
        raise HTTPException(status_code=400, detail="Cannot delete an approved advance. Use refund or close instead.")

    await db.subcontractor_advances.delete_one({"_id": ObjectId(advance_id)})
    # Remove auto-created expense if it exists (in case the advance had been approved earlier)
    await db.expenses.delete_many({"sc_advance_id": advance_id})

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Delete SC Advance",
        f"Advance {adv.get('advance_no')} for {adv.get('contractor_name')} deleted",
        "warning"
    )
    return {"message": "Advance deleted"}


@router.put("/advances/{advance_id}/submit", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def submit_advance(advance_id: str, current_user: dict = Depends(get_current_user)):
    """Submit a Draft advance for admin approval."""
    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    if adv.get("approval_status") not in ("Draft", "Rejected"):
        raise HTTPException(status_code=400, detail="Only Draft or Rejected advances can be submitted")

    await db.subcontractor_advances.update_one(
        {"_id": ObjectId(advance_id)},
        {"$set": {"approval_status": "Pending Approval", "rejection_reason": ""}}
    )

    submitter = current_user.get("full_name") or current_user.get("username", "")
    try:
        await notify(
            db, submitter, ["Administrator", "General Manager"], EVENT_APPROVAL,
            "SC Advance Pending Approval",
            f"Advance {adv.get('advance_no')} of Rs.{adv.get('amount', 0):,.0f} for {adv.get('contractor_name')} needs approval.",
            entity_type="subcontractor_advance", entity_id=advance_id,
            project_name=adv.get("project_name"), priority="high"
        )
    except Exception:
        pass

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Submit SC Advance",
        f"Advance {adv.get('advance_no')} submitted for approval",
        "info"
    )
    return {"message": "Advance submitted for approval"}


@router.put("/advances/{advance_id}/approve")
async def approve_advance(advance_id: str, current_user: dict = Depends(get_current_user)):
    """Admin/GM approves an advance — creates the expense entry on approval."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can approve advances")

    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    if adv.get("approval_status") != "Pending Approval":
        raise HTTPException(status_code=400, detail="Advance is not pending approval")

    approver = current_user.get("full_name") or current_user.get("username", "")
    await db.subcontractor_advances.update_one(
        {"_id": ObjectId(advance_id)},
        {"$set": {
            "approval_status": "Approved",
            "approved_by": approver,
            "approved_at": datetime.now().isoformat(),
        }}
    )

    # Create the expense entry now (deferred from creation)
    expense_doc = {
        "date": adv.get("payment_date") or datetime.now().strftime("%Y-%m-%d"),
        "project": adv.get("project_name", ""),
        "category": "Subcontractor Advance",
        "amount": adv.get("amount", 0),
        "base_amount": adv.get("amount", 0),
        "gst_amount": 0,
        "paymentMode": adv.get("payment_mode", "Cash"),
        "payee": adv.get("contractor_name", ""),
        "reference": adv.get("reference_no", ""),
        "invoice_no": adv.get("advance_no", ""),
        "status": "Paid",
        "sc_advance_id": advance_id,
        "remarks": f"Advance to {adv.get('contractor_name')}",
        "created_at": datetime.now().isoformat(),
        "created_by": approver,
    }
    await db.expenses.insert_one(expense_doc)

    try:
        await notify(
            db, approver, ["Accountant"], EVENT_APPROVAL,
            "SC Advance Approved",
            f"Advance {adv.get('advance_no')} for {adv.get('contractor_name')} (Rs.{adv.get('amount', 0):,.0f}) approved by {approver}.",
            entity_type="subcontractor_advance", entity_id=advance_id,
            project_name=adv.get("project_name"), priority="high"
        )
    except Exception:
        pass

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Approve SC Advance",
        f"Advance {adv.get('advance_no')} for {adv.get('contractor_name')} approved",
        "success"
    )
    return {"message": "Advance approved"}


@router.put("/advances/{advance_id}/reject")
async def reject_advance(
    advance_id: str,
    body: dict = Body(default={}),
    current_user: dict = Depends(get_current_user)
):
    """Admin/GM rejects an advance."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can reject advances")

    if not ObjectId.is_valid(advance_id):
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.subcontractor_advances.find_one({"_id": ObjectId(advance_id)})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    if adv.get("approval_status") != "Pending Approval":
        raise HTTPException(status_code=400, detail="Advance is not pending approval")

    reason = body.get("reason", "")
    await db.subcontractor_advances.update_one(
        {"_id": ObjectId(advance_id)},
        {"$set": {"approval_status": "Rejected", "rejection_reason": reason}}
    )

    try:
        rejector = current_user.get("full_name") or current_user.get("username", "")
        await notify(
            db, rejector, ["Accountant"], EVENT_APPROVAL,
            "SC Advance Rejected",
            f"Advance {adv.get('advance_no')} for {adv.get('contractor_name')} rejected. Reason: {reason or 'No reason given'}",
            entity_type="subcontractor_advance", entity_id=advance_id,
            project_name=adv.get("project_name"), priority="high"
        )
    except Exception:
        pass

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Reject SC Advance",
        f"Advance {adv.get('advance_no')} rejected. Reason: {reason}",
        "warning"
    )
    return {"message": "Advance rejected"}


@router.get("/dpr-work", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_dpr_contractor_work(
    project_name: Optional[str] = None,
    contractor_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Fetch approved DPR contractor_rows for billing — grouped by contractor."""
    query = {}
    if project_name:
        query["name"] = project_name

    projects = await db.projects.find(query, {"name": 1, "dprs": 1}).to_list(100)

    # Collect billed DPR+contractor combos to track per-row billing
    billed_combos = set()
    existing_bills = await db.subcontractor_bills.find(
        {}, {"dpr_references": 1, "contractor_name": 1}
    ).to_list(1000)
    for bill in existing_bills:
        cn = bill.get("contractor_name", "")
        for ref in bill.get("dpr_references", []):
            billed_combos.add(f"{ref}::{cn}")

    result = []
    for proj in projects:
        for dpr in proj.get("dprs", []):
            dpr_status = (dpr.get("status") or "").lower()
            if dpr_status not in ("approved", "coordinator approved", "dept approved"):
                continue
            for row in dpr.get("contractor_rows", []):
                c_name = row.get("contractor") or row.get("contractor_name") or ""
                if not c_name:
                    continue
                if contractor_name and c_name.lower() != contractor_name.lower():
                    continue
                dpr_id = dpr.get("id", "")
                combo_key = f"{dpr_id}::{c_name}"
                result.append({
                    "project_name": proj.get("name", ""),
                    "project_id": str(proj["_id"]),
                    "dpr_id": dpr_id,
                    "dpr_date": dpr.get("date", ""),
                    "dpr_status": dpr.get("status", ""),
                    "contractor_name": c_name,
                    "work_title": row.get("title", ""),
                    "progress": row.get("progress", ""),
                    "overall": row.get("overall", ""),
                    "already_billed": combo_key in billed_combos
                })

    return result


@router.get("/contractor-summary", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_contractor_summary(current_user: dict = Depends(get_current_user)):
    """Aggregate billing summary per contractor."""
    bills = await db.subcontractor_bills.find({}).to_list(1000)
    summary = {}
    for bill in bills:
        cn = bill.get("contractor_name", "Unknown")
        if cn not in summary:
            summary[cn] = {"total_bills": 0, "total_amount": 0, "paid": 0, "pending": 0, "statuses": {}}
        summary[cn]["total_bills"] += 1
        summary[cn]["total_amount"] += bill.get("payable_amount", 0)
        summary[cn]["paid"] += bill.get("paid_amount", 0)
        summary[cn]["pending"] += bill.get("balance", 0)
        st = bill.get("status", "Draft")
        summary[cn]["statuses"][st] = summary[cn]["statuses"].get(st, 0) + 1

    return [{"contractor_name": k, **v} for k, v in summary.items()]


@router.get("/", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def list_bills(
    project_name: Optional[str] = None,
    contractor_name: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if project_name:
        query["project_name"] = project_name
    if contractor_name:
        query["contractor_name"] = contractor_name
    if status_filter:
        query["status"] = status_filter

    bills = await db.subcontractor_bills.find(query).sort("created_at", -1).to_list(500)
    return [bill_helper(b) for b in bills]


@router.get("/{bill_id}", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")
    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill_helper(bill)


@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def create_bill(
    bill_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not bill_data.get("contractor_name"):
        raise HTTPException(status_code=400, detail="Contractor name is required")
    if not bill_data.get("project_name"):
        raise HTTPException(status_code=400, detail="Project name is required")

    payable = float(bill_data.get("payable_amount", 0) or 0)
    if payable < 0:
        raise HTTPException(status_code=400, detail="Payable amount cannot be negative")

    # Validate advance adjustments against current outstanding balances
    raw_adjustments = bill_data.get("advance_adjustments") or []
    advance_adjustments = []
    advance_recovery_total = 0.0
    for entry in raw_adjustments:
        adv_id = entry.get("advance_id")
        adj_amount = float(entry.get("amount", 0) or 0)
        if adj_amount <= 0 or not adv_id or not ObjectId.is_valid(adv_id):
            continue
        adv = await db.subcontractor_advances.find_one({"_id": ObjectId(adv_id)})
        if not adv:
            raise HTTPException(status_code=400, detail=f"Advance {adv_id} not found")
        if adv.get("contractor_name") != bill_data["contractor_name"]:
            raise HTTPException(status_code=400, detail=f"Advance {adv.get('advance_no')} belongs to a different contractor")
        if adj_amount > adv.get("outstanding_balance", 0) + 0.01:
            raise HTTPException(status_code=400, detail=f"Adjustment for advance {adv.get('advance_no')} exceeds outstanding balance (Rs.{adv.get('outstanding_balance', 0):,.2f})")
        advance_adjustments.append({
            "advance_id": adv_id,
            "advance_no": adv.get("advance_no", ""),
            "amount": adj_amount,
        })
        advance_recovery_total += adj_amount

    bill_no = await generate_bill_no()
    bill_dict = {
        "bill_no": bill_no,
        "project_id": bill_data.get("project_id", ""),
        "project_name": bill_data["project_name"],
        "contractor_name": bill_data["contractor_name"],
        "bill_type": bill_data.get("bill_type", "work_based"),
        "bill_date": bill_data.get("bill_date", ""),
        "period_from": bill_data.get("period_from", ""),
        "period_to": bill_data.get("period_to", ""),
        "agreement_no": bill_data.get("agreement_no", ""),
        "mbook_entries": bill_data.get("mbook_entries", []),
        "day_entries": bill_data.get("day_entries", []),
        "dpr_references": bill_data.get("dpr_references", []),
        "labour_attendance_refs": bill_data.get("labour_attendance_refs", []),
        "gross_amount": float(bill_data.get("gross_amount", 0) or 0),
        "deductions": bill_data.get("deductions", []),
        "total_deductions": float(bill_data.get("total_deductions", 0) or 0),
        "net_amount": float(bill_data.get("net_amount", 0) or 0),
        "gst_percent": float(bill_data.get("gst_percent", 0) or 0),
        "gst_amount": float(bill_data.get("gst_amount", 0) or 0),
        "payable_amount": payable,
        "mbook_page_no": bill_data.get("mbook_page_no", ""),
        "mbook_serial_no": bill_data.get("mbook_serial_no", ""),
        "measured_by": bill_data.get("measured_by") or {"name": "", "designation": "", "date": ""},
        "checked_by": bill_data.get("checked_by") or {"name": "", "designation": "", "date": ""},
        "verified_by": bill_data.get("verified_by") or {"name": "", "designation": "", "date": ""},
        "notes": bill_data.get("notes", ""),
        "status": "Draft",
        "created_by": current_user.get("full_name") or current_user.get("username", ""),
        "created_at": datetime.now().isoformat(),
        "approved_by": "",
        "approved_at": None,
        "rejection_reason": "",
        "paid_amount": 0,
        "balance": payable,
        "payments": [],
        "advance_adjustments": advance_adjustments,
        "advance_recovery_total": advance_recovery_total,
    }

    result = await db.subcontractor_bills.insert_one(bill_dict)

    await log_activity(
        db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Create SC Bill",
        f"Subcontractor bill {bill_no} created for {bill_dict['contractor_name']} | Project: {bill_dict['project_name']} | Amount: Rs.{payable:,.0f}",
        "info"
    )

    new_bill = await db.subcontractor_bills.find_one({"_id": result.inserted_id})
    return bill_helper(new_bill)


@router.put("/{bill_id}", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def update_bill(
    bill_id: str,
    bill_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")

    existing = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Bill not found")

    if existing.get("status") not in ("Draft", "Rejected"):
        raise HTTPException(status_code=400, detail="Can only edit bills in Draft or Rejected status")

    valid_fields = [
        "project_id", "project_name", "contractor_name", "bill_type", "bill_date",
        "period_from", "period_to", "agreement_no", "mbook_entries", "day_entries",
        "dpr_references", "labour_attendance_refs", "gross_amount", "deductions",
        "total_deductions", "net_amount", "gst_percent", "gst_amount", "payable_amount",
        "mbook_page_no", "mbook_serial_no", "measured_by", "checked_by", "verified_by", "notes"
    ]
    update_data = {k: v for k, v in bill_data.items() if k in valid_fields}

    # Re-validate advance adjustments on edit (only for Draft/Rejected bills, which can't have been applied yet)
    if "advance_adjustments" in bill_data:
        raw_adjustments = bill_data.get("advance_adjustments") or []
        new_adjustments = []
        new_recovery_total = 0.0
        contractor = update_data.get("contractor_name") or existing.get("contractor_name")
        for entry in raw_adjustments:
            adv_id = entry.get("advance_id")
            adj_amount = float(entry.get("amount", 0) or 0)
            if adj_amount <= 0 or not adv_id or not ObjectId.is_valid(adv_id):
                continue
            adv = await db.subcontractor_advances.find_one({"_id": ObjectId(adv_id)})
            if not adv:
                raise HTTPException(status_code=400, detail=f"Advance {adv_id} not found")
            if adv.get("contractor_name") != contractor:
                raise HTTPException(status_code=400, detail=f"Advance {adv.get('advance_no')} belongs to a different contractor")
            if adj_amount > adv.get("outstanding_balance", 0) + 0.01:
                raise HTTPException(status_code=400, detail=f"Adjustment for advance {adv.get('advance_no')} exceeds outstanding balance")
            new_adjustments.append({
                "advance_id": adv_id,
                "advance_no": adv.get("advance_no", ""),
                "amount": adj_amount,
            })
            new_recovery_total += adj_amount
        update_data["advance_adjustments"] = new_adjustments
        update_data["advance_recovery_total"] = new_recovery_total

    if "payable_amount" in update_data:
        update_data["payable_amount"] = float(update_data["payable_amount"] or 0)
        update_data["balance"] = update_data["payable_amount"] - existing.get("paid_amount", 0)

    if existing.get("status") == "Rejected":
        update_data["status"] = "Draft"
        update_data["rejection_reason"] = ""

    await db.subcontractor_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": update_data}
    )

    updated = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    return bill_helper(updated)


@router.put("/{bill_id}/submit", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def submit_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    """Submit bill for admin approval."""
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")

    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.get("status") not in ("Draft", "Rejected"):
        raise HTTPException(status_code=400, detail="Only Draft or Rejected bills can be submitted")

    if (bill.get("payable_amount") or 0) <= 0:
        raise HTTPException(status_code=400, detail="Cannot submit a bill with zero payable amount")

    await db.subcontractor_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {"status": "Pending Approval", "rejection_reason": ""}}
    )

    try:
        submitter = current_user.get("full_name") or current_user.get("username", "")
        await notify(
            db, submitter, ["Administrator", "General Manager"], EVENT_APPROVAL,
            "SC Bill Pending Approval",
            f"Subcontractor bill {bill.get('bill_no')} for {bill.get('contractor_name')} (Rs.{bill.get('payable_amount', 0):,.0f}) needs approval.",
            entity_type="subcontractor_bill", entity_id=bill_id,
            project_name=bill.get("project_name"), priority="high"
        )
    except Exception:
        pass

    await log_activity(db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Submit SC Bill", f"Bill {bill.get('bill_no')} submitted for approval", "info")

    return {"message": "Bill submitted for approval"}


@router.put("/{bill_id}/approve")
async def approve_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    """Admin approves subcontractor bill."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can approve subcontractor bills")

    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")

    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.get("status") != "Pending Approval":
        raise HTTPException(status_code=400, detail="Bill is not pending approval")

    approver = current_user.get("full_name") or current_user.get("username", "")

    # Apply advance adjustments atomically: re-check outstanding and deduct
    adjustments = bill.get("advance_adjustments") or []
    applied_adjustments = []
    for adj in adjustments:
        adv_id = adj.get("advance_id")
        amt = float(adj.get("amount", 0) or 0)
        if amt <= 0 or not adv_id or not ObjectId.is_valid(adv_id):
            continue
        adv = await db.subcontractor_advances.find_one({"_id": ObjectId(adv_id)})
        if not adv:
            # Rollback already-applied adjustments
            for prev in applied_adjustments:
                await _restore_advance(prev["advance_id"], prev["amount"], bill.get("bill_no", ""))
            raise HTTPException(status_code=400, detail=f"Advance {adj.get('advance_no', adv_id)} no longer exists")
        if amt > adv.get("outstanding_balance", 0) + 0.01:
            for prev in applied_adjustments:
                await _restore_advance(prev["advance_id"], prev["amount"], bill.get("bill_no", ""))
            raise HTTPException(status_code=400, detail=f"Advance {adv.get('advance_no')} outstanding balance changed; cannot apply Rs.{amt:,.2f}")

        new_adjusted = adv.get("adjusted_amount", 0) + amt
        new_outstanding = adv.get("outstanding_balance", 0) - amt
        new_status = "Closed" if new_outstanding <= 0.01 else "Partially Adjusted"
        log_entry = {
            "bill_id": bill_id,
            "bill_no": bill.get("bill_no", ""),
            "amount": amt,
            "adjusted_at": datetime.now().isoformat(),
            "adjusted_by": approver,
        }
        set_dict = {
            "adjusted_amount": new_adjusted,
            "outstanding_balance": max(new_outstanding, 0),
            "status": new_status,
        }
        if new_status == "Closed":
            set_dict["closed_at"] = datetime.now().isoformat()
        await db.subcontractor_advances.update_one(
            {"_id": ObjectId(adv_id)},
            {"$push": {"adjustments": log_entry}, "$set": set_dict}
        )
        applied_adjustments.append({"advance_id": adv_id, "amount": amt})

    # If payable is fully covered by advance recovery, mark as Paid; else Approved
    payable = bill.get("payable_amount", 0) or 0
    recovery_total = bill.get("advance_recovery_total", 0) or 0
    new_paid = bill.get("paid_amount", 0) + recovery_total
    new_balance = max(payable - new_paid, 0)
    final_status = "Paid" if new_balance <= 0.01 and payable > 0 else "Approved"

    await db.subcontractor_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {
            "status": final_status,
            "approved_by": approver,
            "approved_at": datetime.now().isoformat(),
            "paid_amount": new_paid,
            "balance": new_balance,
        }}
    )

    try:
        await notify(db, approver, ["Accountant"], EVENT_APPROVAL,
            "SC Bill Approved",
            f"Bill {bill.get('bill_no')} for {bill.get('contractor_name')} approved by {approver}. Ready for payment.",
            entity_type="subcontractor_bill", entity_id=bill_id,
            project_name=bill.get("project_name"), priority="high")
    except Exception:
        pass

    await log_activity(db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Approve SC Bill", f"Bill {bill.get('bill_no')} approved for {bill.get('contractor_name')}", "success")

    return {"message": "Bill approved"}


@router.put("/{bill_id}/reject")
async def reject_bill(
    bill_id: str,
    body: dict = Body(default={}),
    current_user: dict = Depends(get_current_user)
):
    """Admin rejects subcontractor bill."""
    allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only Admin/GM can reject subcontractor bills")

    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")

    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.get("status") != "Pending Approval":
        raise HTTPException(status_code=400, detail="Bill is not pending approval")

    reason = body.get("reason", "")
    await db.subcontractor_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {"status": "Rejected", "rejection_reason": reason}}
    )

    try:
        rejector = current_user.get("full_name") or current_user.get("username", "")
        await notify(db, rejector, ["Accountant"], EVENT_APPROVAL,
            "SC Bill Rejected",
            f"Bill {bill.get('bill_no')} for {bill.get('contractor_name')} rejected. Reason: {reason or 'No reason given'}",
            entity_type="subcontractor_bill", entity_id=bill_id,
            project_name=bill.get("project_name"), priority="high")
    except Exception:
        pass

    await log_activity(db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Reject SC Bill", f"Bill {bill.get('bill_no')} rejected. Reason: {reason}", "warning")

    return {"message": "Bill rejected"}


@router.post("/{bill_id}/payment", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def record_payment(
    bill_id: str,
    payment: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Record a payment against an approved subcontractor bill."""
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")

    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.get("status") not in ("Approved", "Partially Paid"):
        raise HTTPException(status_code=400, detail="Bill must be Approved before payment")

    amount = float(payment.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    current_balance = bill.get("balance", bill.get("payable_amount", 0))
    if amount > current_balance + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment amount ({amount}) exceeds balance ({current_balance})")

    payment_entry = {
        "payment_id": str(ObjectId()),
        "date": payment.get("date", datetime.now().strftime("%Y-%m-%d")),
        "amount": amount,
        "mode": payment.get("mode", "Cash"),
        "reference": payment.get("reference", ""),
        "remarks": payment.get("remarks", ""),
        "recorded_by": current_user.get("full_name") or current_user.get("username", ""),
        "recorded_at": datetime.now().isoformat()
    }

    new_paid = bill.get("paid_amount", 0) + amount
    new_balance = bill.get("payable_amount", 0) - new_paid
    new_status = "Paid" if new_balance <= 0.01 else "Partially Paid"

    await db.subcontractor_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {
            "$push": {"payments": payment_entry},
            "$set": {
                "paid_amount": new_paid,
                "balance": max(new_balance, 0),
                "status": new_status
            }
        }
    )

    expense_doc = {
        "date": payment_entry["date"],
        "project": bill.get("project_name", ""),
        "category": "Subcontractor Payment",
        "amount": amount,
        "base_amount": amount,
        "gst_amount": 0,
        "paymentMode": payment_entry["mode"],
        "payee": bill.get("contractor_name", ""),
        "reference": payment_entry["reference"],
        "invoice_no": bill.get("bill_no", ""),
        "status": "Paid",
        "sc_bill_id": bill_id,
        "created_at": datetime.now().isoformat(),
        "created_by": payment_entry["recorded_by"]
    }
    await db.expenses.insert_one(expense_doc)

    await log_activity(db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "SC Bill Payment",
        f"Payment of Rs.{amount:,.0f} recorded for {bill.get('bill_no')} ({bill.get('contractor_name')}). Status: {new_status}",
        "success")

    if new_status == "Paid":
        try:
            await notify(db, payment_entry["recorded_by"], ["Administrator", "General Manager"], EVENT_WORKFLOW,
                "SC Bill Fully Paid",
                f"Bill {bill.get('bill_no')} for {bill.get('contractor_name')} is fully paid (Rs.{new_paid:,.0f}).",
                entity_type="subcontractor_bill", entity_id=bill_id,
                project_name=bill.get("project_name"), priority="normal")
        except Exception:
            pass

    updated = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    return bill_helper(updated)


@router.get("/{bill_id}/payments", dependencies=[Depends(RBACPermission("Accounts", "view"))])
async def get_payments(bill_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")
    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill.get("payments", [])


@router.delete("/{bill_id}", dependencies=[Depends(RBACPermission("Accounts", "edit"))])
async def delete_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=400, detail="Invalid bill ID")
    bill = await db.subcontractor_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.get("status") not in ("Draft",):
        raise HTTPException(status_code=400, detail="Only draft bills can be deleted")

    await db.subcontractor_bills.delete_one({"_id": ObjectId(bill_id)})

    await log_activity(db, str(current_user.get("_id", "")), current_user.get("username", ""),
        "Delete SC Bill", f"Draft bill {bill.get('bill_no')} for {bill.get('contractor_name')} deleted", "warning")

    return {"message": "Bill deleted"}
