"""
Centralized Notification Service for Civil ERP
Handles in-app (WebSocket + DB) notifications for every activity.
Role-based recipient resolution ensures the right people get notified.
"""

import json
import asyncio
from datetime import datetime
from typing import List, Optional
from database import get_database
from app.utils.email import send_email

# Event type constants
EVENT_APPROVAL = "approval"
EVENT_WORKFLOW = "workflow"
EVENT_MATERIAL = "material"
EVENT_FINANCE = "finance"
EVENT_HR = "hr"
EVENT_TASK = "task"
EVENT_FLEET = "fleet"
EVENT_PROJECT = "project"
EVENT_SYSTEM = "system"


# System/automated sender names that don't have a human role
_SYSTEM_SENDERS = {
    "system", "hr system", "project system", "budget monitor",
    "scheduler", "auto", "civil erp", "erp",
}


async def _resolve_sender_role(db, sender: str) -> Optional[str]:
    """Look up the sender's role from employees collection.

    Returns 'System' for automated senders, role name for real users,
    None if sender cannot be matched.
    """
    if not sender or not isinstance(sender, str):
        return None
    if sender.strip().lower() in _SYSTEM_SENDERS:
        return "System"
    try:
        emp = await db.employees.find_one(
            {"$or": [
                {"fullName": sender},
                {"username": sender},
                {"employeeCode": sender},
            ]},
            {"role": 1, "roles": 1}
        )
        if emp:
            role = emp.get("role")
            if not role:
                roles_arr = emp.get("roles") or []
                if isinstance(roles_arr, list) and roles_arr:
                    role = roles_arr[0]
            return role or None
    except Exception:
        pass
    return None


async def resolve_recipients(db, recipients: List[str]) -> List[str]:
    """
    Resolve a mixed list of usernames and role names to actual usernames.
    - Dynamically fetches all role names from DB (supports custom roles)
    - If a recipient matches a known role, find all active employees with that role
    - Otherwise treat it as a direct username
    """
    # Dynamically fetch all role names from DB
    all_role_names = set()
    try:
        roles_doc = await db.roles.find_one({"_id": "global_roles"})
        if roles_doc and roles_doc.get("roles"):
            for role in roles_doc["roles"]:
                if role.get("name"):
                    all_role_names.add(role["name"])
    except Exception:
        pass

    # Fallback: always recognize these core roles even if DB fetch fails
    all_role_names.update({
        "Administrator", "Super Admin", "Managing Director"
    })

    resolved = set()
    role_queries = []

    for r in recipients:
        if r in all_role_names:
            role_queries.append(r)
        else:
            resolved.add(r)

    if role_queries:
        # Find active employees whose roles array OR single role field matches
        employees = await db.employees.find(
            {
                "status": "Active",
                "$or": [
                    {"roles": {"$in": role_queries}},
                    {"role": {"$in": role_queries}},
                    {"designation": {"$in": role_queries}},
                ]
            },
            {"employeeCode": 1, "username": 1}
        ).to_list(500)
        for emp in employees:
            uname = emp.get("employeeCode") or emp.get("username")
            if uname:
                resolved.add(uname)

    return list(resolved)


async def get_project_stakeholders(db, project_id: str = None, project_name: str = None) -> dict:
    """
    Get key people for a project: engineer, coordinator, and project name.
    Returns dict with keys: engineer, coordinator, project_name
    """
    query = {}
    if project_id:
        from bson import ObjectId
        try:
            query["_id"] = ObjectId(project_id)
        except Exception:
            return {}
    elif project_name:
        query["name"] = project_name
    else:
        return {}

    project = await db.projects.find_one(query, {
        "engineer_id": 1, "coordinator_id": 1, "name": 1
    })
    if not project:
        return {}

    return {
        "engineer": project.get("engineer_id", ""),
        "coordinator": project.get("coordinator_id", ""),
        "project_name": project.get("name", "")
    }


