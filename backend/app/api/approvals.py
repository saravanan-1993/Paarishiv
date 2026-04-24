from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import re
from datetime import datetime
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/", response_model=Dict[str, List[Any]], dependencies=[Depends(RBACPermission("Approvals", "view"))])
async def get_all_approvals(status: str = "Pending", current_user=Depends(get_current_user), db=Depends(get_database)):
    results = {
        "leaves": [],
        "purchase_orders": [],
        "materials": [],
        "expenses": [],
        "manpower": [],
        "dprs": []
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
                        # Stock ledger
                        await db.stock_ledger.insert_one({
                            "date": datetime.now(),
                            "material_name": item["name"],
                            "project_name": project_name,
                            "type": "Warehouse Issue (Approved)",
                            "ref": f"WH-APR-{str(oid)[-6:].upper()}",
                            "in_qty": qty,
                            "out_qty": qty,
                            "created_at": datetime.now(),
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
        
        return {"message": "Success", "status": status}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
