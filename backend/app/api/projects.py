from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from typing import List, Optional
from app.models.project import ProjectModel
from database import get_database
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime
import re
from app.utils.auth import get_current_user
from app.utils.cloudinary import upload_file
from app.utils.email import send_email
from app.api.workflow import initialize_project_workflow, trigger_workflow_event
from app.utils.logging import log_activity
from app.utils.rbac import RBACPermission
from app.utils.sanitize import sanitize_string, sanitize_list

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/upload-photo", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def upload_project_photo(file: UploadFile = File(...)):
    """Upload a photo and return its URL."""
    content = await file.read()
    result = await upload_file(content, filename=file.filename)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload photo")
    return result


class TaskCreate(BaseModel):
    name: str
    assignedTo: Optional[str] = ""
    priority: Optional[str] = "Medium"
    startDate: str
    dueDate: str
    dueTime: str # HH:MM format
    status: Optional[str] = "Pending"
    instructions: Optional[str] = ""

class TaskUpdate(BaseModel):
    status: str
    completionPhoto: Optional[str] = None
    remarks: Optional[str] = ""

def _calc_progress(project: dict) -> int:
    """Calculate progress % from tasks list."""
    tasks = [t for t in project.get("tasks", []) if isinstance(t, dict)]
    if not tasks:
        return 0
    completed = sum(1 for t in tasks if t.get("status") == "Completed")
    return round((completed / len(tasks)) * 100)

