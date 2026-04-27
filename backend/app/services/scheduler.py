import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
from database import get_database
from bson import ObjectId
import json

# Import notification helpers
from app.api.chat import send_system_message
from app.utils.notifications import notify, EVENT_TASK, EVENT_HR, EVENT_FLEET, EVENT_FINANCE


async def check_overdue_tasks():
    """Check for overdue tasks and send reminders. Runs every 30 minutes."""
    print(f"[{datetime.now()}] Running overdue task check...")
    db = await get_database()
    now = datetime.now()

    projects = await db.projects.find({"status": "Ongoing"}).to_list(1000)

    for project in projects:
        project_id = project["_id"]
        tasks = project.get("tasks", [])
        update_fields = {}

        for i, task in enumerate(tasks):
            if task.get("status") not in ["In Progress", "Pending"]:
                continue

            due_date_str = task.get("dueDate")
            due_time_str = task.get("dueTime") or "23:59"

            if not due_date_str:
                continue

            try:
                due_dt = datetime.strptime(f"{due_date_str} {due_time_str}", "%Y-%m-%d %H:%M")

                # 1. OVERDUE
                if now > due_dt:
                    task["status"] = "Overdue"
                    update_fields[f"tasks.{i}.status"] = "Overdue"

                    msg = f"TASK OVERDUE: '{task.get('name')}' in project '{project.get('name')}' was due at {due_date_str} {due_time_str}."

                    # Notify via old system message (for backward compat)
                    try:
                        await send_system_message("System", "admin", msg, "task_alert")
                    except Exception:
                        pass

                    if task.get("assignedTo"):
                        try:
                            await send_system_message("System", task["assignedTo"], msg, "task_alert")
                        except Exception:
                            pass

                    # Notify via new notification system
                    try:
                        recipients = ["Administrator"]
                        if task.get("assignedTo"):
                            recipients.append(task["assignedTo"])
                        if project.get("engineer_id"):
                            recipients.append(project["engineer_id"])
                        await notify(db, "System", recipients, EVENT_TASK,
                            "Task Overdue",
                            msg,
                            entity_type="task", entity_id=str(project_id),
                            project_name=project.get("name"), priority="critical")
                    except Exception:
                        pass

                # 2. REMINDER (due within next 60 min, sent once)
                elif now < due_dt < now + timedelta(minutes=60):
                    if not task.get("reminder_sent"):
                        task["reminder_sent"] = True
                        update_fields[f"tasks.{i}.reminder_sent"] = True

                        rem_msg = f"REMINDER: Task '{task.get('name')}' in '{project.get('name')}' is due at {due_time_str}."

                        if task.get("assignedTo"):
                            try:
                                await send_system_message("System", task["assignedTo"], rem_msg, "task_reminder")
                                await notify(db, "System", [task["assignedTo"]], EVENT_TASK,
                                    "Task Due Soon",
                                    rem_msg,
                                    entity_type="task", entity_id=str(project_id),
                                    project_name=project.get("name"), priority="high")
                            except Exception:
                                pass

            except Exception as e:
                print(f"Error parsing date for task {task.get('name', 'Unknown')}: {e}")

        if update_fields:
            await db.projects.update_one(
                {"_id": project_id},
                {"$set": update_fields}
            )


