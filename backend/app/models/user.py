from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from bson import ObjectId


class RoleName(str, Enum):
    SUPER_ADMIN   = "Super Admin"
    SITE_ENGINEER = "Site Engineer"
    ACCOUNTANT    = "Accountant"
    HR_MANAGER    = "HR Manager"


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    roles: List[RoleName] = [RoleName.SITE_ENGINEER]
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserInDB(UserBase):
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)


class UserResponse(UserBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
    }
