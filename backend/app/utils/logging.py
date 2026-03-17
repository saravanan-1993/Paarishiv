
from datetime import datetime
from database import get_database

async def log_activity(db, user_id: str, username: str, action: str, details: str, type: str = "info"):
    """
    Log a system activity to the activity_log collection.
    types: info, success, warning, danger
    """
    log_entry = {
        "user_id": user_id,
        "username": username,
        "action": action,
        "details": details,
        "type": type,
        "timestamp": datetime.now().isoformat()
    }
    await db.activity_log.insert_one(log_entry)
