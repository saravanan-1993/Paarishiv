
from fastapi import APIRouter, Depends
from database import get_database
from datetime import datetime

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/")
async def get_logs(limit: int = 200, db = Depends(get_database)):
    logs = await db.activity_log.find({}).sort("timestamp", -1).limit(limit).to_list(limit)
    result = []
    for log in logs:
        # Normalize different log document shapes:
        # Shape 1: created by logging utility → has username, action, details, type
        # Shape 2: created by workflow trigger → has done_by, action_name, project_id
        log_id = str(log["_id"])

        if "action" in log:
            # New-style log from logging utility
            result.append({
                "id": log_id,
                "username": log.get("username", "System"),
                "action": log.get("action", "—"),
                "details": log.get("details", ""),
                "type": log.get("type", "info"),
                "timestamp": log.get("timestamp"),
            })
        else:
            # Legacy workflow activity_log format
            done_by = log.get("done_by", "System")
            # Extract username from "Name (Role)" format
            username = done_by.split("(")[0].strip() if "(" in done_by else done_by
            action_name = log.get("action_name", "Workflow Update")
            project_id = log.get("project_id", "")
            prev = log.get("previous_status", "")
            curr = log.get("updated_status", "")
            result.append({
                "id": log_id,
                "username": username,
                "action": action_name,
                "details": f"Status: {prev} → {curr} | Project ID: {project_id[:8]}..." if project_id else f"Status: {prev} → {curr}",
                "type": "success" if curr == "Completed" else "info",
                "timestamp": log.get("timestamp"),
            })

    return result

@router.delete("/clear")
async def clear_logs(db = Depends(get_database)):
    await db.activity_log.delete_many({})
    return {"message": "Logs cleared"}