async def check_attendance_anomalies():
    """Check for attendance anomalies. Runs daily at 10 AM."""
    print(f"[{datetime.now()}] Running attendance anomaly check...")
    db = await get_database()
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    # Get HRMS settings for office start time + grace period
    hrms_config = await db.settings.find_one({"type": "hrms_config"})
    office_start = hrms_config.get("officeStartTime", "09:00") if hrms_config else "09:00"
    grace_minutes = int(hrms_config.get("gracePeriod", 15)) if hrms_config else 15

    try:
        office_hour, office_min = map(int, office_start.split(":"))
        late_threshold = datetime(now.year, now.month, now.day, office_hour, office_min) + timedelta(minutes=grace_minutes)
    except Exception:
        late_threshold = datetime(now.year, now.month, now.day, 9, 15)

    # --- 1. Absent without leave (employees who didn't clock in today and have no leave) ---
    active_employees = await db.employees.find(
        {"status": "Active"},
        {"employeeCode": 1, "username": 1, "fullName": 1, "siteId": 1}
    ).to_list(1000)

    # Exclude drivers/labourers who don't use attendance system
    for emp in active_employees:
        emp_username = emp.get("employeeCode") or emp.get("username", "")
        if not emp_username:
            continue

        # Check if they clocked in today
        attendance = await db.attendance.find_one({
            "username": emp_username,
            "date": today_str
        })

        # Check if they have leave today
        leave = await db.attendance.find_one({
            "$or": [
                {"employeeId": str(emp["_id"]), "date": today_str, "status": "Leave"},
                {"employeeId": emp_username, "date": today_str, "status": "Leave"}
            ]
        })

        if not attendance and not leave:
            # Absent without leave - notify HR
            try:
                await notify(db, "System", ["HR Manager", "Administrator"], EVENT_HR,
                    "Absent Without Leave",
                    f"{emp.get('fullName', emp_username)} has not clocked in today and has no approved leave.",
                    priority="normal")
            except Exception:
                pass

    # --- 2. Latecomers this week (3+ times) ---
    # Calculate start of this week (Monday)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")

    # Find employees who were late 3+ times this week
    pipeline = [
        {"$match": {
            "date": {"$gte": week_start, "$lte": today_str},
            "status": "Present",
            "check_in": {"$exists": True}
        }},
        {"$group": {
            "_id": "$username",
            "late_days": {
                "$sum": {
                    "$cond": [
                        {"$gt": [
                            {"$dateFromString": {
                                "dateString": {"$concat": ["$date", "T", "$check_in"]},
                                "onError": late_threshold
                            }},
                            late_threshold
                        ]},
                        1, 0
                    ]
                }
            }
        }},
        {"$match": {"late_days": {"$gte": 3}}}
    ]

    try:
        late_employees = await db.attendance.aggregate(pipeline).to_list(100)
        for late_emp in late_employees:
            username = late_emp["_id"]
            late_count = late_emp["late_days"]
            emp_doc = await db.employees.find_one(
                {"$or": [{"employeeCode": username}, {"username": username}]},
                {"fullName": 1}
            )
            emp_name = emp_doc.get("fullName", username) if emp_doc else username

            await notify(db, "System", ["HR Manager", "Administrator"], EVENT_HR,
                "Frequent Late Arrival",
                f"{emp_name} has been late {late_count} times this week (threshold: 3).",
                priority="high")
    except Exception as e:
        print(f"Late check aggregation error: {e}")


async def check_vehicle_maintenance():
    """Check vehicles overdue for maintenance. Runs daily."""
    print(f"[{datetime.now()}] Running vehicle maintenance check...")
    db = await get_database()
    now = datetime.now()

    vehicles = await db.vehicles.find().to_list(500)

    for vehicle in vehicles:
        last_service = vehicle.get("lastServiceDate")
        if not last_service:
            continue

        try:
            if isinstance(last_service, str):
                last_service_dt = datetime.strptime(last_service, "%Y-%m-%d")
            elif isinstance(last_service, datetime):
                last_service_dt = last_service
            else:
                continue

            days_since = (now - last_service_dt).days
            reg = vehicle.get("registrationNumber") or vehicle.get("number") or str(vehicle["_id"])

            # Alert if >90 days since last service
            if days_since > 90:
                await notify(db, "System", ["Administrator", "General Manager"], EVENT_FLEET,
                    "Vehicle Maintenance Overdue",
                    f"Vehicle {reg} last serviced {days_since} days ago ({last_service_dt.strftime('%d %b %Y')}). Maintenance is overdue.",
                    entity_type="vehicle", entity_id=str(vehicle["_id"]), priority="high")

        except Exception as e:
            print(f"Vehicle maintenance check error for {vehicle.get('_id')}: {e}")