async def notify(
    db,
    sender: str,
    recipients: List[str],
    event_type: str,
    title: str,
    content: str,
    entity_type: str = None,
    entity_id: str = None,
    project_name: str = None,
    priority: str = "normal",
):
    """
    Central notification function.
    - Resolves role-based recipients to usernames
    - Stores notifications in DB
    - Sends via WebSocket to online users

    Args:
        db: Database instance
        sender: Username or "System"
        recipients: List of usernames and/or role names
        event_type: One of EVENT_* constants
        title: Short notification title
        content: Detailed message
        entity_type: "project", "po", "grn", "leave", "dpr", "expense", "material_request", etc.
        entity_id: ID for navigation
        project_name: Associated project name
        priority: "normal", "high", "critical"
    """
    # Resolve roles to actual usernames
    resolved = await resolve_recipients(db, recipients)

    # Remove sender from recipients (don't notify yourself)
    resolved = [r for r in resolved if r != sender]

    if not resolved:
        return []

    # Resolve sender's role so the UI can show "from <Role>" on each notification.
    # System/automated senders are tagged as "System". Real users are looked up by
    # fullName / username in employees collection.
    sender_role = await _resolve_sender_role(db, sender)

    # Import WebSocket manager
    try:
        from app.api.chat import manager
    except ImportError:
        manager = None

    now = datetime.now()
    notifications = []

    for recipient in resolved:
        notif = {
            "recipient": recipient,
            "sender": sender,
            "sender_role": sender_role,
            "event_type": event_type,
            "title": title,
            "content": content,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "project_name": project_name,
            "priority": priority,
            "is_read": False,
            "created_at": now,
            "read_at": None,
        }
        notifications.append(notif)

    # Bulk insert
    if notifications:
        result = await db.notifications.insert_many(notifications)

        # Send via WebSocket to online users
        if manager:
            for i, notif in enumerate(notifications):
                notif["_id"] = str(result.inserted_ids[i])
                ws_payload = {
                    "_id": notif["_id"],
                    "sender": "System",
                    "receiver": notif["recipient"],
                    "content": notif["content"],
                    "message_type": f"notif_{event_type}",
                    "timestamp": now.isoformat(),
                    "notification": {
                        "id": notif["_id"],
                        "title": notif["title"],
                        "content": notif["content"],
                        "event_type": notif["event_type"],
                        "entity_type": notif["entity_type"],
                        "entity_id": notif["entity_id"],
                        "project_name": notif["project_name"],
                        "priority": notif["priority"],
                        "sender": notif["sender"],
                        "sender_role": notif["sender_role"],
                        "created_at": now.isoformat(),
                    }
                }
                try:
                    await manager.send_personal_message(
                        json.dumps(ws_payload, default=str),
                        notif["recipient"]
                    )
                except Exception:
                    pass  # User offline, notification is in DB

    # Send email to admin-class users for approval-worthy events.
    # Detects admin-class recipients dynamically (whitespace/case tolerant) rather
    # than relying on a hardcoded "Administrator" string match.
    if event_type in _EMAIL_EVENTS:
        try:
            from app.utils.rbac import is_admin_role
            has_admin_recipient = any(is_admin_role(r) for r in recipients if isinstance(r, str))
            if has_admin_recipient:
                await _send_admin_email(db, title, content, entity_type, project_name)
        except Exception:
            pass  # Don't fail notification if email fails

    return notifications


def _generate_approval_email_html(title: str, content: str, entity_type: str = None, project_name: str = None):
    """Generate a styled HTML email for approval notifications."""
    now = datetime.now()
    entity_label = (entity_type or "item").replace("_", " ").title()
    project_line = f'<p style="margin: 0 0 8px 0;"><strong>Project:</strong> {project_name}</p>' if project_name else ""

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #F59E0B; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 22px;">Approval Required</h1>
        </div>
        <div style="padding: 24px;">
            <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1E293B;">{title}</h2>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">{content}</p>
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Type:</strong> {entity_label}</p>
                {project_line}
                <p style="margin: 0;"><strong>Date:</strong> {now.strftime('%d %b %Y, %I:%M %p')}</p>
            </div>
            <p style="font-size: 14px; color: #64748B; margin-top: 20px;">
                Please login to Civil ERP to review and take action on this request.
            </p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #eee;">
            &copy; {now.year} Civil ERP Construction Management
        </div>
    </div>
    """


async def _send_admin_email(db, title: str, content: str, entity_type: str = None, project_name: str = None):
    """Send email notification to all Admin users for approval requests."""
    try:
        # Dynamic recipient resolution — whoever has Approvals → edit permission
        # is treated as an approval-class admin. No hardcoded role names.
        from app.utils.rbac import get_users_with_permission
        admin_usernames = await get_users_with_permission(db, "Approvals", "edit")
        if not admin_usernames:
            return
        admins = await db.employees.find(
            {"$or": [{"username": {"$in": admin_usernames}}, {"employeeCode": {"$in": admin_usernames}}],
             "status": {"$ne": "Inactive"}},
            {"email": 1, "fullName": 1}
        ).to_list(50)

        html = _generate_approval_email_html(title, content, entity_type, project_name)
        subject = f"[Civil ERP] Approval Required: {title}"

        for admin in admins:
            email = admin.get("email")
            if email:
                try:
                    send_email(email, subject, html, is_html=True)
                except Exception as e:
                    print(f"Failed to send approval email to {email}: {e}")
    except Exception as e:
        print(f"Admin email notification error: {e}")


# Email-worthy event types (triggers email to admin)
_EMAIL_EVENTS = {EVENT_APPROVAL, EVENT_MATERIAL, EVENT_FINANCE, EVENT_WORKFLOW, EVENT_HR}


# ── Convenience helpers for common notification patterns ──

async def notify_approval(db, sender: str, item_type: str, item_name: str,
                          action: str, recipients: List[str],
                          entity_type: str = None, entity_id: str = None,
                          project_name: str = None, reason: str = ""):
    """Notify about approval/rejection of an item."""
    status_emoji = "Approved" if action.lower() == "approve" else "Rejected"
    title = f"{item_type} {status_emoji}"
    content = f"{item_type} '{item_name}' has been {status_emoji.lower()} by {sender}"
    if reason:
        content += f". Reason: {reason}"

    await notify(
        db, sender, recipients,
        event_type=EVENT_APPROVAL,
        title=title,
        content=content,
        entity_type=entity_type,
        entity_id=entity_id,
        project_name=project_name,
        priority="high",
    )


async def notify_workflow(db, sender: str, stage: str, project_name: str,
                          recipients: List[str], entity_id: str = None, details: str = ""):
    """Notify about workflow stage progression."""
    title = f"Workflow: {stage}"
    content = details or f"Project '{project_name}' reached stage: {stage}"

    await notify(
        db, sender, recipients,
        event_type=EVENT_WORKFLOW,
        title=title,
        content=content,
        entity_type="project",
        entity_id=entity_id,
        project_name=project_name,
        priority="normal",
    )
