from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import re
from datetime import datetime
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import RBACPermission
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
        "labour_payments": [],
        "stock_returns": [],
        "material_transfers": []
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
    
    exps = await db.expenses.find(query).sort("_id", -1).to_list(100)
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

    # DPR approvals: Role-based multi-stage workflow
    # Workflow: Pending → Coordinator Approved → Dept Approved → Approved
    # Coordinator sees Pending, PO/HR sees Coordinator Approved, Admin sees Dept Approved
    user_role = (current_user.get("role") or "").strip()
    is_admin_user = user_role in ("Super Admin", "Administrator", "Admin", "Managing Director")
    is_coordinator_user = "coordinator" in user_role.lower()
    is_po_user = "purchase" in user_role.lower()
    is_hr_user = "hr" in user_role.lower() or user_role == "HR Manager"

    # Determine which DPR statuses this user should see for "Pending" tab
    if status.lower() == "all":
        dpr_visible_statuses = None  # Show all
    elif is_admin_user:
        dpr_visible_statuses = ["Dept Approved"]
    elif is_coordinator_user:
        dpr_visible_statuses = ["Pending"]
    elif is_po_user or is_hr_user:
        dpr_visible_statuses = ["Coordinator Approved"]
    else:
        dpr_visible_statuses = ["Pending", "Coordinator Approved", "Dept Approved"]

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
            if dpr_visible_statuses is not None and dpr_s not in dpr_visible_statuses:
                continue
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
                "coordinator_approved_by": dpr.get("coordinator_approved_by", ""),
                "dept_approved_by": dpr.get("dept_approved_by", ""),
            }
            resolve_names(dpr_entry)
            dpr_list.append(dpr_entry)
    dpr_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    results["dprs"] = dpr_list

    # Subcontractor bills: only Admin/GM see pending bills
    sc_query = {"status": "Pending Approval"} if status.lower() != "all" else {}
    if is_admin_user or status.lower() == "all":
        sc_bills = await db.subcontractor_bills.find(sc_query).sort("created_at", -1).to_list(100)
        for sb in sc_bills:
            sb["_id"] = str(sb["_id"])
            resolve_names(sb)
        results["subcontractor_bills"] = sc_bills

    # Labour payment approvals: Admin sees payment requests
    lp_query = {"payment_status": "Payment Requested"} if status.lower() != "all" else {"payment_status": {"$exists": True, "$ne": ""}}
    if is_admin_user or status.lower() == "all":
        from app.api.labour_attendance import _helper as la_helper, _compute_day_cost
        lp_records = await db.labour_attendance.find(lp_query).sort("updated_at", -1).to_list(100)
        for lp in lp_records:
            lp_entry = la_helper(lp)
            lp_entry["_id"] = str(lp["_id"])
            resolve_names(lp_entry)
            results["labour_payments"].append(lp_entry)

    # Stock return requests
    sr_query = {"status": "Pending"} if status.lower() != "all" else {}
    if is_admin_user or status.lower() == "all":
        sr_records = await db.stock_return_requests.find(sr_query).sort("created_at", -1).to_list(100)
        for sr in sr_records:
            sr["_id"] = str(sr["_id"])
            for field in ["created_at", "approved_at"]:
                if field in sr and hasattr(sr[field], "isoformat"):
                    sr[field] = sr[field].isoformat()
            resolve_names(sr)
            results["stock_returns"].append(sr)

    # Material transfer requests (Pending for Admin, Admin Approved for Accountant)
    if is_admin_user or status.lower() == "all":
        mt_statuses = ["Pending", "Admin Approved"] if status.lower() != "all" else ["Pending", "Admin Approved", "Completed", "Rejected"]
        mt_records = await db.material_transfer_requests.find({"status": {"$in": mt_statuses}}).sort("created_at", -1).to_list(100)
        for mt in mt_records:
            mt["_id"] = str(mt["_id"])
            for field in ["created_at", "admin_approved_at", "executed_at"]:
                if field in mt and hasattr(mt[field], "isoformat"):
                    mt[field] = mt[field].isoformat()
            resolve_names(mt)
            results["material_transfers"].append(mt)

    return results

