from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.utils.auth import authenticate_user, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta
from app.utils.logging import log_activity

from database import get_database

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db = Depends(get_database)):
    """Authenticate user and return JWT access token."""
    print(f"Login attempt for: {form_data.username}")
    user = await authenticate_user(form_data.username, form_data.password, db)
    print(f"Auth result: {'Success' if user else 'Failure'}")
    if not user:
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
