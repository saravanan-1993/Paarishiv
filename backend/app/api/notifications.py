"""
Notification API endpoints for Civil ERP
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime
from database import get_database
from app.utils.auth import get_current_user, validate_object_id
from app.utils.rbac import normalize_role
from bson import ObjectId

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def get_notifications(
    event_type: Optional[str] = None,
    is_read: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_database),
    current_user=Depends(get_current_user)
):
    """Get current user's notifications with pagination and filters."""
    username = current_user.get("username", "")
    user_role = normalize_role(current_user.get("role", ""))
    query = {"recipient": username}

    if event_type:
        query["event_type"] = event_type
    if is_read == "true":
        query["is_read"] = True
    elif is_read == "false":
        query["is_read"] = False

    # Site Engineers only see notifications for their assigned projects
    if user_role == "siteengineer":
        emp_code = current_user.get("username") or current_user.get("employeeCode", "")
        assigned_projects = await db.projects.find(
            {"$or": [
                {"engineer_id": emp_code},
                {"engineer_id": current_user.get("id", "")},
            ]},
            {"name": 1}
        ).to_list(200)
        assigned_names = [p["name"] for p in assigned_projects if p.get("name")]
        # Show: no project attached (system/personal) OR project they're assigned to
        query["$or"] = [
            {"project_name": {"$in": [None, "", *assigned_names]}},
            {"project_name": {"$exists": False}},
        ]

    skip = (page - 1) * limit

    total = await db.notifications.count_documents(query)
    notifications = await db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for n in notifications:
        n["_id"] = str(n["_id"])
        for k, v in n.items():
            if hasattr(v, "isoformat"):
                n[k] = v.isoformat()

    return {
        "notifications": notifications,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total > 0 else 1,
        "unread_count": await db.notifications.count_documents({"recipient": username, "is_read": False})
    }


@router.get("/unread-count")
async def get_unread_count(
    db=Depends(get_database),
    current_user=Depends(get_current_user)
):
    """Get unread notification count for badge."""
    username = current_user.get("username", "")
    user_role = normalize_role(current_user.get("role", ""))
    count_query = {"recipient": username, "is_read": False}

    if user_role == "siteengineer":
        emp_code = current_user.get("username") or current_user.get("employeeCode", "")
        assigned_projects = await db.projects.find(
            {"$or": [
                {"engineer_id": emp_code},
                {"engineer_id": current_user.get("id", "")},
            ]},
            {"name": 1}
        ).to_list(200)
        assigned_names = [p["name"] for p in assigned_projects if p.get("name")]
        count_query["$or"] = [
            {"project_name": {"$in": [None, "", *assigned_names]}},
            {"project_name": {"$exists": False}},
        ]

    count = await db.notifications.count_documents(count_query)
    return {"unread_count": count}


@router.put("/{notif_id}/read")
async def mark_as_read(
    notif_id: str,
    db=Depends(get_database),
    current_user=Depends(get_current_user)
):
    """Mark a single notification as read."""
    oid = validate_object_id(notif_id, "notification")
    await db.notifications.update_one(
        {"_id": oid, "recipient": current_user.get("username", "")},
        {"$set": {"is_read": True, "read_at": datetime.now()}}
    )
    return {"success": True}


@router.put("/read-all")
async def mark_all_as_read(
    db=Depends(get_database),
    current_user=Depends(get_current_user)
):
    """Mark all notifications as read for current user."""
    username = current_user.get("username", "")
    result = await db.notifications.update_many(
        {"recipient": username, "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now()}}
    )
    return {"success": True, "updated": result.modified_count}


@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: str,
    db=Depends(get_database),
    current_user=Depends(get_current_user)
):
    """Delete a single notification."""
    oid = validate_object_id(notif_id, "notification")
    await db.notifications.delete_one(
        {"_id": oid, "recipient": current_user.get("username", "")}
    )
    return {"success": True}