async def check_fuel_stock():
    """Check for low fuel stock at sites. Runs daily."""
    print(f"[{datetime.now()}] Running fuel stock check...")
    db = await get_database()

    # Get fuel stock grouped by site
    pipeline = [
        {"$group": {
            "_id": "$site",
            "total_purchased": {"$sum": "$qty"}
        }}
    ]
    stock_by_site = {r["_id"]: r["total_purchased"] for r in await db.fuel_stock.aggregate(pipeline).to_list(100)}

    # Get fuel consumption grouped by site
    pipeline_logs = [
        {"$group": {
            "_id": "$site",
            "total_consumed": {"$sum": "$qty"}
        }}
    ]
    consumed_by_site = {r["_id"]: r["total_consumed"] for r in await db.fuel_logs.aggregate(pipeline_logs).to_list(100)}

    for site, purchased in stock_by_site.items():
        consumed = consumed_by_site.get(site, 0)
        remaining = purchased - consumed

        # Alert if below 100 liters
        if remaining < 100:
            try:
                await notify(db, "System", ["Administrator", "General Manager"], EVENT_FLEET,
                    "Low Fuel Stock",
                    f"Fuel stock at {site} is low: {remaining:.0f} liters remaining.",
                    priority="high")
            except Exception:
                pass


async def check_overdue_bills():
    """Check for overdue purchase bills and client bills. Runs daily."""
    print(f"[{datetime.now()}] Running overdue bill check...")
    db = await get_database()
    now = datetime.now()

    # --- Overdue Purchase Bills (Unpaid/Draft older than 30 days) ---
    cutoff = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    overdue_purchase_bills = await db.purchase_bills.find({
        "status": {"$in": ["Unpaid", "Draft", "Partially Paid"]},
        "bill_date": {"$lte": cutoff}
    }).to_list(100)

    for bill in overdue_purchase_bills:
        bill_no = bill.get("bill_no", "N/A")
        vendor = bill.get("vendor_name", "Unknown")
        amount = bill.get("total_amount", 0)
        bill_date = bill.get("bill_date", "")

        try:
            await notify(db, "System", ["Accountant", "Administrator"], EVENT_FINANCE,
                "Purchase Bill Overdue",
                f"Bill {bill_no} from {vendor} (Rs.{amount:,.0f}) dated {bill_date} is pending for 30+ days.",
                entity_type="expense", entity_id=str(bill["_id"]),
                project_name=bill.get("project_name"), priority="high")
        except Exception:
            pass

    # --- Overdue Client Bills (Pending older than 30 days) ---
    client_bills = await db.bills.find({
        "status": {"$in": ["Pending", "Partially Paid"]}
    }).to_list(100)

    for bill in client_bills:
        created = bill.get("created_at", "")
        try:
            if isinstance(created, str) and created:
                bill_dt = datetime.fromisoformat(created)
            elif isinstance(created, datetime):
                bill_dt = created
            else:
                continue

            if (now - bill_dt).days > 30:
                bill_no = bill.get("bill_no", "N/A")
                project = bill.get("project", "Unknown")
                total = bill.get("total_amount", 0)
                collected = bill.get("collection_amount", 0)
                balance = total - collected

                await notify(db, "System", ["Accountant", "Administrator", "General Manager"], EVENT_FINANCE,
                    "Client Payment Overdue",
                    f"Bill #{bill_no} for {project} - Balance Rs.{balance:,.0f} pending for 30+ days.",
                    entity_type="bill", entity_id=str(bill["_id"]),
                    project_name=project, priority="high")
        except Exception:
            pass


