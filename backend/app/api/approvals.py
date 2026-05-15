from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import re
from datetime import datetime
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import RBACPermission, require_sub_tab, has_sub_tab_access, fetch_role_doc, get_users_with_permission
from app.utils.notifications import notify, get_project_stakeholders, EVENT_APPROVAL

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/", response_model=Dict[str, List[Any]], dependencies=[Depends(RBACPermission("Approvals", "view"))])
async def get_all_approvals(status: str = "Pending", current_user=Depends(get_current_user), db=Depends(get_database)):
    results = {
        "leaves": [],
        "purchase_orders": [],
        "materials": [],
        "expenses": [],
        "manpower": [],
        "dprs": [],
        "subcontractor_bills": [],
        "subcontractor_advances": [],
        "labour_payments": [],
        "stock_returns": [],
        "material_transfers": [],
        "payment_requests": [],
        "trip_requests": []
    }
    
    query = {}
    if status.lower() != "all":
        # C7 Fix: Escape user input in regex to prevent NoSQL injection
        query["status"] = {"$regex": f"^{re.escape(status)}$", "$options": "i"}

    # Pre-fetch employees to resolve IDs/usernames to names
    employees = await db.employees.find({}, {"fullName": 1, "_id": 1, "username": 1, "employeeCode": 1}).to_list(1000)
    emp_map = {}
    for e in employees:
        full_name = e.get("fullName", "Unknown")
        if "_id" in e: emp_map[str(e["_id"])] = full_name
        if "username" in e: emp_map[e["username"]] = full_name
        if "employeeCode" in e: emp_map[e["employeeCode"]] = full_name

    def resolve_names(item):
        """Helper to resolve engineer_id/approvedBy to fullName."""
        for field in ["engineer_id", "approvedBy", "requested_by", "submitted_by"]:
            val = item.get(field)
            if val and val in emp_map:
                item[field] = emp_map[val]
        return item

    leaves = await db.leaves.find(query).sort("_id", -1).to_list(100)
    for l in leaves:
        l["_id"] = str(l["_id"])
        resolve_names(l)
        for k, v in l.items():
            if hasattr(v, "isoformat"):
                l[k] = str(v)
    results["leaves"] = leaves
    
    pos = await db.purchase_orders.find(query).sort("_id", -1).to_list(100)
    for po in pos:
        po["_id"] = str(po["_id"])
        resolve_names(po)
        if "created_at" in po:
            po["created_at"] = str(po["created_at"])
    results["purchase_orders"] = pos
    
    mats = await db.material_requests.find(query).sort("_id", -1).to_list(100)
    for m in mats:
        m["_id"] = str(m["_id"])
        resolve_names(m)
        for k, v in m.items():
            if hasattr(v, "isoformat"):
                m[k] = str(v)
    results["materials"] = mats
    
    # Approvals → Expenses tab shows GENERIC expenses only (manually recorded
    # cash/bank/UPI expenses without a GRN link). Vendor-payment expenses (those
    # backed by a GRN) belong in the "Vendor Payments" tab and must be excluded
    # here, otherwise the same liability shows up in two approval queues.
    expense_query = dict(query)
    expense_query["$and"] = [
        {"$or": [
            {"grn_id": {"$exists": False}},
            {"grn_id": None},
            {"grn_id": ""},
        ]},
        {"$or": [
            {"category": {"$exists": False}},
            {"category": {"$ne": "Material Purchase"}},
        ]},
    ]
    exps = await db.expenses.find(expense_query).sort("_id", -1).to_list(100)
    for ex in exps:
        ex["_id"] = str(ex["_id"])
        resolve_names(ex)
        for k, v in ex.items():
            if hasattr(v, "isoformat"):
                ex[k] = str(v)
    results["expenses"] = exps
    
    manpower = await db.manpower_requests.find(query).sort("_id", -1).to_list(100)
    for mp in manpower:
        mp["_id"] = str(mp["_id"])
        resolve_names(mp)
        for k, v in mp.items():
            if hasattr(v, "isoformat"):
                mp[k] = str(v)
    results["manpower"] = manpower

    # Dynamic per-entity visibility — purely driven by which Approvals sub-tabs
    # the user's role has access to. Load the role doc ONCE and reuse for all
    # sub-tab checks below (single DB round-trip instead of 8).
    show_all = status.lower() == "all"
    role_doc = await fetch_role_doc(db, current_user.get("role"))
    can_dpr             = await has_sub_tab_access(db, current_user, "Approvals", "DPR",             role_doc=role_doc)
    can_sc_bills        = await has_sub_tab_access(db, current_user, "Approvals", "SC Bills",        role_doc=role_doc)
    can_sc_advances     = await has_sub_tab_access(db, current_user, "Approvals", "SC Advances",     role_doc=role_doc)
    can_labour_pay      = await has_sub_tab_access(db, current_user, "Approvals", "Labour Pay",      role_doc=role_doc)
    can_stock_returns   = await has_sub_tab_access(db, current_user, "Approvals", "Stock Returns",   role_doc=role_doc)
    can_transfers       = await has_sub_tab_access(db, current_user, "Approvals", "Transfers",       role_doc=role_doc)
    can_vendor_payments = await has_sub_tab_access(db, current_user, "Approvals", "Vendor Payments", role_doc=role_doc)
    can_trip            = await has_sub_tab_access(db, current_user, "Approvals", "Trip Requests",   role_doc=role_doc)

    # DPRs
    if can_dpr:
        projects_with_dprs = await db.projects.find(
            {"dprs": {"$exists": True, "$ne": []}},
            {"dprs": 1, "name": 1}
        ).to_list(500)
        dpr_list = []
        for proj in projects_with_dprs:
            proj_id = str(proj["_id"])
            proj_name = proj.get("name", "Unknown Project")
            for dpr in (proj.get("dprs") or []):
                dpr_s = dpr.get("status", "Pending")
                if not show_all and dpr_s != "Pending":
                    continue
                # Consolidated audit trail — generic `approved_by`. No stage-specific
                # field names hardcoded. For legacy records that stored audit info in
                # fields ending with `_approved_by` (whatever the old stage names
                # were), we scan dynamically and surface the first non-empty value.
                approved_by_value = dpr.get("approved_by") or ""
                if not approved_by_value:
                    for _k, _v in dpr.items():
                        if _k.endswith("_approved_by") and isinstance(_v, str) and _v:
                            approved_by_value = _v
                            break
                    if not approved_by_value:
                        approved_by_value = dpr.get("status_updated_by", "")
                dpr_entry = {
                    "id": dpr.get("id", ""),
                    "project_id": proj_id,
                    "project_name": proj_name,
                    "date": dpr.get("date", ""),
                    "submitted_by": dpr.get("submitted_by", ""),
                    "status": dpr_s,
                    "status_updated_by": dpr.get("status_updated_by", ""),
                    "created_at": dpr.get("created_at", ""),
                    "progress": dpr.get("progress", ""),
                    "weather": dpr.get("weather", ""),
                    "approved_by": approved_by_value,
                }
                resolve_names(dpr_entry)
                dpr_list.append(dpr_entry)
        dpr_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        results["dprs"] = dpr_list

    # Subcontractor bills
    if can_sc_bills:
        sc_query = {"status": "Pending Approval"} if not show_all else {}
        sc_bills = await db.subcontractor_bills.find(sc_query).sort("created_at", -1).to_list(100)
        for sb in sc_bills:
            sb["_id"] = str(sb["_id"])
            resolve_names(sb)
        results["subcontractor_bills"] = sc_bills

    # Subcontractor advances
    if can_sc_advances:
        sa_query = {"approval_status": "Pending Approval"} if not show_all else {}
        sc_advances = await db.subcontractor_advances.find(sa_query).sort("created_at", -1).to_list(100)
        for sa in sc_advances:
            sa["_id"] = str(sa["_id"])
            resolve_names(sa)
        results["subcontractor_advances"] = sc_advances

    # Labour payment approvals
    if can_labour_pay:
        lp_query = {"payment_status": "Payment Requested"} if not show_all else {"payment_status": {"$exists": True, "$ne": ""}}
        from app.api.labour_attendance import _helper as la_helper, _compute_day_cost
        lp_records = await db.labour_attendance.find(lp_query).sort("updated_at", -1).to_list(100)
        for lp in lp_records:
            lp_entry = la_helper(lp)
            lp_entry["_id"] = str(lp["_id"])
            resolve_names(lp_entry)
            results["labour_payments"].append(lp_entry)

    # Stock return requests
    if can_stock_returns:
        sr_query = {"status": "Pending"} if not show_all else {}
        sr_records = await db.stock_return_requests.find(sr_query).sort("created_at", -1).to_list(100)
        for sr in sr_records:
            sr["_id"] = str(sr["_id"])
            for field in ["created_at", "approved_at"]:
                if field in sr and hasattr(sr[field], "isoformat"):
                    sr[field] = sr[field].isoformat()
            resolve_names(sr)
            results["stock_returns"].append(sr)

    # Material transfer requests
    if can_transfers:
        mt_statuses = ["Pending", "Approved", "Admin Approved"] if not show_all else ["Pending", "Approved", "Admin Approved", "Completed", "Rejected"]
        mt_records = await db.material_transfer_requests.find({"status": {"$in": mt_statuses}}).sort("created_at", -1).to_list(100)
        for mt in mt_records:
            mt["_id"] = str(mt["_id"])
            for field in ["created_at", "admin_approved_at", "executed_at"]:
                if field in mt and hasattr(mt[field], "isoformat"):
                    mt[field] = mt[field].isoformat()
            resolve_names(mt)
            results["material_transfers"].append(mt)

    # Payment requests (purchase payment approvals)
    if can_vendor_payments:
        pr_query = query.copy() if query else {}
        pr_records = await db.payment_requests.find(pr_query).sort("created_at", -1).to_list(100)
        for pr in pr_records:
            pr["_id"] = str(pr["_id"])
            resolve_names(pr)
            for k, v in pr.items():
                if hasattr(v, "isoformat"):
                    pr[k] = str(v)
        results["payment_requests"] = pr_records

    # Trip requests
    if can_trip:
        tr_query = {"status": "Pending"} if not show_all else {}
        tr_records = await db.trip_requests.find(tr_query).sort("created_at", -1).to_list(100)
        for tr in tr_records:
            tr["_id"] = str(tr["_id"])
            resolve_names(tr)
            for k, v in tr.items():
                if hasattr(v, "isoformat"):
                    tr[k] = str(v)
        results["trip_requests"] = tr_records

    return results

