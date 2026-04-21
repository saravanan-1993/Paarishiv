"""
Labour Attendance API — per-project daily labour count tracking.

Site Engineer enters count of labourers per category (Skilled, Unskilled, etc.)
with daily wage rate. No individual names — just headcount + cost.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from typing import List, Optional
from database import get_database
from pydantic import BaseModel
from datetime import datetime

from app.utils.auth import get_current_user, validate_object_id
from app.utils.logging import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/labour-attendance", tags=["labour-attendance"])


# ── Models ────────────────────────────────────────────────────────────────────

class CategoryEntry(BaseModel):
    party: str = ""                      # Contractor / Party name (from vendors)
    category: str = ""                   # Workforce category (Mason, Painter, etc. from rate_card)
    count: int = 0
    daily_wage: float = 0
    shift: str = "1"
    ot: str = "0"
    overtime_count: int = 0
    overtime_hours: float = 0


class LabourAttendanceCreate(BaseModel):
    project_id: str
    project_name: str
    date: str                            # YYYY-MM-DD
    categories: List[CategoryEntry]
    site_remarks: Optional[str] = ""


class SalaryProcessPayload(BaseModel):
    project_name: str
    party: Optional[str] = ""
    category: str
    date: Optional[str] = ""
    period_from: str
    period_to: str
    total_heads: int
    total_days: float
    daily_wage: float
    total_amount: float
    deductions: float = 0
    net_amount: float
    payment_mode: str = "Cash"
    remarks: Optional[str] = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _helper(doc) -> dict:
    cats = doc.get("categories", [])
    total_count = sum(c.get("count", 0) for c in cats)
    day_cost = _compute_day_cost(cats)
    return {
        "id": str(doc["_id"]),
        "project_id": doc.get("project_id", ""),
        "project_name": doc.get("project_name", ""),
        "date": doc.get("date", ""),
        "categories": cats,
        "total_count": total_count,
        "day_cost": day_cost,
        "site_remarks": doc.get("site_remarks", ""),
        "marked_by": doc.get("marked_by", ""),
        "verified": doc.get("verified", False),
        "verified_by": doc.get("verified_by", ""),
        "verified_at": doc.get("verified_at"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _compute_day_cost(categories: list) -> float:
    total = 0.0
    for c in categories:
        count = int(c.get("count", 0) or 0)
        wage = float(c.get("daily_wage", 0) or 0)
        shift = float(c.get("shift", 1) or 1)
        ot_hours = float(c.get("overtime_hours", 0) or c.get("ot", 0) or 0)
        total += count * wage * shift
        if ot_hours > 0 and wage > 0 and count > 0:
            hourly = wage / 8
            total += count * hourly * 1.5 * ot_hours
    return round(total, 2)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_labour_attendance(
    project_id: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if project_id:
        query["project_id"] = project_id
    if project_name:
        query["project_name"] = project_name
    if date:
        query["date"] = date
    elif date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["date"] = date_q

    rows = await db.labour_attendance.find(query).sort("date", -1).to_list(500)
    return [_helper(r) for r in rows]


@router.get("/project-summary")
async def project_labour_summary(
    project_name: str = Query(...),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    rows = await db.labour_attendance.find({"project_name": project_name}).to_list(1000)
    total_cost = 0.0
    total_days = len(rows)
    total_heads = 0
    cat_agg = {}
    for r in rows:
        for c in r.get("categories", []):
            cat = c.get("category", "Unskilled")
            count = int(c.get("count", 0) or 0)
            wage = float(c.get("daily_wage", 0) or 0)
            ot_count = int(c.get("overtime_count", 0) or 0)
            ot_hours = float(c.get("overtime_hours", 0) or 0)
            shift = float(c.get("shift", 1) or 1)
            ot_hrs = float(c.get("ot", 0) or c.get("overtime_hours", 0) or 0)
            day_cost = count * wage * shift
            if ot_hrs > 0 and wage > 0 and count > 0:
                day_cost += count * (wage / 8) * 1.5 * ot_hrs
            if cat not in cat_agg:
                cat_agg[cat] = {"total_heads": 0, "cost": 0, "days": 0, "avg_wage": 0, "wage_sum": 0}
            cat_agg[cat]["total_heads"] += count
            cat_agg[cat]["cost"] += day_cost
            cat_agg[cat]["days"] += 1
            cat_agg[cat]["wage_sum"] += wage
            total_cost += day_cost
            total_heads += count

    for k, v in cat_agg.items():
        v["cost"] = round(v["cost"], 2)
        v["avg_wage"] = round(v["wage_sum"] / v["days"], 2) if v["days"] else 0
        del v["wage_sum"]

    return {
        "project_name": project_name,
        "total_cost": round(total_cost, 2),
        "total_days_recorded": total_days,
        "total_heads": total_heads,
        "categories": cat_agg,
    }


@router.get("/wages-summary")
async def wages_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["date"] = date_q

    rows = await db.labour_attendance.find(query).to_list(2000)
    # Aggregate per project + category
    ledger = {}
    for r in rows:
        proj = r.get("project_name", "")
        for c in r.get("categories", []):
            cat = c.get("category", "Unskilled")
            count = int(c.get("count", 0) or 0)
            if count == 0:
                continue
            wage = float(c.get("daily_wage", 0) or 0)
            ot_count = int(c.get("overtime_count", 0) or 0)
            ot_hours = float(c.get("overtime_hours", 0) or 0)
            shift = float(c.get("shift", 1) or 1)
            ot_hrs = float(c.get("ot", 0) or c.get("overtime_hours", 0) or 0)
            day_cost = count * wage * shift
            if ot_hrs > 0 and wage > 0 and count > 0:
                day_cost += count * (wage / 8) * 1.5 * ot_hrs

            party = c.get("party", "")
            key = f"{proj}||{party}||{cat}"
            if key not in ledger:
                ledger[key] = {
                    "project_name": proj,
                    "party": party,
                    "category": cat,
                    "daily_wage": wage,
                    "total_heads": 0,
                    "days_recorded": 0,
                    "overtime_hours": 0,
                    "total_wage": 0,
                }
            entry = ledger[key]
            entry["total_heads"] += count
            entry["days_recorded"] += 1
            entry["overtime_hours"] += ot_count * ot_hours
            entry["total_wage"] += day_cost

    result = sorted(ledger.values(), key=lambda x: (x["project_name"], x["party"], x["category"]))
    for r in result:
        r["total_wage"] = round(r["total_wage"], 2)
    return result


@router.get("/salary-payments")
async def get_salary_payments(
    project_name: Optional[str] = Query(None),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if project_name:
        query["project_name"] = project_name
    rows = await db.labour_salary_payments.find(query).sort("created_at", -1).to_list(500)
    for r in rows:
        r["id"] = str(r["_id"])
        del r["_id"]
    return rows


@router.get("/{id}")
async def get_labour_attendance(id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(id, "Labour Attendance ID")
    doc = await db.labour_attendance.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return _helper(doc)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_labour_attendance(
    payload: LabourAttendanceCreate,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    existing = await db.labour_attendance.find_one({
        "project_id": payload.project_id,
        "date": payload.date,
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Attendance already recorded for this project on {payload.date}. Use update instead.",
        )

    data = payload.model_dump()
    data["marked_by"] = current_user.get("full_name") or current_user.get("username")
    data["created_at"] = datetime.now()
    data["updated_at"] = datetime.now()

    result = await db.labour_attendance.insert_one(data)
    doc = await db.labour_attendance.find_one({"_id": result.inserted_id})

    total = sum(c.get("count", 0) for c in data["categories"])
    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Labour Attendance",
        f"Marked {total} labourers | Project: {data['project_name']} | Date: {data['date']}",
        "info",
    )
    return _helper(doc)


@router.put("/{id}")
async def update_labour_attendance(
    id: str,
    payload: LabourAttendanceCreate,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    oid = validate_object_id(id, "Labour Attendance ID")
    existing = await db.labour_attendance.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    data = payload.model_dump()
    data["updated_at"] = datetime.now()
    data["updated_by"] = current_user.get("full_name") or current_user.get("username")

    await db.labour_attendance.update_one({"_id": oid}, {"$set": data})
    doc = await db.labour_attendance.find_one({"_id": oid})
    return _helper(doc)


@router.delete("/{id}")
async def delete_labour_attendance(
    id: str,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    oid = validate_object_id(id, "Labour Attendance ID")
    doc = await db.labour_attendance.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.labour_attendance.delete_one({"_id": oid})
    return {"success": True}


@router.post("/process-salary")
async def process_salary(
    payload: SalaryProcessPayload,
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    data = payload.model_dump()
    data["processed_by"] = current_user.get("full_name") or current_user.get("username")
    data["created_at"] = datetime.now()
    data["status"] = "Paid"

    result = await db.labour_salary_payments.insert_one(data)

    # Also create an expense record so it shows in Finance → Payments
    expense_record = {
        "category": "Labour Wages",
        "amount": data["net_amount"],
        "project": data["project_name"],
        "payee": data.get("party") or data.get("category", "Labour"),
        "paymentMode": data.get("payment_mode", "Cash"),
        "reference": f"Labour-{data.get('date', '')}",
        "description": f"Labour wages: {data.get('category', '')} — {data.get('date', '')} ({data.get('total_heads', 0)} heads)",
        "date": data.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "base_amount": data["net_amount"],
        "gst_amount": 0,
        "approved_by": data["processed_by"],
        "source": "labour_salary",
    }
    await db.expenses.insert_one(expense_record)

    # Update project spent amount
    if data.get("project_name"):
        await db.projects.update_one(
            {"name": data["project_name"]},
            {"$inc": {"spent": data["net_amount"]}}
        )

    await log_activity(
        db,
        str(current_user.get("_id", current_user.get("username", "system"))),
        current_user.get("username", "system"),
        "Process Labour Salary",
        f"Paid ₹{data['net_amount']} for {data['category']} | Project: {data['project_name']}",
        "success",
    )

    data["id"] = str(result.inserted_id)
    data.pop("_id", None)
    return data
