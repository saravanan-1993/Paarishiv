from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.utils.auth import authenticate_user, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta
from app.utils.logging import log_activity
import os

from database import get_database

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db = Depends(get_database)):
    """Authenticate user and return JWT access token."""
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        # Check if user exists but is inactive for a specific error message
        if db is not None:
            inactive_user = await db.employees.find_one({
                "$or": [
                    {"email": form_data.username},
                    {"employeeCode": form_data.username},
                    {"username": form_data.username}
                ],
                "status": {"$ne": "Active"}
            })
            if inactive_user:
                await log_activity(db, "unknown", form_data.username, "Login Blocked", f"Inactive user {form_data.username} attempted login", "warning")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account is inactive. Please contact the administrator.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        await log_activity(db, "unknown", form_data.username, "Login Attempt", f"Failed login attempt for user: {form_data.username}", "warning")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    await log_activity(db, str(user.get("_id", user["username"])), user["username"], "Login Success", f"User {user['username']} logged in successfully", "success")
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "full_name": user["full_name"],
            "id": str(user.get("_id")) if user.get("_id") else user["username"],
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "name": user["full_name"],
            "id": user.get("_id") or user["username"],
            "employeeCode": user.get("employeeCode") or user["username"]
        },
    }

class QuickLoginRequest(BaseModel):
    role: str

@router.post("/quick-login")
async def quick_login(req: QuickLoginRequest, db = Depends(get_database)):
    """Quick login by role - only available in DEBUG mode."""
    if not os.getenv("DEBUG", "").lower() in ("true", "1", "yes"):
        raise HTTPException(status_code=403, detail="Quick login is disabled in production")

    # Find first active employee with the requested role
    db_user = await db.employees.find_one({
        "roles": req.role,
        "status": "Active"
    })

    # Fallback: for Administrator role, check user_profiles if no employee found
    if not db_user and req.role == "Administrator":
        profile = await db.user_profiles.find_one({"designation": {"$in": ["Super Admin", "Administrator", "Admin"]}})
        if profile:
            db_user = {
                "_id": profile["_id"],
                "employeeCode": profile.get("username", "admin"),
                "fullName": profile.get("fullName", "Administrator"),
                "roles": ["Administrator"],
                "status": "Active"
            }

    if not db_user:
        raise HTTPException(status_code=404, detail=f"No active employee found with role '{req.role}'")

    username = db_user.get("employeeCode") or db_user.get("username", "unknown")
    full_name = db_user.get("fullName", "Unknown")
    role = req.role

    await log_activity(db, str(db_user["_id"]), username, "Quick Login", f"Quick login as {role}", "info")

    access_token = create_access_token(
        data={
            "sub": username,
            "role": role,
            "full_name": full_name,
            "id": str(db_user["_id"]),
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": username,
            "role": role,
            "name": full_name,
            "id": str(db_user["_id"]),
            "employeeCode": username
        },
    }

@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return {
        "username": current_user["username"],
        "role": current_user["role"],
        "name": current_user["full_name"],
        "id": current_user.get("_id") or current_user["username"],
        "employeeCode": current_user.get("employeeCode") or current_user["username"]
    }
