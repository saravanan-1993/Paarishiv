from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# SECRET_KEY must be consistent across all serverless instances
SECRET_KEY = os.getenv("SECRET_KEY", "construction-erp-super-secret-key-2024")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Bug 3.5 - Demo users removed. All authentication is now DB-only.
DEMO_USERS = {}

def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# C9 Fix: Helper to validate ObjectId and return 400 on invalid format
def validate_object_id(id_str: str, label: str = "ID") -> "ObjectId":
    """Validate and convert string to ObjectId, raising HTTPException on invalid format."""
    from bson import ObjectId
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} format: {id_str}"
        )

async def authenticate_user(username: str, password: str, db = None):
    """Verify credentials against DB employees collection"""
    if db is None:
        return None

    db_user = await db.employees.find_one({
        "$or": [
            {"email": {"$regex": f"^{username}$", "$options": "i"}},
            {"employeeCode": {"$regex": f"^{username}$", "$options": "i"}},
            {"username": {"$regex": f"^{username}$", "$options": "i"}}
        ]
    })
    if not db_user:
        return None

    # Check if user is active - block inactive users from logging in
    if db_user.get("status", "Active").lower() != "active":
        return None

    hashed_pw = db_user.get("hashed_password")

    # C3 Fix: Only check hashed passwords. If user has plaintext, auto-migrate it.
    password_valid = False
    if hashed_pw:
        password_valid = verify_password(password, hashed_pw)
    else:
        stored_password = db_user.get("password")
        if stored_password and stored_password == password:
            password_valid = True
            # Auto-migrate: hash the plaintext password
            new_hash = get_password_hash(password)
            await db.employees.update_one(
                {"_id": db_user["_id"]},
                {"$set": {"hashed_password": new_hash}, "$unset": {"password": ""}}
            )

    if password_valid:
        return {
            "username": db_user.get("employeeCode"),
            "full_name": db_user.get("fullName"),
            "role": db_user.get("roles", ["Site Engineer"])[0] if db_user.get("roles") else "Site Engineer",
            "_id": str(db_user["_id"]),
            "status": db_user.get("status", "Active")
        }

    return None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(lambda: __import__('database').db)):
    """C2 Fix: Decode JWT and validate user against database"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # C2+C18 Fix: Validate user exists and is active in database
    if db is not None:
        try:
            db_user = await db.employees.find_one({
                "$or": [
                    {"employeeCode": username},
                    {"username": username}
                ]
            })
            if db_user:
                # Block inactive/deleted users even if token is valid
                if db_user.get("status", "Active").lower() != "active":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your account has been deactivated"
                    )
                return {
                    "username": db_user.get("employeeCode") or username,
                    "role": db_user.get("roles", ["Site Engineer"])[0] if db_user.get("roles") else payload.get("role"),
                    "full_name": db_user.get("fullName") or payload.get("full_name"),
                    "_id": str(db_user["_id"]),
                    "id": str(db_user["_id"])
                }
        except HTTPException:
            raise
        except Exception:
            pass

    # Fallback to JWT payload if DB unavailable
    return {
        "username": username,
        "role": payload.get("role"),
        "full_name": payload.get("full_name"),
        "id": payload.get("id", username)
    }
