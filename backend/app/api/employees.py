from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models.employee import EmployeeBase, EmployeeCreate, EmployeeUpdate, EmployeeResponse
from database import get_database
from bson import ObjectId

router = APIRouter(prefix="/employees", tags=["employees"])

@router.get("/", response_model=List[EmployeeResponse])
async def get_employees(db = Depends(get_database)):
    employees = await db.employees.find().to_list(1000)
    for emp in employees:
        emp["_id"] = str(emp["_id"])
    return employees

@router.post("/", response_model=EmployeeResponse)
async def create_employee(employee: EmployeeCreate, db = Depends(get_database)):
    employee_dict = employee.dict()
    
    # Auto-generate employee code if not provided or set to auto
    if not employee_dict.get("employeeCode") or employee_dict.get("employeeCode").strip() == "":
        # Find the last employee to get the next code
        last_emp = await db.employees.find().sort("created_at", -1).to_list(1)
        next_id = 1
        if last_emp:
            # Try to extract number from last employee code (e.g., EMP005 -> 5)
            last_code = last_emp[0].get("employeeCode", "")
            import re
            match = re.search(r'(\d+)$', last_code)
            if match:
                next_id = int(match.group(1)) + 1
        
        employee_dict["employeeCode"] = f"EMP{next_id:03d}"
    else:
        # Check for existing employee code if provided manually
        existing = await db.employees.find_one({"employeeCode": employee.employeeCode})
        if existing:
            raise HTTPException(status_code=400, detail="Employee code already exists")
    
    # Fetch siteName if siteId is provided
    if employee_dict.get("siteId"):
        project = await db.projects.find_one({"_id": ObjectId(employee_dict["siteId"])})
        if project:
            employee_dict["siteName"] = project.get("name")
    
    result = await db.employees.insert_one(employee_dict)
    employee_dict["_id"] = str(result.inserted_id)
    return employee_dict

@router.put("/{emp_id}", response_model=EmployeeResponse)
async def update_employee(emp_id: str, employee: EmployeeUpdate, db = Depends(get_database)):
    employee_dict = {k: v for k, v in employee.dict().items() if v is not None and v != ""}
    
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
    return updated

@router.delete("/{emp_id}")
async def delete_employee(emp_id: str, db = Depends(get_database)):
    result = await db.employees.delete_one({"_id": ObjectId(emp_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}
