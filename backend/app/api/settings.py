from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from database import get_database
from typing import Any, Dict
import shutil
import os
from datetime import datetime
from app.utils.cloudinary import upload_file
from app.utils.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

# ── User Profile ─────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    username = current_user.get("username")
    profile = await db.user_profiles.find_one({"username": username})
    if not profile:
        # Return defaults from the auth token
        return {
            "username": username,
            "fullName": current_user.get("full_name") or current_user.get("name") or username,
            "email": "",
            "phone": "",
            "designation": current_user.get("role", ""),
            "avatar": ""
        }
    profile["id"] = str(profile["_id"])
    del profile["_id"]
    return profile

@router.post("/profile")
async def update_profile(data: Dict[Any, Any], current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    username = current_user.get("username")
    if "id" in data: del data["id"]
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

@router.post("/company")
async def update_company_settings(data: Dict[Any, Any], db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "company_profile"
    await db.settings.update_one(
        {"type": "company_profile"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

@router.get("/cloudinary")
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
    return settings

@router.post("/cloudinary")
async def update_cloudinary_settings(data: Dict[Any, Any], db = Depends(get_database)):
    if "id" in data: del data["id"]
    data["type"] = "cloudinary_config"
    await db.settings.update_one(
        {"type": "cloudinary_config"},
        {"$set": data},
        upsert=True
    )
    return {"success": True}

@router.get("/smtp")
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
    return settings

@router.post("/smtp")
async def update_smtp_settings(data: Dict[Any, Any], db = Depends(get_database)):
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

@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    # Read file content
    content = await file.read()
    # Upload to Cloudinary
    result = await upload_file(content, filename=file.filename)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload logo. Please check Cloudinary credentials in Vercel Environment Variables.")
        
    return {"url": result["url"]}