@router.get("/pending", response_model=Dict[str, List[Any]], dependencies=[Depends(RBACPermission("Approvals", "view"))])
async def get_pending_approvals(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Legacy wrapper for older clients
    return await get_all_approvals("Pending", current_user, db)

from fastapi import Body

@router.put("/{type}/{obj_id}/{action}", dependencies=[Depends(RBACPermission("Approvals", "edit"))])
async def action_approval(type: str, obj_id: str, action: str, request_data: dict = Body(default={}), current_user=Depends(get_current_user), db=Depends(get_database)):
    from bson import ObjectId

    status = "Approved" if action.lower() == "approve" else ("Completed" if action.lower() == "complete" else "Rejected")
    reason = request_data.get("reason", "")

    actor_name = current_user.get("full_name") or current_user.get("username", "Admin")
    actor_role = current_user.get("role") or ""
    update_fields = {
        "status": status,
        "approvedBy": actor_name,
        "approvedByRole": actor_role,
    }
    if reason:
        update_fields["remarks"] = reason
    
    try:
        if type != "dprs":
            oid = validate_object_id(obj_id, "approval item")

        if type == "leaves":
            await db.leaves.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "purchase_orders":
            await require_sub_tab(db, current_user, "Approvals", "Purchase Orders")
            await db.purchase_orders.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "materials":
            await db.material_requests.update_one({"_id": oid}, {"$set": update_fields})
            # If approved AND this is a warehouse_issue request → auto-issue from warehouse
            if status == "Approved":
                mat_req = await db.material_requests.find_one({"_id": oid})
                if mat_req and mat_req.get("warehouse_issue") and mat_req.get("status") != "Issued":
                    project_name = mat_req.get("project_name", "")
                    total_value = 0
                    issued = []
                    for item in mat_req.get("requested_items", []):
                        qty = float(item.get("quantity", 0))
                        if qty <= 0:
                            continue
                        # Atomic warehouse decrement
                        res = await db.warehouse_inventory.update_one(
                            {"material_name": item["name"], "stock": {"$gte": qty}},
                            {"$inc": {"stock": -qty}},
                        )
                        if res.matched_count == 0:
                            continue  # Skip if insufficient stock
                        # Increment site inventory
                        await db.inventory.update_one(
                            {"project_name": project_name, "material_name": item["name"]},
                            {"$inc": {"stock": qty}, "$set": {"unit": item.get("unit", "Nos")}},
                            upsert=True,
                        )
                        # Rate for value calc
                        rate = float(item.get("rate", 0) or 0)
                        if not rate:
                            last_bill = await db.purchase_bills.find_one({"items.name": item["name"]}, sort=[("bill_date", -1)])
                            if last_bill:
                                for bi in last_bill.get("items", []):
                                    if bi["name"] == item["name"] and bi.get("rate"):
                                        rate = float(bi["rate"])
                                        break
                        total_value += qty * rate
                        # Stock ledger (two entries: OUT from warehouse, IN to site)
                        now = datetime.now()
                        ref_code = f"WH-APR-{str(oid)[-6:].upper()}"
                        await db.stock_ledger.insert_one({
                            "date": now, "material_name": item["name"], "project_name": "Warehouse",
                            "type": "Warehouse Issue (Approved)", "ref": ref_code,
                            "in_qty": 0, "out_qty": qty, "created_at": now,
                        })
                        await db.stock_ledger.insert_one({
                            "date": now, "material_name": item["name"], "project_name": project_name,
                            "type": "Warehouse Issue (Approved)", "ref": ref_code,
                            "in_qty": qty, "out_qty": 0, "created_at": now,
                        })
                        issued.append({"name": item["name"], "quantity": qty, "unit": item.get("unit", "Nos")})
                    # Update project spending
                    if total_value > 0:
                        await db.projects.update_one({"name": project_name}, {"$inc": {"spent": total_value}})
                    # Create expense record so it shows in Finance Ledger
                    if total_value > 0:
                        await db.expenses.insert_one({
                            "category": "Material (Warehouse)",
                            "amount": total_value,
                            "project": project_name,
                            "payee": "Warehouse",
                            "paymentMode": "Internal Transfer",
                            "description": f"Warehouse issue: {', '.join(i['name'] + ' x' + str(i['quantity']) for i in issued)}",
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "base_amount": total_value,
                            "gst_amount": 0,
                            "source": "warehouse_issue",
                        })

                    # Update request as issued
                    await db.material_requests.update_one(
                        {"_id": oid},
                        {"$set": {"status": "Issued", "issued_items": issued, "issued_at": datetime.now()}}
                    )
        elif type == "expenses":
            exp_doc = await db.expenses.find_one({"_id": oid})
            await db.expenses.update_one({"_id": oid}, {"$set": update_fields})
            # On approval: add expense amount to project spent
            if status == "Approved" and exp_doc:
                await db.expenses.update_one({"_id": oid}, {"$set": {
                    "approved_by": update_fields["approvedBy"],
                    "approved_by_role": actor_role,
                    "approved_at": datetime.now()
                }})
                exp_project = exp_doc.get("project")
                exp_amount = float(exp_doc.get("amount", 0))
                if exp_project and exp_project != "General" and exp_amount > 0 and not exp_doc.get("grn_id"):
                    await db.projects.update_one(
                        {"name": exp_project},
                        {"$inc": {"spent": exp_amount}}
                    )
        elif type == "manpower":
            await db.manpower_requests.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "subcontractor_bills":
            await require_sub_tab(db, current_user, "Approvals", "SC Bills")
            # Validate bill is in correct status for action
            sc_bill = await db.subcontractor_bills.find_one({"_id": oid})
            if sc_bill and sc_bill.get("status") != "Pending Approval":
                raise HTTPException(status_code=400, detail="Bill is not pending approval")
            sc_update = {"status": status}
            if status == "Approved":
                sc_update["approved_by"] = update_fields["approvedBy"]
                sc_update["approved_by_role"] = actor_role
                sc_update["approved_at"] = datetime.now().isoformat()
            elif status == "Rejected":
                sc_update["rejected_by"] = update_fields["approvedBy"]
                sc_update["rejected_by_role"] = actor_role
                sc_update["rejection_reason"] = reason
            await db.subcontractor_bills.update_one({"_id": oid}, {"$set": sc_update})
        elif type == "subcontractor_advances":
            await require_sub_tab(db, current_user, "Approvals", "SC Advances")
            sc_adv = await db.subcontractor_advances.find_one({"_id": oid})
            if not sc_adv:
                raise HTTPException(status_code=404, detail="Advance not found")
            if sc_adv.get("approval_status") != "Pending Approval":
                raise HTTPException(status_code=400, detail="Advance is not pending approval")
            approver_name = update_fields["approvedBy"]
            if status == "Approved":
                await db.subcontractor_advances.update_one({"_id": oid}, {"$set": {
                    "approval_status": "Approved",
                    "approved_by": approver_name,
                    "approved_by_role": actor_role,
                    "approved_at": datetime.now().isoformat(),
                }})
                # Create the expense entry now (deferred from advance creation)
                contractor_nm = sc_adv.get("contractor_name", "")
                adv_no = sc_adv.get("advance_no", "")
                adv_amount = sc_adv.get("amount", 0)
                expense_doc = {
                    "date": sc_adv.get("payment_date") or datetime.now().strftime("%Y-%m-%d"),
                    "project": sc_adv.get("project_name", ""),
                    "project_id": sc_adv.get("project_id", ""),
                    "category": "Subcontractor Advance",
                    "description": f"Advance {adv_no} to {contractor_nm}",
                    "amount": adv_amount,
                    "base_amount": adv_amount,
                    "gst_amount": 0,
                    "paymentMode": sc_adv.get("payment_mode", "Cash"),
                    "payee": contractor_nm,
                    "reference": sc_adv.get("reference_no", ""),
                    "invoice_no": adv_no,
                    "status": "Paid",
                    "sc_advance_id": obj_id,
                    "remarks": f"Advance to {contractor_nm}",
                    "created_at": datetime.now().isoformat(),
                    "created_by": approver_name,
                }
                await db.expenses.insert_one(expense_doc)
                try:
                    sc_adv_recipients = await get_users_with_permission(db, "Accounts", "edit")
                    await notify(db, approver_name, sc_adv_recipients, EVENT_APPROVAL,
                        "SC Advance Approved",
                        f"Advance {sc_adv.get('advance_no')} for {sc_adv.get('contractor_name')} (Rs.{sc_adv.get('amount', 0):,.0f}) approved by {approver_name}.",
                        entity_type="subcontractor_advance", entity_id=obj_id,
                        project_name=sc_adv.get("project_name"), priority="high")
                except Exception:
                    pass
            else:
                await db.subcontractor_advances.update_one({"_id": oid}, {"$set": {
                    "approval_status": "Rejected",
                    "rejected_by": approver_name,
                    "rejected_by_role": actor_role,
                    "rejection_reason": reason,
                }})
                try:
                    sc_adv_recipients = await get_users_with_permission(db, "Accounts", "edit")
                    await notify(db, approver_name, sc_adv_recipients, EVENT_APPROVAL,
                        "SC Advance Rejected",
                        f"Advance {sc_adv.get('advance_no')} for {sc_adv.get('contractor_name')} rejected by {approver_name}." + (f" Reason: {reason}" if reason else ""),
                        entity_type="subcontractor_advance", entity_id=obj_id,
                        project_name=sc_adv.get("project_name"), priority="high")
                except Exception:
                    pass
        elif type == "labour_payments":
            await require_sub_tab(db, current_user, "Approvals", "Labour Pay")
            lp_doc = await db.labour_attendance.find_one({"_id": oid})
            if lp_doc and lp_doc.get("payment_status") != "Payment Requested":
                raise HTTPException(status_code=400, detail="No pending payment request")
            approver_name = update_fields["approvedBy"]
            # Build recipients: Accountant + person who requested + person who marked
            lp_recipients = await get_users_with_permission(db, "Accounts", "edit")
            if lp_doc.get("payment_requested_by"): lp_recipients.append(lp_doc["payment_requested_by"])
            if lp_doc.get("marked_by") and lp_doc["marked_by"] not in lp_recipients: lp_recipients.append(lp_doc["marked_by"])
            day_cost = sum(
                (c.get("count", 0) * (c.get("daily_wage", 0)) * (float(c.get("shift", 1)) or 1))
                for c in lp_doc.get("categories", [])
            )

            if status == "Approved":
                await db.labour_attendance.update_one({"_id": oid}, {"$set": {
                    "payment_status": "Payment Approved",
                    "payment_approved_by": approver_name,
                    "payment_approved_by_role": actor_role,
                    "updated_at": datetime.now(),
                }})
                try:
                    await notify(db, approver_name, lp_recipients, EVENT_APPROVAL,
                        "Labour Payment Approved",
                        f"Payment of Rs.{day_cost:,.0f} for {lp_doc.get('project_name')} ({lp_doc.get('date')}) approved by {approver_name}. Ready for processing.",
                        entity_type="labour_payment", entity_id=obj_id,
                        project_name=lp_doc.get("project_name"), priority="high")
                except Exception:
                    pass
            else:
                await db.labour_attendance.update_one({"_id": oid}, {"$set": {
                    "payment_status": "Payment Rejected",
                    "payment_rejected_by": approver_name,
                    "payment_rejected_by_role": actor_role,
                    "payment_rejection_reason": reason,
                    "updated_at": datetime.now(),
                }})
                try:
                    await notify(db, approver_name, lp_recipients, EVENT_APPROVAL,
                        "Labour Payment Rejected",
                        f"Payment of Rs.{day_cost:,.0f} for {lp_doc.get('project_name')} ({lp_doc.get('date')}) rejected by {approver_name}." + (f" Reason: {reason}" if reason else ""),
                        entity_type="labour_payment", entity_id=obj_id,
                        project_name=lp_doc.get("project_name"), priority="high")
                except Exception:
                    pass
        elif type == "material_transfers":
            await require_sub_tab(db, current_user, "Approvals", "Transfers")
            from app.api.inventory import validate_object_id as vi2
            mt_oid = vi2(obj_id, "material transfer")
            mt = await db.material_transfer_requests.find_one({"_id": mt_oid})
            if status == "Approved":
                if mt and mt.get("status") == "Pending":
                    approver_name = update_fields["approvedBy"]
                    await db.material_transfer_requests.update_one({"_id": mt_oid}, {"$set": {
                        "status": "Approved",
                        "admin_approved_by": approver_name,
                        "admin_approved_by_role": actor_role,
                        "admin_approved_at": datetime.now(),
                    }})
                    try:
                        engineer = mt.get("requested_by") or mt.get("engineer_id", "")
                        accountants = await get_users_with_permission(db, "Accounts", "edit")
                        recipients = accountants + ([engineer] if engineer else [])
                        await notify(db, approver_name, recipients, EVENT_APPROVAL,
                            "Transfer Approved — Ready for Execution",
                            f"Transfer {mt['from_project']} -> {mt['to_project']} approved. Accountant can execute with cost entry.",
                            entity_type="material_transfer", entity_id=obj_id, project_name=mt.get("from_project"), priority="high")
                    except Exception:
                        pass
            else:
                await db.material_transfer_requests.update_one({"_id": mt_oid}, {"$set": {
                    "status": "Rejected",
                    "rejected_by": update_fields["approvedBy"],
                    "rejected_by_role": actor_role,
                    "rejection_reason": reason,
                    "updated_at": datetime.now(),
                }})
        elif type == "stock_returns":
            await require_sub_tab(db, current_user, "Approvals", "Stock Returns")
            from app.api.inventory import validate_object_id as vi
            sr_oid = vi(obj_id, "stock return")
            if status == "Approved":
                # Import and call the approve function logic
                sr = await db.stock_return_requests.find_one({"_id": sr_oid})
                if sr and sr.get("status") == "Pending":
                    # Move stock: site → warehouse
                    for item in sr.get("items", []):
                        qty = float(item.get("quantity", 0))
                        await db.inventory.update_one(
                            {"project_name": sr["project_name"], "material_name": item["name"], "stock": {"$gte": qty}},
                            {"$inc": {"stock": -qty}}
                        )
                        await db.warehouse_inventory.update_one(
                            {"material_name": item["name"]}, {"$inc": {"stock": qty}}, upsert=True
                        )
                        now = datetime.now()
                        ref = f"RET-{obj_id[-6:].upper()}"
                        await db.stock_ledger.insert_one({"date": now, "material_name": item["name"], "project_name": sr["project_name"], "type": "Stock Return", "ref": ref, "in_qty": 0, "out_qty": qty, "created_at": now})
                        await db.stock_ledger.insert_one({"date": now, "material_name": item["name"], "project_name": "Warehouse", "type": "Stock Return", "ref": ref, "in_qty": qty, "out_qty": 0, "created_at": now})
                    await db.stock_return_requests.update_one({"_id": sr_oid}, {"$set": {
                        "status": "Approved",
                        "approved_by": update_fields["approvedBy"],
                        "approved_by_role": actor_role,
                        "approved_at": datetime.now(),
                    }})
            else:
                await db.stock_return_requests.update_one({"_id": sr_oid}, {"$set": {
                    "status": "Rejected",
                    "rejected_by": update_fields["approvedBy"],
                    "rejected_by_role": actor_role,
                    "rejection_reason": reason,
                }})
        elif type == "payment_requests":
            await require_sub_tab(db, current_user, "Approvals", "Vendor Payments")
            pr_doc = await db.payment_requests.find_one({"_id": oid})
            if not pr_doc:
                raise HTTPException(status_code=404, detail="Payment request not found")
            if pr_doc.get("status") != "Pending":
                raise HTTPException(status_code=400, detail="Payment request is not pending")
            approver_name = update_fields["approvedBy"]

            if status == "Approved":
                grn_id = pr_doc.get("grn_id")

                # Check if GRN is already paid — auto-cancel duplicates instead of erroring
                if grn_id and pr_doc.get("mark_as_paid"):
                    try:
                        from bson import ObjectId as ObjId
                        existing_grn = await db.grns.find_one({"_id": ObjId(grn_id)})
                        if existing_grn and existing_grn.get("status") == "Paid":
                            # Mark this request as cancelled (duplicate)
                            await db.payment_requests.update_one({"_id": oid}, {"$set": {
                                "status": "Cancelled",
                                "rejection_reason": "Auto-cancelled: GRN already fully paid by a previous request.",
                                "rejected_at": datetime.now(),
                            }})
                            return {"message": "Duplicate payment request auto-cancelled — GRN already paid.", "status": "Cancelled"}
                    except Exception:
                        pass

                # Execute the actual payment by creating an expense
                from app.api.finance import create_expense_from_payment_request
                await create_expense_from_payment_request(pr_doc, db, current_user)
                await db.payment_requests.update_one({"_id": oid}, {"$set": {
                    "status": "Approved",
                    "approved_by": approver_name,
                    "approved_by_role": actor_role,
                    "approved_at": datetime.now(),
                }})

                # Auto-cancel other pending payment requests for the same
                # GRN+vendor only. Multi-vendor GRNs have one PR per vendor,
                # so approving Madurai's PR must NOT cancel Sri Balaji's.
                if grn_id:
                    cancel_filter = {
                        "grn_id": grn_id,
                        "status": "Pending",
                        "_id": {"$ne": oid},
                        "payee": (pr_doc.get("payee") or "").strip(),
                    }
                    await db.payment_requests.update_many(
                        cancel_filter,
                        {"$set": {
                            "status": "Cancelled",
                            "rejection_reason": "Auto-cancelled: vendor payment already processed.",
                            "rejected_at": datetime.now(),
                        }}
                    )

                # Notify requester
                try:
                    requester = pr_doc.get("requested_by", "")
                    accountants = await get_users_with_permission(db, "Accounts", "edit")
                    recipients = ([requester] if requester else []) + accountants
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        "Payment Approved & Processed",
                        f"Payment of ₹{pr_doc.get('amount', 0):,.0f} for {pr_doc.get('payee', '')} ({pr_doc.get('voucher_no', '')}) approved by {approver_name}. Payment has been recorded.",
                        entity_type="payment_request", entity_id=obj_id,
                        project_name=pr_doc.get("project"), priority="high")
                except Exception:
                    pass
            else:
                await db.payment_requests.update_one({"_id": oid}, {"$set": {
                    "status": "Rejected",
                    "rejected_by": approver_name,
                    "rejected_by_role": actor_role,
                    "rejection_reason": reason,
                    "rejected_at": datetime.now(),
                }})
                try:
                    requester = pr_doc.get("requested_by", "")
                    await notify(db, approver_name, [requester], EVENT_APPROVAL,
                        "Payment Request Rejected",
                        f"Payment of ₹{pr_doc.get('amount', 0):,.0f} for {pr_doc.get('payee', '')} ({pr_doc.get('voucher_no', '')}) rejected by {approver_name}." + (f" Reason: {reason}" if reason else ""),
                        entity_type="payment_request", entity_id=obj_id,
                        project_name=pr_doc.get("project"), priority="high")
                except Exception:
                    pass
        elif type == "trip_requests":
            await require_sub_tab(db, current_user, "Approvals", "Trip Requests")
            tr_doc = await db.trip_requests.find_one({"_id": oid})
            if not tr_doc:
                raise HTTPException(status_code=404, detail="Trip request not found")
            approver_name = update_fields["approvedBy"]

            # Authorization is enforced upstream by RBACPermission("Approvals", "edit")
            # on the route + the sub-tab gate above. No role-name logic here.
            if action.lower() == "approve":
                await db.trip_requests.update_one({"_id": oid}, {"$set": {
                    "status": "Approved",
                    "approved_by": approver_name,
                    "approved_by_role": actor_role,
                    "approved_at": datetime.now(),
                }})
                try:
                    requester = tr_doc.get("requested_by", "")
                    admins = await get_users_with_permission(db, "Approvals", "edit")
                    recipients = list({*( [requester] if requester else [] ), *admins})
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        "Trip Request Approved",
                        f"Trip request for {tr_doc.get('load_type', '')} — {tr_doc.get('project_name', '')} ({tr_doc.get('from_location', '')} → {tr_doc.get('to_location', '')}) approved by {approver_name}.",
                        entity_type="trip_request", entity_id=obj_id,
                        project_name=tr_doc.get("project_name"), priority="high")
                except Exception:
                    pass
            else:
                await db.trip_requests.update_one({"_id": oid}, {"$set": {
                    "status": "Rejected",
                    "rejection_reason": reason,
                    "rejected_by": approver_name,
                    "rejected_by_role": actor_role,
                    "rejected_at": datetime.now(),
                }})
                try:
                    requester = tr_doc.get("requested_by", "")
                    await notify(db, approver_name, [requester], EVENT_APPROVAL,
                        "Trip Request Rejected",
                        f"Trip request for {tr_doc.get('load_type', '')} — {tr_doc.get('project_name', '')} rejected by {approver_name}." + (f" Reason: {reason}" if reason else ""),
                        entity_type="trip_request", entity_id=obj_id,
                        project_name=tr_doc.get("project_name"), priority="high")
                except Exception:
                    pass
        elif type == "dprs":
            await require_sub_tab(db, current_user, "Approvals", "DPR")
            # obj_id format: "project_id:dpr_id"
            parts = obj_id.split(":")
            if len(parts) != 2:
                raise HTTPException(status_code=400, detail="DPR ID must be in format project_id:dpr_id")
            project_id, dpr_id = parts

            approver_name = update_fields["approvedBy"]

            dpr_update = {
                "dprs.$.status_updated_by": approver_name,
                "dprs.$.status_updated_by_role": actor_role,
                "dprs.$.status_updated_at": datetime.now().isoformat()
            }

            # Authorization is enforced upstream by RBACPermission("Approvals", "edit")
            # on the route + sub-tab access (Approvals → DPR) in the UI. No role-name
            # logic here — anyone authorised to approve DPRs approves directly.
            if action.lower() == "approve":
                status = "Approved"
                dpr_update["dprs.$.approved_by"] = approver_name
                dpr_update["dprs.$.approved_by_role"] = actor_role
            else:
                dpr_update["dprs.$.rejected_by"] = approver_name
                dpr_update["dprs.$.rejected_by_role"] = actor_role

            dpr_update["dprs.$.status"] = status
            if reason:
                dpr_update["dprs.$.remarks"] = reason

            await db.projects.update_one(
                {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                {"$set": dpr_update}
            )

            # Deduct used materials from project inventory on final approval
            if status == "Approved":
                try:
                    full_proj = await db.projects.find_one(
                        {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                        {"dprs.$": 1, "name": 1}
                    )
                    if full_proj and full_proj.get("dprs"):
                        dpr_data = full_proj["dprs"][0]
                        proj_name = full_proj.get("name", "")
                        for mat in (dpr_data.get("material_rows") or []):
                            used = float(mat.get("used") or 0)
                            mat_name = (mat.get("name") or "").strip()
                            if used > 0 and mat_name and proj_name:
                                await db.inventory.update_one(
                                    {"project_name": proj_name, "material_name": mat_name, "stock": {"$gte": used}},
                                    {"$inc": {"stock": -used}}
                                )
                                await db.stock_ledger.insert_one({
                                    "material_name": mat_name,
                                    "project_name": proj_name,
                                    "type": "Consumed (DPR)",
                                    "quantity": used,
                                    "direction": "OUT",
                                    "reference": f"DPR {dpr_id}",
                                    "date": datetime.now().isoformat(),
                                    "created_by": approver_name
                                })
                except Exception as e:
                    print(f"DPR stock deduction error: {e}")

        # ── Send notifications for all approval actions ──
        approver_name = current_user.get("full_name") or current_user.get("username", "Admin")
        try:
            if type == "leaves":
                leave = await db.leaves.find_one({"_id": oid})
                if leave:
                    emp_id = leave.get("employeeId", "")
                    emp = await db.employees.find_one({"_id": ObjectId(emp_id)}) if ObjectId.is_valid(emp_id) else None
                    emp_username = emp.get("employeeCode") or emp.get("username", "") if emp else ""
                    if emp_username:
                        await notify(db, approver_name, [emp_username], EVENT_APPROVAL,
                            f"Leave {status}",
                            f"Your {leave.get('leaveType', 'leave')} request ({leave.get('fromDate', '')} to {leave.get('toDate', '')}) has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                            entity_type="leave", entity_id=obj_id, priority="high")

            elif type == "purchase_orders":
                po = await db.purchase_orders.find_one({"_id": oid})
                if po:
                    # Notify PO creator + project stakeholders
                    recipients = await get_users_with_permission(db, "Procurement", "edit")
                    stakeholders = await get_project_stakeholders(db, project_name=po.get("project_name"))
                    if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
                    if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
                    for m in stakeholders.get("members") or []:
                        recipients.append(m)
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"PO {status}",
                        f"Purchase Order for {po.get('vendor_name', '')} ({po.get('project_name', '')}) has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="po", entity_id=obj_id, project_name=po.get("project_name"), priority="high")

            elif type == "materials":
                mat_req = await db.material_requests.find_one({"_id": oid})
                if mat_req:
                    recipients = []
                    req_by = mat_req.get("engineer_id", "")
                    if req_by: recipients.append(req_by)
                    if status == "Approved":
                        recipients.extend(["Purchase Officer"])
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"Material Request {status}",
                        f"Material request for {mat_req.get('project_name', '')} ({len(mat_req.get('requested_items', []))} items) has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="material_request", entity_id=obj_id, project_name=mat_req.get("project_name"), priority="high")

            elif type == "expenses":
                exp = await db.expenses.find_one({"_id": oid})
                if exp:
                    accountants = await get_users_with_permission(db, "Accounts", "edit")
                    admins = await get_users_with_permission(db, "Approvals", "edit")
                    exp_recipients = list({*accountants, *admins})
                    await notify(db, approver_name, exp_recipients, EVENT_APPROVAL,
                        f"Expense {status}",
                        f"Expense of Rs.{exp.get('amount', 0):,.0f} ({exp.get('category', '')}) has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="expense", entity_id=obj_id, project_name=exp.get("project"), priority="high")

            elif type == "manpower":
                mp = await db.manpower_requests.find_one({"_id": oid})
                if mp:
                    recipients = await get_users_with_permission(db, "HRMS", "edit")
                    stakeholders = await get_project_stakeholders(db, project_id=mp.get("project_id"))
                    if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
                    for m in stakeholders.get("members") or []:
                        recipients.append(m)
                    # Always notify the original requester so they know the outcome
                    requester = mp.get("requested_by") or mp.get("engineer_id") or mp.get("submitted_by")
                    if requester and requester not in recipients:
                        recipients.append(requester)
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"Manpower Request {status}",
                        f"Manpower request for {mp.get('project_name', stakeholders.get('project_name', ''))} has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="manpower", entity_id=obj_id, project_name=mp.get("project_name"), priority="high")

            elif type == "dprs":
                # Notify SE + Coordinator on DPR approval status. Single-stage flow
                # — no role-encoded intermediate notifications.
                proj = await db.projects.find_one({"_id": ObjectId(project_id)})
                if proj:
                    proj_name = proj.get("name", "")
                    se = proj.get("engineer_id", "")
                    coord = proj.get("coordinator_id", "")
                    recipients = []
                    if se: recipients.append(se)
                    if coord: recipients.append(coord)
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"DPR {status}",
                        f"DPR for project '{proj_name}' has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="dpr", entity_id=obj_id, project_name=proj_name, priority="high")
        except Exception:
            pass  # Don't fail approval action if notification fails

        return {"message": "Success", "status": status}
    except HTTPException:
        # Preserve intentional HTTP errors (400/403/404 etc.) — don't downgrade
        # them to a 500 with a stack trace.
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