async def send_daily_digest():
    """Send daily notification digest emails. Runs at 8 AM."""
    print(f"[{datetime.now()}] Sending daily notification digests...")
    db = await get_database()

    try:
        from app.utils.email import send_email
        from app.utils.email_templates import digest_email

        # Get company name for email branding
        company_settings = await db.settings.find_one({"type": "company_profile"})
        company_name = company_settings.get("companyName", "Civil ERP") if company_settings else "Civil ERP"

        # Find all users with unread notifications from last 24 hours
        yesterday = datetime.now() - timedelta(hours=24)
        pipeline = [
            {"$match": {"is_read": False, "created_at": {"$gte": yesterday}}},
            {"$group": {"_id": "$recipient", "notifications": {"$push": "$$ROOT"}, "count": {"$sum": 1}}}
        ]

        user_notifs = await db.notifications.aggregate(pipeline).to_list(500)

        for user_data in user_notifs:
            username = user_data["_id"]
            notifications = user_data["notifications"]

            if not notifications:
                continue

            # Find user email
            emp = await db.employees.find_one(
                {"$or": [{"employeeCode": username}, {"username": username}]},
                {"email": 1, "fullName": 1}
            )

            if not emp or not emp.get("email"):
                continue

            # Check user preferences (if stored)
            # For now, send to all users with unread notifications

            html = digest_email(
                username=emp.get("fullName", username),
                notifications=notifications,
                company_name=company_name
            )

            try:
                send_email(
                    to_email=emp["email"],
                    subject=f"{company_name} - Daily Summary ({len(notifications)} notifications)",
                    body=html,
                    is_html=True
                )
            except Exception as e:
                print(f"Failed to send digest to {emp['email']}: {e}")

    except Exception as e:
        print(f"Daily digest error: {e}")


async def check_budget_overspend():
    """Check projects where spending exceeds budget. Runs daily."""
    print(f"[{datetime.now()}] Running budget overspend check...")
    db = await get_database()

    projects = await db.projects.find(
        {"status": {"$in": ["Ongoing", "Planning"]}},
        {"name": 1, "estimated_budget": 1, "budget": 1, "spent": 1, "engineer_id": 1, "coordinator_id": 1}
    ).to_list(500)

    for project in projects:
        budget = float(project.get("estimated_budget") or project.get("budget") or 0)
        spent = float(project.get("spent") or 0)
        if budget <= 0:
            continue

        pct = (spent / budget) * 100
        name = project.get("name", "Unknown")
        pid = str(project["_id"])

        recipients = ["Administrator", "General Manager"]
        if project.get("engineer_id"):
            recipients.append(project["engineer_id"])
        if project.get("coordinator_id"):
            recipients.append(project["coordinator_id"])

        try:
            if pct >= 100:
                await notify(db, "System", recipients, EVENT_FINANCE,
                    "Budget Exceeded",
                    f"Project '{name}' has EXCEEDED budget: Rs.{spent:,.0f} spent of Rs.{budget:,.0f} ({pct:.0f}%)",
                    entity_type="project", entity_id=pid, project_name=name, priority="critical")
            elif pct >= 90:
                await notify(db, "System", recipients, EVENT_FINANCE,
                    "Budget Warning (90%+)",
                    f"Project '{name}' is at {pct:.0f}% of budget: Rs.{spent:,.0f} of Rs.{budget:,.0f}",
                    entity_type="project", entity_id=pid, project_name=name, priority="high")
        except Exception:
            pass


async def daily_checks():
    """Bundle all daily checks into one function."""
    try:
        await check_attendance_anomalies()
    except Exception as e:
        print(f"Attendance anomaly check failed: {e}")

    try:
        await check_vehicle_maintenance()
    except Exception as e:
        print(f"Vehicle maintenance check failed: {e}")

    try:
        await check_fuel_stock()
    except Exception as e:
        print(f"Fuel stock check failed: {e}")

    try:
        await check_overdue_bills()
    except Exception as e:
        print(f"Overdue bill check failed: {e}")

    try:
        await check_budget_overspend()
    except Exception as e:
        print(f"Budget overspend check failed: {e}")


def start_scheduler():
    scheduler = AsyncIOScheduler()

    # Task overdue check - every 30 minutes
    scheduler.add_job(check_overdue_tasks, 'interval', minutes=30)

    # Daily checks (anomalies, maintenance, fuel, bills) - run at 10:00 AM
    scheduler.add_job(daily_checks, 'cron', hour=10, minute=0)

    # Daily notification digest email - run at 8:00 AM
    scheduler.add_job(send_daily_digest, 'cron', hour=8, minute=0)

    scheduler.start()
    print("Scheduler Started: Task check (30min) + Daily alerts (10 AM) + Email digest (8 AM)")
