from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from database import get_database
from typing import Any, Dict
import shutil
import os
from datetime import datetime
from app.utils.cloudinary import upload_file
from app.utils.auth import get_current_user
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/settings", tags=["settings"])

# ── User Profile ─────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    username = current_user.get("username")
    profile = await db.user_profiles.find_one({"username": username})

    # Bug 1.10 - Also fetch from employee record for correct email/designation
    employee = await db.employees.find_one({
        "$or": [{"employeeCode": username}, {"username": username}]
    })

    if not profile:
        return {
            "username": username,
            "fullName": (employee.get("fullName") if employee else None) or current_user.get("full_name") or current_user.get("name") or username,
            "email": (employee.get("email") if employee else "") or "",
            "phone": (employee.get("phone") if employee else "") or "",
            "designation": (employee.get("designation") if employee else None) or current_user.get("role", ""),
            "avatar": ""
        }

    # Merge employee data into profile for missing fields
    if employee:
        if not profile.get("email"): profile["email"] = employee.get("email", "")
        if not profile.get("phone"): profile["phone"] = employee.get("phone", "")
        if not profile.get("designation"): profile["designation"] = employee.get("designation", "")

    profile["id"] = str(profile["_id"])
    del profile["_id"]
    return profile

@router.post("/profile")
async def update_profile(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    username = current_user.get("username")
    # C8 Fix: Whitelist allowed profile fields instead of blacklisting
    allowed_fields = {"fullName", "email", "phone", "designation", "avatar", "bio"}
    data = {k: v for k, v in data.items() if k in allowed_fields}
    data["username"] = username
    data["updated_at"] = datetime.now().isoformat()
    await db.user_profiles.update_one(
        {"username": username},
        {"$set": data},
        upsert=True
    )
    # Also update the employee record name if it exists
    if data.get("fullName"):
        await db.employees.update_one(
            {"username": username},
            {"$set": {"fullName": data["fullName"]}}
        )
    return {"success": True}

@router.post("/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    content = await file.read()
    result = await upload_file(content, filename=f"avatar_{current_user.get('username')}_{file.filename}")
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload avatar. Check Cloudinary settings.")
    url = result["url"]
    # Save avatar URL to profile
    await db.user_profiles.update_one(
        {"username": current_user.get("username")},
        {"$set": {"avatar": url, "username": current_user.get("username")}},
        upsert=True
    )
    return {"url": url}


@router.get("/company")
async def get_company_settings(db = Depends(get_database)):
    settings = await db.settings.find_one({"type": "company_profile"})
    if not settings:
        return {
            "companyName": "Paari Shiv Homes",
            "gstin": "33AAAAA0000A1Z5",
            "registrationNumber": "PAN: ABCDE1234F",
            "address": "Narasingam Main Rd, Iyyanar Colony, Madurai, Kadachanendhal, Tamil Nadu 625107",
            "contactNumber": "+91 97871 99122",
            "email": "info@paarishivhomes.com",
            "website": "www.paarishivhomes.com",
            "logo": ""
        }
    settings["id"] = str(settings["_id"])
    del settings["_id"]
    return settings

# C4 Fix: Auth required for company settings update
@router.post("/company")
async def update_company_settings(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "company_profile"
    await db.settings.update_one(
        {"type": "company_profile"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

# C4 Fix: Auth required for cloudinary settings
@router.get("/cloudinary", dependencies=[Depends(get_current_user)])
async def get_cloudinary_settings(db = Depends(get_database)):
    settings = await db.settings.find_one({"type": "cloudinary_config"})
    if not settings:
        return {
            "cloudName": "",
            "apiKey": "",
            "apiSecret": ""
        }
    settings["id"] = str(settings["_id"])
    del settings["_id"]
    # C6 Fix: Mask apiSecret in response
    if settings.get("apiSecret"):
        secret = settings["apiSecret"]
        settings["apiSecret"] = secret[:4] + "****" + secret[-4:] if len(secret) > 8 else "****"
    return settings

@router.post("/cloudinary")
async def update_cloudinary_settings(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "cloudinary_config"
    await db.settings.update_one(
        {"type": "cloudinary_config"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

# C4 Fix: Auth required for SMTP settings
@router.get("/smtp", dependencies=[Depends(get_current_user)])
async def get_smtp_settings(db = Depends(get_database)):
    settings = await db.settings.find_one({"type": "smtp_config"})
    if not settings:
        return {
            "host": "smtp.gmail.com",
            "port": "587",
            "username": "",
            "password": "",
            "fromName": "Civil ERP",
            "useTLS": True
        }
    settings["id"] = str(settings["_id"])
    del settings["_id"]
    # C6 Fix: Mask SMTP password in response
    if settings.get("password"):
        settings["password"] = "********"
    return settings

@router.post("/smtp")
async def update_smtp_settings(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "smtp_config"
    # If password is empty (and we already have a password), don't overwrite it
    if not data.get("password"):
        old = await db.settings.find_one({"type": "smtp_config"})
        if old and old.get("password"):
            data["password"] = old["password"]
            
    await db.settings.update_one(
        {"type": "smtp_config"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

@router.post("/smtp/test")
async def test_smtp(data: Dict[Any, Any], current_user: dict = Depends(get_current_user)):
    """Bug 11.9 - Send a test email to verify SMTP configuration"""
    from app.utils.email import send_email
    test_email = data.get("email", "")
    if not test_email:
        raise HTTPException(status_code=400, detail="Email address is required for test")
    result = send_email(
        to_email=test_email,
        subject="Civil ERP - SMTP Test Email",
        body="<h2>SMTP Configuration Working!</h2><p>This is a test email from Civil ERP. Your SMTP settings are configured correctly.</p>",
        is_html=True
    )
    if result:
        return {"success": True, "message": f"Test email sent successfully to {test_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email. Please check SMTP credentials.")

@router.post("/password")
async def change_password(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    """Bug 11.5 - Change user password"""
    from app.utils.auth import verify_password, get_password_hash
    current_pw = data.get("currentPassword", "")
    new_pw = data.get("newPassword", "")
    if not current_pw or not new_pw:
        raise HTTPException(status_code=400, detail="Current and new passwords are required")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    username = current_user.get("username")
    user_id = current_user.get("_id") or current_user.get("id")
    lookup_filters = [{"employeeCode": username}, {"username": username}, {"email": username}]
    if user_id:
        try:
            from bson import ObjectId
            lookup_filters.append({"_id": ObjectId(user_id)})
        except Exception:
            pass
    employee = await db.employees.find_one({"$or": lookup_filters})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # Verify current password
    hashed_pw = employee.get("hashed_password")
    plain_pw = employee.get("password")
    valid = False
    if hashed_pw:
        valid = verify_password(current_pw, hashed_pw)
    elif plain_pw:
        valid = (plain_pw == current_pw)
    if not valid:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update to new hashed password
    new_hash = get_password_hash(new_pw)
    await db.employees.update_one(
        {"_id": employee["_id"]},
        {"$set": {"hashed_password": new_hash}, "$unset": {"password": ""}}
    )
    return {"success": True, "message": "Password updated successfully"}

# C4 Fix: Auth required for logo upload
@router.post("/logo", dependencies=[Depends(get_current_user)])
async def upload_logo(file: UploadFile = File(...)):
    # Read file content
    content = await file.read()
    # Upload to Cloudinary
    result = await upload_file(content, filename=file.filename)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload logo. Please check Cloudinary credentials in Vercel Environment Variables.")
        
    return {"url": result["url"]}
