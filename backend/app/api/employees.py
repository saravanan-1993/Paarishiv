from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
from app.models.employee import EmployeeBase, EmployeeCreate, EmployeeUpdate, EmployeeResponse
from database import get_database
from bson import ObjectId
from app.utils.auth import get_current_user
from app.utils.logging import log_activity
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/employees", tags=["employees"])

@router.get("/", response_model=List[EmployeeResponse], dependencies=[Depends(RBACPermission("HRMS", "view"))])
async def get_employees(db = Depends(get_database)):
    employees = await db.employees.find().to_list(1000)
    for emp in employees:
        emp["_id"] = str(emp["_id"])
    return employees

# C4 Fix: Added auth dependency
@router.get("/{emp_id}", response_model=EmployeeResponse, dependencies=[Depends(get_current_user)])
async def get_employee(emp_id: str, db = Depends(get_database)):
    # C9 Fix: Validate ObjectId
    try:
        oid = ObjectId(emp_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid employee ID format")
    employee = await db.employees.find_one({"_id": oid})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee["_id"] = str(employee["_id"])
    return employee

@router.post("/", response_model=EmployeeResponse, dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def create_employee(employee: EmployeeCreate, db = Depends(get_database)):
    import re
    from datetime import datetime as dt
    employee_dict = employee.dict()

    # Bug 1.4 - DOB validation: reject future dates
    if employee_dict.get("dob"):
        try:
            dob_date = dt.strptime(employee_dict["dob"], "%Y-%m-%d")
            if dob_date > dt.now():
                raise HTTPException(status_code=400, detail="Date of birth cannot be a future date")
        except ValueError:
            pass  # Non-standard format, skip validation

    # Bug 9.3 - Duplicate email validation
    if employee_dict.get("email") and employee_dict["email"].strip():
        existing_email = await db.employees.find_one({"email": employee_dict["email"]})
        if existing_email:
            raise HTTPException(status_code=400, detail=f"Email '{employee_dict['email']}' is already registered to another employee")

    # Bug 1.11 - Atomic auto-generation of employee code (race-condition safe)
    if not employee_dict.get("employeeCode") or employee_dict.get("employeeCode").strip() == "":
        # Use atomic findOneAndUpdate on a counter collection to prevent race conditions
        counter = await db.counters.find_one_and_update(
            {"_id": "employee_code"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        if counter is None or "seq" not in counter:
            # Fallback: initialize counter from existing employees
            all_emps = await db.employees.find({}, {"employeeCode": 1}).to_list(10000)
            max_id = 0
            for emp in all_emps:
                code = emp.get("employeeCode", "")
                match = re.search(r'(\d+)$', code)
                if match:
                    num = int(match.group(1))
                    if num > max_id:
                        max_id = num
            counter = await db.counters.find_one_and_update(
                {"_id": "employee_code"},
                {"$set": {"seq": max_id + 1}},
                upsert=True,
                return_document=True
            )
        employee_dict["employeeCode"] = f"EMP{counter['seq']:03d}"
    else:
        # Bug 1.3 - Strict duplicate employee code check
        existing = await db.employees.find_one({"employeeCode": employee_dict["employeeCode"]})
        if existing:
            raise HTTPException(status_code=400, detail=f"Employee code '{employee_dict['employeeCode']}' already exists")

    # Bug 1.8 - Designation field mandatory check
    if not employee_dict.get("designation") or employee_dict["designation"].strip() == "":
        raise HTTPException(status_code=400, detail="Designation is mandatory")

    # Fetch siteName if siteId is provided
    if employee_dict.get("siteId"):
        project = await db.projects.find_one({"_id": ObjectId(employee_dict["siteId"])})
        if project:
            employee_dict["siteName"] = project.get("name")

    # Set username for login
    employee_dict["username"] = employee_dict["employeeCode"]
    employee_dict["created_at"] = dt.now()

    # C15 Fix: Hash password on employee creation
    from app.utils.auth import get_password_hash
    if employee_dict.get("password"):
        employee_dict["hashed_password"] = get_password_hash(employee_dict["password"])
        del employee_dict["password"]
    else:
        # Default password = employeeCode, stored hashed
        employee_dict["hashed_password"] = get_password_hash(employee_dict["employeeCode"])

    result = await db.employees.insert_one(employee_dict)
    employee_dict["_id"] = str(result.inserted_id)
    await log_activity(db, "system", "Admin", "Create Employee", f"New employee {employee_dict.get('fullName', employee_dict.get('employeeCode'))} added", "success")
    return employee_dict

@router.put("/{emp_id}", response_model=EmployeeResponse, dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def update_employee(emp_id: str, employee: EmployeeUpdate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    employee_dict = {k: v for k, v in employee.dict().items() if v is not None and v != ""}
    # C13 Fix: Prevent role escalation - only Super Admin can assign admin roles
    if "roles" in employee_dict:
        admin_roles = {"Super Admin", "Administrator"}
        if any(r in admin_roles for r in employee_dict.get("roles", [])):
            if current_user.get("role") not in ["Super Admin"]:
                raise HTTPException(status_code=403, detail="Only Super Admin can assign admin roles")
    
    # Update siteName if siteId is changed
    if "siteId" in employee_dict:
        if employee_dict["siteId"]:
            project = await db.projects.find_one({"_id": ObjectId(employee_dict["siteId"])})
            if project:
                employee_dict["siteName"] = project.get("name")
        else:
            employee_dict["siteName"] = None

    result = await db.employees.update_one(
        {"_id": ObjectId(emp_id)},
        {"$set": employee_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    updated = await db.employees.find_one({"_id": ObjectId(emp_id)})
    updated["_id"] = str(updated["_id"])
    await log_activity(db, emp_id, updated.get("username", "admin"), "Update Employee", f"Employee {updated.get('fullName', emp_id)} profile updated", "info")
    return updated

@router.delete("/{emp_id}", dependencies=[Depends(RBACPermission("HRMS", "delete"))])
async def delete_employee(emp_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # C13 Fix: Prevent users from deleting their own account
    if str(current_user.get("_id")) == emp_id or str(current_user.get("id")) == emp_id:
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    emp = await db.employees.find_one({"_id": ObjectId(emp_id)})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    # C13 Fix: Prevent non-Super Admin from deleting admin-level users
    emp_roles = emp.get("roles", [])
    if any(r in ["Super Admin", "Administrator"] for r in emp_roles):
        if current_user.get("role") not in ["Super Admin"]:
            raise HTTPException(status_code=403, detail="Only Super Admin can delete admin accounts")
    # Check if employee is assigned as engineer/coordinator on active projects
    emp_code = emp.get("employeeCode") or emp.get("username", "")
    active_assignments = await db.projects.count_documents({
        "status": {"$in": ["Ongoing", "Planning"]},
        "$or": [{"engineer_id": emp_code}, {"coordinator_id": emp_code}, {"engineer_id": emp_id}, {"coordinator_id": emp_id}]
    })
    if active_assignments > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: Employee is assigned to {active_assignments} active project(s). Reassign them first.")

    result = await db.employees.delete_one({"_id": ObjectId(emp_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Cleanup linked data
    try:
        # Unassign from tasks (set to empty instead of deleting)
        await db.projects.update_many(
            {"tasks.assignedTo": emp_code},
            {"$set": {"tasks.$[t].assignedTo": ""}},
            array_filters=[{"t.assignedTo": emp_code}]
        )
    except Exception:
        pass

    await log_activity(
        db,
        str(current_user.get("_id", current_user["username"])),
        current_user["username"],
        "Delete Employee",
        f"Employee {emp.get('fullName', emp_id)} removed from system",
        "danger"
    )
    return {"message": "Employee deleted successfully"}

# Bug 1.12 - Employee document upload endpoint
from fastapi import File, UploadFile
from app.utils.cloudinary import upload_file

@router.post("/{emp_id}/documents", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def upload_employee_document(emp_id: str, file: UploadFile = File(...), doc_type: str = "general", db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    emp = await db.employees.find_one({"_id": ObjectId(emp_id)})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    content = await file.read()
    result = await upload_file(content, filename=f"emp_{emp_id}_{file.filename}")
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload document")

    doc_entry = {
        "type": doc_type,
        "filename": file.filename,
        "url": result["url"],
        "uploaded_at": datetime.now().isoformat(),
        "uploaded_by": current_user.get("username", "")
    }

    await db.employees.update_one(
        {"_id": ObjectId(emp_id)},
        {"$push": {"documents": doc_entry}}
    )
    return {"success": True, "document": doc_entry}

# C4 Fix: Added auth dependency
@router.get("/{emp_id}/documents", dependencies=[Depends(get_current_user)])
async def get_employee_documents(emp_id: str, db = Depends(get_database)):
    emp = await db.employees.find_one({"_id": ObjectId(emp_id)}, {"documents": 1})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp.get("documents", [])
