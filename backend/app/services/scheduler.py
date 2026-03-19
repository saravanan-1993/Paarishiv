import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
from database import get_database
from bson import ObjectId
import json

# Import notification helper
from app.api.chat import send_system_message

async def check_overdue_tasks():
    print(f"[{datetime.now()}] Running background task check...")
    db = await get_database()
    now = datetime.now()
    
    # Fetch all projects to check internal tasks
    # In a larger system, we might search tasks collection if tasks were separate
    projects = await db.projects.find({"status": "Ongoing"}).to_list(1000)
    
    for project in projects:
        project_id = project["_id"]
        tasks = project.get("tasks", [])
        update_fields = {}
        
        for i, task in enumerate(tasks):
            # Only check tasks that are currently 'In Progress' or 'Pending'
            if task.get("status") not in ["In Progress", "Pending"]:
                continue
                
            due_date_str = task.get("dueDate")
            due_time_str = task.get("dueTime") or "23:59" # Default to end of day
            
            if not due_date_str:
                continue
                
            try:
                # Assuming YYYY-MM-DD format as per common JS date pickers
                due_dt = datetime.strptime(f"{due_date_str} {due_time_str}", "%Y-%m-%d %H:%M")
                
                # 1. Check for OVERDUE
                if now > due_dt:
                    print(f"!!! Task '{task.get('name')}' is OVERDUE (due {due_dt})")
                    task["status"] = "Overdue"
                    update_fields[f"tasks.{i}.status"] = "Overdue"
                    
                    # Notify Admin & Assigned User
                    msg = f"❗ TASK OVERDUE: '{task.get('name')}' in project '{project.get('name')}' was due at {due_date_str} {due_time_str}."
                    
                    # Notify Admin (demo)
                    try:
                        await send_system_message("System", "admin", msg, "task_alert")
                    except Exception as ex:
                        print(f"Failed to notify admin: {ex}")
                    
                    # Notify Assigned User
                    if task.get("assignedTo"):
                        try:
                            await send_system_message("System", task.get("assignedTo"), msg, "task_alert")
                        except Exception as ex:
                            print(f"Failed to notify {task.get('assignedTo')}: {ex}")
                
                    # Notify any other admins in DB
                    try:
                        admins = await db.employees.find({"roles": {"$in": ["Super Admin", "Admin", "Administrator"]}}).to_list(10)
                        for a in admins:
                            admin_id = a.get("username") or a.get("employeeCode")
                            if admin_id and admin_id != "admin" and admin_id != task.get("assignedTo"):
                                await send_system_message("System", admin_id, msg, "task_alert")
                    except Exception as ex:
                        print(f"Error notifying secondary admins: {ex}")
                
                # 2. Check for REMINDER (only once)
                # Since scheduler runs every 30 mins, checking if due within next 60 mins is safer
                elif now < due_dt < now + timedelta(minutes=60):
                    if not task.get("reminder_sent"):
                        task["reminder_sent"] = True
                        update_fields[f"tasks.{i}.reminder_sent"] = True
                        
                        rem_msg = f"⏳ REMINDER: Task '{task.get('name')}' is due fast ({due_time_str} target)."
                        
                        # Notify Assigned User safely
                        if task.get("assignedTo"):
                            try:
                                await send_system_message("System", task.get("assignedTo"), rem_msg, "task_reminder")
                            except Exception as ex:
                                print(f"Reminder err: {ex}")
                            
            except Exception as e:
                print(f"Error parsing date for task {task.get('name', 'Unknown')}: {e}")
                
        if update_fields:
            await db.projects.update_one(
                {"_id": project_id},
                {"$set": update_fields}
            )

def start_scheduler():
    scheduler = AsyncIOScheduler()
    # Check every 30 minutes - more reasonable for construction tasks & server health
    scheduler.add_job(check_overdue_tasks, 'interval', minutes=30)
    scheduler.start()
    print("Task Scheduler Started (30 min interval)")
