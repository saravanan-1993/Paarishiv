from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os
import bcrypt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Hardcoded demo users — replace with DB lookup in production
DEMO_USERS = {
    "admin": {
        "username": "admin",
        "full_name": "Super Admin",
        "role": "Super Admin",
        "hashed_password": "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2",  # password
    },
    "engineer": {
        "username": "engineer",
        "full_name": "Site Engineer",
        "role": "Site Engineer",
        "hashed_password": "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2",  # password
    },
    "coordinator": {
        "username": "coordinator",
        "full_name": "Project Coordinator",
        "role": "Project Coordinator",
        "hashed_password": "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2",  # password
    },
    "purchase": {
        "username": "purchase",
        "full_name": "Purchase Officer",
        "role": "Purchase Officer",
        "hashed_password": "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2",  # password
    },
    "accountant": {
        "username": "accountant",
        "full_name": "Chief Accountant",
        "role": "Accountant",
        "hashed_password": "$2b$12$i/eiSS/vJMzy9S/Pp.2EuuwT7lyNjoZeiHLPAJPDnHYorGqatcRV2",  # password
    },
}

def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Bcrypt verification error: {e}")
        return False

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def authenticate_user(username: str, password: str, db = None):
    """Verify credentials against demo users and DB"""
    # 1. Check hardcoded demo users
    user = DEMO_USERS.get(username.lower())
    if user and verify_password(password, user["hashed_password"]):
        return user
        
    # 2. Check DB (Employees collection)
    if db is not None:
        db_user = await db.employees.find_one({
            "$or": [
                {"email": username},
                {"employeeCode": username},
                {"username": username}
            ]
        })
        if db_user:
            # For simplicity, if no hashed_password in employee, check plain password field
            # In real app, all passwords should be hashed
            stored_password = db_user.get("password")
            if stored_password == password:
                return {
                    "username": db_user.get("employeeCode"),
                    "full_name": db_user.get("fullName"),
                    "role": db_user.get("roles", ["Site Engineer"])[0] if db_user.get("roles") else "Site Engineer",
                    "_id": str(db_user["_id"])
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

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(lambda: None)):
    """Decode JWT and return the current user dict"""
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
        
    # Check demo users first
    user = DEMO_USERS.get(username)
    if user:
        return user
        
    # If using dependency injection with DB
    try:
        # Note: Depending on how your architecture is, you might need a different way to get DB here
        # For now, let's assume we can fetch from employees if not in DEMO_USERS
        pass 
    except:
        pass

    return {"username": username, "role": payload.get("role"), "full_name": payload.get("full_name")}