@router.get("/pending", response_model=Dict[str, List[Any]])
async def get_pending_approvals(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Legacy wrapper for older clients
    return await get_all_approvals("Pending", current_user, db)

from fastapi import Body

@router.put("/{type}/{obj_id}/{action}", dependencies=[Depends(RBACPermission("Approvals", "edit"))])
async def action_approval(type: str, obj_id: str, action: str, request_data: dict = Body(default={}), current_user=Depends(get_current_user), db=Depends(get_database)):
    from bson import ObjectId

    status = "Approved" if action.lower() == "approve" else ("Completed" if action.lower() == "complete" else "Rejected")
    reason = request_data.get("reason", "")
    
    update_fields = {"status": status, "approvedBy": current_user.get("full_name") or current_user.get("username", "Admin")}
    if reason:
        update_fields["remarks"] = reason
    
    try:
        if type != "dprs":
            oid = validate_object_id(obj_id, "approval item")

        if type == "leaves":
            await db.leaves.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "purchase_orders":
            # Only Super Admin, Administrator, General Manager, or Manager can approve/reject POs
            allowed_roles = ["super admin", "administrator", "general manager", "manager"]
            user_role = (current_user.get("role") or "").strip().lower()
            if user_role not in allowed_roles:
                raise HTTPException(status_code=403, detail="Only General Manager or Super Admin can approve/reject Purchase Orders")
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
            await db.expenses.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "manpower":
            await db.manpower_requests.update_one({"_id": oid}, {"$set": update_fields})
        elif type == "subcontractor_bills":
            allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
            user_role_check = (current_user.get("role") or "").strip().lower()
            if user_role_check not in allowed_roles:
                raise HTTPException(status_code=403, detail="Only Admin/GM can approve/reject subcontractor bills")
            # Validate bill is in correct status for action
            sc_bill = await db.subcontractor_bills.find_one({"_id": oid})
            if sc_bill and sc_bill.get("status") != "Pending Approval":
                raise HTTPException(status_code=400, detail="Bill is not pending approval")
            sc_update = {"status": status}
            if status == "Approved":
                sc_update["approved_by"] = update_fields["approvedBy"]
                sc_update["approved_at"] = datetime.now().isoformat()
            elif status == "Rejected":
                sc_update["rejection_reason"] = reason
            await db.subcontractor_bills.update_one({"_id": oid}, {"$set": sc_update})
        elif type == "labour_payments":
            allowed_roles = ["super admin", "administrator", "general manager", "manager", "managing director"]
            user_role_check = (current_user.get("role") or "").strip().lower()
            if user_role_check not in allowed_roles:
                raise HTTPException(status_code=403, detail="Only Admin/GM can approve/reject labour payments")
            lp_doc = await db.labour_attendance.find_one({"_id": oid})
            if lp_doc and lp_doc.get("payment_status") != "Payment Requested":
                raise HTTPException(status_code=400, detail="No pending payment request")
            approver_name = update_fields["approvedBy"]
            # Build recipients: Accountant + person who requested + person who marked
            lp_recipients = ["Accountant"]
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
            from app.api.inventory import validate_object_id as vi2
            mt_oid = vi2(obj_id, "material transfer")
            mt = await db.material_transfer_requests.find_one({"_id": mt_oid})
            if status == "Approved":
                if mt and mt.get("status") == "Pending":
                    approver_name = update_fields["approvedBy"]
                    await db.material_transfer_requests.update_one({"_id": mt_oid}, {"$set": {
                        "status": "Admin Approved",
                        "admin_approved_by": approver_name,
                        "admin_approved_at": datetime.now(),
                    }})
                    try:
                        engineer = mt.get("requested_by") or mt.get("engineer_id", "")
                        await notify(db, approver_name, ["Accountant", engineer], EVENT_APPROVAL,
                            "Transfer Approved — Ready for Execution",
                            f"Transfer {mt['from_project']} -> {mt['to_project']} approved. Accountant can execute with cost entry.",
                            entity_type="material_transfer", entity_id=obj_id, project_name=mt.get("from_project"), priority="high")
                    except Exception:
                        pass
            else:
                await db.material_transfer_requests.update_one({"_id": mt_oid}, {"$set": {
                    "status": "Rejected", "rejection_reason": reason, "updated_at": datetime.now()
                }})
        elif type == "stock_returns":
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
                    await db.stock_return_requests.update_one({"_id": sr_oid}, {"$set": {"status": "Approved", "approved_by": update_fields["approvedBy"], "approved_at": datetime.now()}})
            else:
                await db.stock_return_requests.update_one({"_id": sr_oid}, {"$set": {"status": "Rejected", "rejection_reason": reason}})
        elif type == "dprs":
            # Bug 26 - Multi-stage DPR approval workflow
            # Workflow: Pending → Coordinator Approved → Dept Approved → Approved
            # obj_id format: "project_id:dpr_id"
            parts = obj_id.split(":")
            if len(parts) != 2:
                raise HTTPException(status_code=400, detail="DPR ID must be in format project_id:dpr_id")
            project_id, dpr_id = parts

            user_role = (current_user.get("role") or "").strip()
            approver_name = update_fields["approvedBy"]
            is_admin = user_role in ("Super Admin", "Administrator", "Admin", "Managing Director")
            is_coordinator = "coordinator" in user_role.lower()
            is_po = "purchase" in user_role.lower()
            is_hr = "hr" in user_role.lower() or user_role == "HR Manager"

            # Get current DPR status
            proj = await db.projects.find_one(
                {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                {"dprs.$": 1}
            )
            current_dpr_status = "Pending"
            if proj and proj.get("dprs"):
                current_dpr_status = proj["dprs"][0].get("status", "Pending")

            dpr_update = {
                "dprs.$.status_updated_by": approver_name,
                "dprs.$.status_updated_at": datetime.now().isoformat()
            }

            if action.lower() == "approve":
                # Multi-stage transitions based on role
                if is_coordinator and not is_admin and current_dpr_status == "Pending":
                    status = "Coordinator Approved"
                    dpr_update["dprs.$.coordinator_approved_by"] = approver_name
                elif (is_po or is_hr) and not is_admin and current_dpr_status == "Coordinator Approved":
                    status = "Dept Approved"
                    dpr_update["dprs.$.dept_approved_by"] = approver_name
                elif is_admin:
                    status = "Approved"
                else:
                    status = "Approved"
            # For reject action, status is already set to "Rejected"

            dpr_update["dprs.$.status"] = status
            if reason:
                dpr_update["dprs.$.remarks"] = reason

            await db.projects.update_one(
                {"_id": ObjectId(project_id), "dprs.id": dpr_id},
                {"$set": dpr_update}
            )
        
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
                    recipients = ["Purchase Officer"]
                    stakeholders = await get_project_stakeholders(db, project_name=po.get("project_name"))
                    if stakeholders.get("coordinator"): recipients.append(stakeholders["coordinator"])
                    if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
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
                    await notify(db, approver_name, ["Accountant", "Administrator"], EVENT_APPROVAL,
                        f"Expense {status}",
                        f"Expense of Rs.{exp.get('amount', 0):,.0f} ({exp.get('category', '')}) has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="expense", entity_id=obj_id, project_name=exp.get("project"), priority="high")

            elif type == "manpower":
                mp = await db.manpower_requests.find_one({"_id": oid})
                if mp:
                    recipients = ["HR Manager"]
                    stakeholders = await get_project_stakeholders(db, project_id=mp.get("project_id"))
                    if stakeholders.get("engineer"): recipients.append(stakeholders["engineer"])
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"Manpower Request {status}",
                        f"Manpower request for {mp.get('project_name', stakeholders.get('project_name', ''))} has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="manpower", entity_id=obj_id, project_name=mp.get("project_name"), priority="high")

            elif type == "dprs":
                # Notify SE about DPR approval status
                proj = await db.projects.find_one({"_id": ObjectId(project_id)})
                if proj:
                    proj_name = proj.get("name", "")
                    se = proj.get("engineer_id", "")
                    coord = proj.get("coordinator_id", "")
                    recipients = []
                    if status == "Coordinator Approved":
                        if se: recipients.append(se)
                        recipients.extend(["Purchase Officer", "HR Manager"])
                    elif status == "Dept Approved":
                        if coord: recipients.append(coord)
                        recipients.append("Administrator")
                    elif status == "Approved":
                        if se: recipients.append(se)
                        if coord: recipients.append(coord)
                    elif status == "Rejected":
                        if se: recipients.append(se)
                        if coord: recipients.append(coord)
                    await notify(db, approver_name, recipients, EVENT_APPROVAL,
                        f"DPR {status}",
                        f"DPR for project '{proj_name}' has been {status.lower()} by {approver_name}" + (f". Reason: {reason}" if reason else ""),
                        entity_type="dpr", entity_id=obj_id, project_name=proj_name, priority="high")
        except Exception:
            pass  # Don't fail approval action if notification fails

        return {"message": "Success", "status": status}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