@router.post("/", response_model=ProjectModel, dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def create_project(project: ProjectModel, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    project_dict = project.model_dump(by_alias=True)
    if "_id" in project_dict and project_dict["_id"] is None:
        del project_dict["_id"]
    result = await db.projects.insert_one(project_dict)
    project_dict["_id"] = result.inserted_id
    
    # Initialize and trigger workflow
    pid = str(result.inserted_id)
    await initialize_project_workflow(pid, db)
    await trigger_workflow_event(pid, "project_created", current_user, db, "Project created initially")
    if project_dict.get("engineer_id"):
        await trigger_workflow_event(pid, "engineer_assigned", current_user, db, f"Engineer: {project_dict['engineer_id']}")
    if project_dict.get("coordinator_id"):
        await trigger_workflow_event(pid, "coordinator_assigned", current_user, db, f"Coordinator: {project_dict['coordinator_id']}")
    
    await log_activity(
        db,
        str(current_user.get("_id", current_user["username"])),
        current_user["username"],
        "Create Project",
        f"New project '{project_dict.get('name')}' created",
        "success"
    )
    return project_dict

@router.get("/", response_model=List[ProjectModel])
async def get_projects(all: bool = False, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    query = {}
    user_role = (current_user.get("role") or "").lower()
    if user_role == "site engineer" and not all:
        # Bug 1.5 - Also check employee's assigned siteId to find projects
        emp_username = current_user.get("username")
        emp_id = current_user.get("id")
        or_conditions = [
            {"engineer_id": emp_username},
            {"engineer_id": emp_id}
        ]

        # Also find projects where this employee is assigned via siteId
        employee = await db.employees.find_one({
            "$or": [{"employeeCode": emp_username}, {"username": emp_username}]
        })
        if employee and employee.get("siteId"):
            or_conditions.append({"_id": ObjectId(employee["siteId"])})

        query["$or"] = or_conditions

    projects = await db.projects.find(query).to_list(100)

    # Bug 1.1 - Resolve engineer_id / coordinator_id to names instead of IDs
    employees = await db.employees.find({}, {"fullName": 1, "_id": 1, "employeeCode": 1, "username": 1, "roles": 1}).to_list(1000)
    emp_map = {}
    for e in employees:
        name = e.get("fullName", "Unknown")
        emp_map[str(e["_id"])] = name
        if e.get("employeeCode"): emp_map[e["employeeCode"]] = name
        if e.get("username"): emp_map[e["username"]] = name

    for p in projects:
        new_progress = _calc_progress(p)
        if p.get("progress") != new_progress:
            await db.projects.update_one({"_id": p["_id"]}, {"$set": {"progress": new_progress}})
            p["progress"] = new_progress

        # Resolve IDs to names for display
        if p.get("engineer_id") and p["engineer_id"] in emp_map:
            p["engineer_name"] = emp_map[p["engineer_id"]]
        if p.get("coordinator_id") and p["coordinator_id"] in emp_map:
            p["coordinator_name"] = emp_map[p["coordinator_id"]]

    return projects

@router.get("/all-dprs")
async def get_all_dprs(db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Fetch all DPRs from all projects for Coordinator/Admin."""
    if current_user.get("role") not in ["Project Coordinator", "Super Admin", "Administrator"]:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Pre-fetch employees to resolve IDs/usernames to names
    employees = await db.employees.find({}, {"fullName": 1, "_id": 1, "username": 1, "employeeCode": 1}).to_list(1000)
    emp_map = {}
    for e in employees:
        full_name = e.get("fullName", "Unknown")
        if "_id" in e: emp_map[str(e["_id"])] = full_name
        if "username" in e: emp_map[e["username"]] = full_name
        if "employeeCode" in e: emp_map[e["employeeCode"]] = full_name

    projects = await db.projects.find({}, {"name": 1, "dprs": 1}).to_list(1000)
    all_dprs = []
    for p in projects:
        project_name = p.get("name", "Unknown")
        project_id = str(p["_id"])
        for dpr in p.get("dprs", []):
            dpr["project_name"] = project_name
            dpr["project_id"] = project_id
            
            # Resolve submitted_by to fullName if it looks like an ID/code/username
            raw_sub = dpr.get("submitted_by")
            if raw_sub and raw_sub in emp_map:
                dpr["submitted_by"] = emp_map[raw_sub]
                
            all_dprs.append(dpr)
            
    # Sort by date / created_at DESC
    all_dprs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return all_dprs

@router.get("/{project_id}", response_model=ProjectModel)
async def get_project(project_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # RBAC: Site Engineer can only view assigned projects
    user_role = (current_user.get("role") or "").lower()
    if user_role == "site engineer":
        if project.get("engineer_id") != current_user.get("username") and project.get("engineer_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Not authorized to view this project")

    new_progress = _calc_progress(project)
    if project.get("progress") != new_progress:
        await db.projects.update_one({"_id": project["_id"]}, {"$set": {"progress": new_progress}})
        project["progress"] = new_progress
    return project

@router.put("/{project_id}", response_model=ProjectModel, dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def update_project(project_id: str, project_data: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    # Remove _id if present in data to avoid immutable field error
    if "_id" in project_data:
        del project_data["_id"]
    
    # Check if engineer is being assigned newly
    old_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    engineer_just_assigned = False
    coordinator_just_assigned = False
    
    if "engineer_id" in project_data and project_data["engineer_id"] and old_project and str(old_project.get("engineer_id")) != str(project_data["engineer_id"]):
        engineer_just_assigned = True
        
    if "coordinator_id" in project_data and project_data["coordinator_id"] and old_project and str(old_project.get("coordinator_id")) != str(project_data["coordinator_id"]):
        coordinator_just_assigned = True

    # Clean up dates if they are strings
    for date_field in ["start_date", "end_date", "created_at"]:
        if date_field in project_data and isinstance(project_data[date_field], str):
            try:
                # Common ISO formats
                project_data[date_field] = datetime.fromisoformat(project_data[date_field].replace('Z', '+00:00'))
            except:
                pass

    result = await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": project_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if engineer_just_assigned:
        await trigger_workflow_event(project_id, "engineer_assigned", current_user, db, f"Assigned: {project_data['engineer_id']}")
    if coordinator_just_assigned:
        await trigger_workflow_event(project_id, "coordinator_assigned", current_user, db, f"Assigned: {project_data['coordinator_id']}")

    updated = await db.projects.find_one({"_id": ObjectId(project_id)})
    return updated

@router.put("/{project_id}/status", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def update_project_status(project_id: str, data: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    new_status = data.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")
        
    result = await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"status": new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if new_status == "Ongoing":
        await trigger_workflow_event(project_id, "project_ongoing", current_user, db, "Project marks as Ongoing")
    elif new_status == "Completed":
        await trigger_workflow_event(project_id, "project_completed", current_user, db, "Project successfully Completed")
        
    return {"success": True, "new_status": new_status}

@router.post("/{project_id}/tasks", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def add_task(project_id: str, task: TaskCreate, db = Depends(get_database)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_dict = task.dict()
    task_id = f"T-{datetime.now().strftime('%y%m%d%H%M%S')}"
    task_dict["id"] = task_id
    task_dict["created_at"] = datetime.now().isoformat()

    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"tasks": task_dict}}
    )
    
    # Send Auto Message if assigned
    if task_dict.get("assignedTo"):
        from app.api.chat import send_system_message
        await send_system_message(
            sender="System",
            receiver=task_dict["assignedTo"],
            content=f"New Task Assigned: {task_dict['name']} in Project: {project.get('name')}. Priority: {task_dict['priority']}.",
            msg_type="task_update"
        )

    # Recalculate and persist progress
    updated = await db.projects.find_one({"_id": ObjectId(project_id)})
    new_progress = _calc_progress(updated)
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"progress": new_progress}})
    return {"success": True, "task": task_dict, "progress": new_progress}

@router.put("/{project_id}/tasks/{task_id}", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def update_task(project_id: str, task_id: str, task_update: TaskUpdate, db = Depends(get_database)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    task = next((t for t in project.get("tasks", []) if t.get("id") == task_id), None)
    
    # Update the specific task in the tasks array
    update_data = {"tasks.$.status": task_update.status}
    if task_update.completionPhoto:
        update_data["tasks.$.completionPhoto"] = task_update.completionPhoto
    if task_update.status == "Completed":
        update_data["tasks.$.completedAt"] = datetime.now().isoformat()
    if task_update.remarks:
        update_data["tasks.$.remarks"] = task_update.remarks

    result = await db.projects.update_one(
        {"_id": ObjectId(project_id), "tasks.id": task_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Recalculate progress
    updated_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    new_progress = _calc_progress(updated_project)
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"progress": new_progress}})

    return {"success": True, "progress": new_progress}

@router.post("/{project_id}/tasks/{task_id}/notify")
async def notify_task_update(project_id: str, task_id: str, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    task = next((t for t in project.get("tasks", []) if str(t.get("id")) == task_id or t.get("name") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    from app.api.chat import send_system_message
    
    status = task.get("status")
    status_label = "✅ Completed" if status == "Completed" else ("⏳ In Progress" if status == "In Progress" else "❗ Update")
    
    username = current_user.get("full_name") or current_user.get("username", "Unknown")
    role = current_user.get("role", "Staff")
    
    msg_content = f"{status_label}: '{task.get('name')}' - Site update for Project: {project.get('name')} by {username} ({role})."
    
    if status == "Completed" and task.get("completionPhoto"):
        msg_content += " (Photo uploaded for verification)"

    await send_system_message(
        sender="System",
        receiver="admin", 
        content=msg_content,
        msg_type="task_update"
    )
    
    return {"success": True}
    
@router.post("/{project_id}/tasks/{task_id}/share-email", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def share_task_email(project_id: str, task_id: str, background_tasks: BackgroundTasks, db = Depends(get_database)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    task = next((t for t in project.get("tasks", []) if str(t.get("id")) == task_id or t.get("name") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assigned_id = (task.get("assignedTo") or "").strip()
    if not assigned_id:
        # Fallback to project engineer
        assigned_id = (project.get("engineer_id") or "").strip()

    if not assigned_id:
        raise HTTPException(status_code=400, detail="No one assigned to this task.")

    # Resolve employee email - Case-insensitive and multi-field
    employee = await db.employees.find_one({
        "$or": [
            {"username": {"$regex": f"^{re.escape(assigned_id)}$", "$options": "i"}},
            {"employeeCode": {"$regex": f"^{re.escape(assigned_id)}$", "$options": "i"}},
            {"fullName": {"$regex": f"^{re.escape(assigned_id)}$", "$options": "i"}}
        ]
    })
    
    if not employee or not employee.get("email"):
        raise HTTPException(status_code=400, detail=f"No email address found for '{assigned_id}'. Please check employee profile.")

    recipient_email = employee.get("email")
    recipient_name = employee.get("fullName", assigned_id)
    
    # Prepare email content (HTML for better look)
    subject = f"Assigned Task: {task.get('name')} | {project.get('name')}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e3a5f; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Task Assignment</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Hello <strong>{recipient_name}</strong>,</p>
            <p>You have been assigned a new task for the project <strong>{project.get('name')}</strong>.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Task Name</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">{task.get('name')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Project</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">{project.get('name')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Priority</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">
                        <span style="background-color: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">{task.get('priority')}</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Due Date</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">{task.get('dueDate', 'N/A')} {task.get('dueTime', '')}</td>
                </tr>
            </table>
            
            <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; font-weight: bold; margin-bottom: 8px;">Instructions:</p>
                <p style="margin: 0; font-style: italic;">{task.get('instructions') or 'No specific instructions provided.'}</p>
            </div>
            
            <p style="margin-top: 24px;">Please login to the ERP system to update the task status once the work begins.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
            This is an automated notification from Civil Construction ERP.
        </div>
    </div>
    """
    
    # Send email in background
    background_tasks.add_task(
        send_email, 
        to_email=recipient_email, 
        subject=subject,
        body=html_body,
        is_html=True
    )
    
    return {"success": True, "message": f"Task details shared to {recipient_email}"}

@router.delete("/{project_id}/tasks/{task_id}", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def delete_task(project_id: str, task_id: str, db = Depends(get_database)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$pull": {"tasks": {"id": task_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    # Recalculate progress
    updated = await db.projects.find_one({"_id": ObjectId(project_id)})
    new_progress = _calc_progress(updated)
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"progress": new_progress}})

    return {"success": True, "progress": new_progress}




class DPRCreate(BaseModel):
    date: Optional[str] = ""
    weather: Optional[str] = ""
    total_labour: Optional[str] = ""
    progress: Optional[str] = ""          # summary text
    status: Optional[str] = "Pending"
    work_rows: Optional[list] = []
    labour_rows: Optional[list] = []
    material_rows: Optional[list] = []
    equipment_rows: Optional[list] = []
    next_day_materials: Optional[list] = []
    next_day_equipment: Optional[list] = []
    next_day_labour: Optional[list] = []
    contractor_rows: Optional[list] = []
    issues: Optional[str] = ""
    notes: Optional[str] = ""
    photos: Optional[list] = []
    submitted_by: Optional[str] = ""


@router.post("/{project_id}/dprs")
async def add_dpr(project_id: str, dpr: DPRCreate, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dpr_dict = dpr.dict()
    # C12 Fix: Sanitize user-generated text fields in DPR
    for field in ["progress", "issues", "notes"]:
        if dpr_dict.get(field):
            dpr_dict[field] = sanitize_string(dpr_dict[field])
    for list_field in ["work_rows", "labour_rows", "material_rows", "equipment_rows"]:
        if dpr_dict.get(list_field):
            dpr_dict[list_field] = sanitize_list(dpr_dict[list_field])
    dpr_dict["id"] = f"DPR-{datetime.now().strftime('%y%m%d%H%M%S')}"
    dpr_dict["created_at"] = datetime.now().isoformat()
    if not dpr_dict["date"]:
        dpr_dict["date"] = datetime.now().strftime("%d %b %Y")

    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"dprs": dpr_dict}}
    )

    # Automatically create a Material Request if next_day_materials is provided
    if dpr.next_day_materials and len(dpr.next_day_materials) > 0:
        requested_items = []
        for item in dpr.next_day_materials:
            if item.get("material") and item.get("qty"):
                try:
                    qty = float(item["qty"])
                    if qty > 0:
                        requested_items.append({
                            "name": item["material"],
                            "quantity": qty,
                            "unit": item.get("unit", "Nos")
                        })
                except:
                    continue

        if requested_items:
            mat_request = {
                "project_id": project_id,
                "project_name": project.get("name", "Unknown"),
                "engineer_id": current_user.get("full_name") or current_user.get("username", "Site Engineer"),
                "requested_items": requested_items,
                "priority": "Medium",
                "status": "Pending",
                "created_at": datetime.now(),
                "source": "DPR",
                "source_id": dpr_dict["id"],
                "issued_items": []
            }
            await db.material_requests.insert_one(mat_request)

    # Automatically create a Manpower Request if next_day_labour is provided
    if dpr.next_day_labour and len(dpr.next_day_labour) > 0:
        requested_roles = []
        for item in dpr.next_day_labour:
            role = item.get("role") or item.get("category") or item.get("designation")
            count_val = item.get("count") or item.get("quantity") or item.get("qty")
            
            if role and count_val:
                try:
                    count = int(count_val)
                    if count > 0:
                        requested_roles.append({
                            "role": role,
                            "count": count
                        })
                except:
                    continue

        if requested_roles:
            labour_request = {
                "project_id": project_id,
                "project_name": project.get("name", "Unknown"),
                "engineer_id": current_user.get("full_name") or current_user.get("username", "Site Engineer"),
                "requested_items": requested_roles,
                "priority": "Medium",
                "status": "Pending", # PC needs to verify
                "created_at": datetime.now(),
                "source": "DPR",
                "source_id": dpr_dict["id"]
            }
            await db.manpower_requests.insert_one(labour_request)
    
    await trigger_workflow_event(project_id, "dpr_submitted", current_user, db, f"DPR attached for {dpr_dict['date']}")
    
    return {"success": True, "dpr": dpr_dict}
@router.put("/{project_id}/dprs/{dpr_id}/status")
async def update_dpr_status(project_id: str, dpr_id: str, data: dict, db = Depends(get_database), current_user: dict = Depends(get_current_user)):
    new_status = data.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")

    user_role = (current_user.get("role") or "").strip()
    user_name = current_user.get("full_name") or current_user.get("username", "Unknown")

    # Bug 4.7 - Enforce workflow: SE submits -> Coordinator reviews -> Admin approves
    # Valid statuses: Pending, Reviewed, Approved, Rejected
    # Coordinator can: Pending -> Reviewed, Pending -> Rejected
    # Admin/Super Admin can: any transition (including Reviewed -> Approved)
    is_admin = user_role in ("Super Admin", "Administrator", "Admin", "Managing Director")
    is_coordinator = "coordinator" in user_role.lower()

    if not is_admin and not is_coordinator:
        raise HTTPException(status_code=403, detail="Only Coordinators or Admins can update DPR status")

    # Get current DPR status
    project = await db.projects.find_one(
        {"_id": ObjectId(project_id), "dprs.id": dpr_id},
        {"dprs.$": 1}
    )
    if not project or not project.get("dprs"):
        raise HTTPException(status_code=404, detail="DPR or Project not found")

    current_status = project["dprs"][0].get("status", "Pending")

    # Coordinators can only move Pending -> Reviewed or Pending -> Rejected
    if is_coordinator and not is_admin:
        if current_status != "Pending":
            raise HTTPException(status_code=400, detail=f"Coordinator can only review Pending DPRs. Current status: {current_status}")
        if new_status not in ("Reviewed", "Rejected"):
            raise HTTPException(status_code=400, detail="Coordinator can only mark DPR as 'Reviewed' or 'Rejected'")

    update_fields = {
        "dprs.$.status": new_status,
        "dprs.$.status_updated_by": user_name,
        "dprs.$.status_updated_at": datetime.now().isoformat()
    }

    result = await db.projects.update_one(
        {"_id": ObjectId(project_id), "dprs.id": dpr_id},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="DPR or Project not found")

    if new_status == "Reviewed":
        await trigger_workflow_event(project_id, "dpr_verified", current_user, db, f"DPR {dpr_id} reviewed by coordinator")
    elif new_status == "Approved":
        await trigger_workflow_event(project_id, "dpr_approved", current_user, db, f"DPR {dpr_id} approved")

    return {"success": True, "new_status": new_status}

@router.post("/{project_id}/documents", dependencies=[Depends(RBACPermission("Projects", "edit"))])
async def add_document(project_id: str, document: dict, db = Depends(get_database)):
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    document["id"] = f"DOC-{datetime.now().strftime('%y%m%d%H%M%S')}"
    document["created_at"] = datetime.now().isoformat()
    if not document.get("date"):
        document["date"] = datetime.now().strftime("%d %b %Y")

    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"documents": document}}
    )
    return {"success": True, "document": document}
