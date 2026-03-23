from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class MessageBase(BaseModel):
    sender: str  # username or employeeCode
    receiver: Optional[str] = None # username or employeeCode for direct messages
    group_id: Optional[str] = None # for group messages
    content: str
    attachments: Optional[List[dict]] = [] # [{"name": "file.jpg", "url": "...", "type": "image"}]
    timestamp: datetime = Field(default_factory=datetime.now)
    is_read: bool = False
    message_type: str = "text" # text, system, task_update

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: Optional[str] = Field(default=None, alias="_id")
    sender_name: Optional[str] = None # To display sender's full name in groups

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
    }

class ChatGroup(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    members: List[str] # list of usernames
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
    }

class ChatUser(BaseModel):
    username: str
    full_name: str
    role: str
    is_online: bool = False
    unread_count: int = 0 # Added to track unread messages per sender
