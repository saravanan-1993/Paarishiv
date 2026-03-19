import asyncio
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile, Query
from typing import List, Optional, Dict
import json
from datetime import datetime
from database import get_database
from app.utils.auth import get_current_user, SECRET_KEY, ALGORITHM
from app.models.chat import MessageCreate, MessageResponse, ChatUser, MessageBase, ChatGroup
from bson import ObjectId
from app.utils.cloudinary import upload_file
from app.utils.sanitize import sanitize_string
from jose import JWTError, jwt

router = APIRouter(prefix="/chat", tags=["chat"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

def is_office_role(role: str) -> bool:
    """Check if the role is allowed to join group chats (office employees)"""
    if not role: return False
    role_lower = role.lower()
    excluded_roles = ["driver", "labourer", "laborer", "labour", "contractor"]
    return not any(excluded in role_lower for excluded in excluded_roles)


async def send_system_message(sender: str, receiver: str, content: str, msg_type: str = "system", attachments: list = None):
    db = await get_database()
    new_message = {
        "sender": sender,
        "receiver": receiver,
        "content": content,
        "timestamp": datetime.now(),
        "is_read": False,
        "message_type": msg_type,
        "attachments": attachments or []
    }
    inserted = await db.chat_messages.insert_one(new_message)
    new_message["_id"] = str(inserted.inserted_id)
    
    # Send if recipient online
    if receiver in manager.active_connections:
        await manager.send_personal_message(json.dumps(new_message, default=str), receiver)
    return new_message

# C4 Fix: Auth on all chat routes
@router.get("/notifications/{user_id}", dependencies=[Depends(get_current_user)])
async def get_notifications(user_id: str, db = Depends(get_database)):
    # Simple count of unread messages
    # 1. Count unread direct messages
    direct_count = await db.chat_messages.count_documents({"receiver": user_id, "is_read": False})
    
    # 2. Count unread group messages
    group_count = 0
    # Get all groups the user is in
    user_groups = await db.chat_groups.find({"members": user_id}).to_list(length=100)
    for group in user_groups:
        group_id = str(group["_id"])
        # Get last read time for this group
        read_status = await db.chat_group_read.find_one({"user_id": user_id, "group_id": group_id})
        last_read = read_status["last_read"] if read_status else datetime(2020, 1, 1)
        
        # Count messages in this group after last_read, NOT sent by user
        g_count = await db.chat_messages.count_documents({
            "group_id": group_id,
            "timestamp": {"$gt": last_read},
            "sender": {"$ne": user_id}
        })
        group_count += g_count
        
    return {"unread_count": direct_count + group_count}

@router.post("/mark-read/{user_id}/{sender_id}", dependencies=[Depends(get_current_user)])
async def mark_as_read(user_id: str, sender_id: str, group_id: Optional[str] = None, db = Depends(get_database)):
    if group_id:
        # For groups, we track the last time this user read this group
        await db.chat_group_read.update_one(
            {"user_id": user_id, "group_id": group_id},
            {"$set": {"last_read": datetime.now()}},
            upsert=True
        )
    else:
        await db.chat_messages.update_many(
            {"receiver": user_id, "sender": sender_id, "is_read": False},
            {"$set": {"is_read": True}}
        )
    return {"success": True}

@router.get("/groups/{username}", response_model=List[ChatGroup], dependencies=[Depends(get_current_user)])
async def get_user_groups(username: str, db = Depends(get_database)):
    cursor = db.chat_groups.find({"members": username})
    groups = await cursor.to_list(length=100)
    for g in groups:
        g_id = str(g["_id"])
        g["_id"] = g_id
        
        # Calculate unread count for group
        read_status = await db.chat_group_read.find_one({"user_id": username, "group_id": g_id})
        last_read = read_status["last_read"] if read_status else datetime(2020, 1, 1)
        
        unread = await db.chat_messages.count_documents({
            "group_id": g_id,
            "timestamp": {"$gt": last_read},
            "sender": {"$ne": username}
        })
        g["unread_count"] = unread
        
    return groups

@router.post("/groups", response_model=ChatGroup, dependencies=[Depends(get_current_user)])
async def create_group(group: ChatGroup, db = Depends(get_database)):
    group_dict = group.dict(exclude={"id"})
    
    # Filter members to only include office roles (optional, as per requirement)
    # But usually, it's safer to check their roles here.
    
    result = await db.chat_groups.insert_one(group_dict)
    group_dict["_id"] = str(result.inserted_id)
    
    # Send a system message to all group members
    for member in group_dict["members"]:
        await send_system_message(
            sender="System",
            receiver=member,
            content=f"You have been added to group: {group_dict['name']}",
            msg_type="group_invite"
        )
        
    return group_dict


@router.post("/upload", dependencies=[Depends(get_current_user)])
async def upload_chat_file(file: UploadFile = File(...)):
    # Read file content
    content = await file.read()
    # Upload to Cloudinary (or local if not configured)
    result = await upload_file(content, filename=file.filename)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload to Cloudinary")
    
    return {
        "name": file.filename,
        "url": result["url"],
        "type": "image" if result["type"] == "image" else "file"
    }

# C5 Fix: WebSocket authentication via JWT token in query param
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: Optional[str] = Query(None)):
    # Validate JWT token before accepting connection
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            token_user = payload.get("sub")
            if token_user != user_id:
                await websocket.close(code=4003, reason="User ID mismatch")
                return
        except JWTError:
            await websocket.close(code=4001, reason="Invalid token")
            return

    await manager.connect(user_id, websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Save message to DB
                db = await get_database()
                is_group_msg = "group_id" in message_data and message_data["group_id"]
                
                # Get sender info for sender_name
                sender_info = await db.employees.find_one({"employeeCode": user_id})
                sender_name = sender_info.get("fullName") if sender_info else user_id
                if not sender_info:
                    # Check demo users
                    from app.utils.auth import DEMO_USERS
                    demo = DEMO_USERS.get(user_id)
                    if demo: sender_name = demo["full_name"]

                # C12 Fix: Sanitize chat message content
                new_message = {
                    "sender": user_id,
                    "sender_name": sender_name,
                    "content": sanitize_string(message_data.get("content", "")),
                    "timestamp": datetime.now(),
                    "is_read": False,
                    "group_id": message_data.get("group_id"),
                    "receiver": message_data.get("receiver")
                }
                inserted = await db.chat_messages.insert_one(new_message)
                new_message["_id"] = str(inserted.inserted_id)
                new_message_str = json.dumps(new_message, default=str)

                if is_group_msg:
                    group_id = message_data["group_id"]
                    group = await db.chat_groups.find_one({"_id": ObjectId(group_id)})
                    if group:
                        for member in group["members"]:
                            # Broadcast to all online members of the group
                            if member in manager.active_connections:
                                try:
                                    await manager.send_personal_message(new_message_str, member)
                                except Exception as e:
                                    print(f"Failed to send to group member {member}: {e}")
                else:
                    # Direct message
                    recipient_id = message_data["receiver"]
                    if recipient_id in manager.active_connections:
                        try:
                            await manager.send_personal_message(new_message_str, recipient_id)
                        except Exception as e:
                            print(f"Failed to send to receiver {recipient_id}: {e}")
                    
                    # Echo back to sender if not already sent (though broadcast logic usually covers it)
                    if user_id in manager.active_connections:
                        try:
                            await manager.send_personal_message(new_message_str, user_id)
                        except Exception as e:
                            print(f"Failed to echo to sender {user_id}: {e}")


            except WebSocketDisconnect:
                # Normal disconnect
                break
            except Exception as e:
                print(f"Error processing message: {e}")
                if "receive" in str(e).lower() or "disconnect" in str(e).lower():
                    break
                await asyncio.sleep(0.5)
                continue
            
    finally:
        manager.disconnect(user_id)

@router.get("/history/{user1}/{user2}", response_model=List[MessageResponse], dependencies=[Depends(get_current_user)])
async def get_chat_history(user1: str, user2: str, db = Depends(get_database)):
    query = {
        "$or": [
            {"sender": user1, "receiver": user2, "group_id": None},
            {"sender": user2, "receiver": user1, "group_id": None}
        ]
    }
    cursor = db.chat_messages.find(query).sort("timestamp", 1)
    messages = await cursor.to_list(length=500)
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    return messages

@router.get("/history/group/{group_id}", response_model=List[MessageResponse], dependencies=[Depends(get_current_user)])
async def get_group_history(group_id: str, db = Depends(get_database)):
    cursor = db.chat_messages.find({"group_id": group_id}).sort("timestamp", 1)
    messages = await cursor.to_list(length=500)
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    return messages


@router.get("/users", response_model=List[ChatUser], dependencies=[Depends(get_current_user)])
async def get_chat_users(db = Depends(get_database)):
    # Bug 10.1 - Fetch ALL active employees (increased limit)
    employees = await db.employees.find({"status": "Active"}).to_list(length=5000)

    chat_users = []
    seen_usernames = set()

    # Add all demo users
    from app.utils.auth import DEMO_USERS
    for uname, user in DEMO_USERS.items():
        chat_users.append(ChatUser(
            username=user["username"],
            full_name=user["full_name"],
            role=user["role"],
            is_online=user["username"] in manager.active_connections,
            unread_count=0
        ))
        seen_usernames.add(user["username"])

    for emp in employees:
        username = emp.get("employeeCode") or emp.get("username")
        if username and username not in seen_usernames:
            chat_users.append(ChatUser(
                username=username,
                full_name=emp.get("fullName") or emp.get("name") or username,
                role=emp.get("roles", ["Staff"])[0] if emp.get("roles") else "Staff",
                is_online=username in manager.active_connections,
                unread_count=0
            ))
            seen_usernames.add(username)

    return chat_users

@router.get("/users/{current_user}", response_model=List[ChatUser], dependencies=[Depends(get_current_user)])
async def get_chat_users_with_unread(current_user: str, db = Depends(get_database)):
    # 1. Get base users (employees + demo)
    users = await get_chat_users(db)
    
    # 2. Find any other unique senders who sent messages to current_user
    # (This ensures "System" or any other non-employee sender shows up)
    all_senders = await db.chat_messages.distinct("sender", {"receiver": current_user})
    
    existing_usernames = {u.username for u in users}
    for sender in all_senders:
        if sender not in existing_usernames:
            users.append(ChatUser(
                username=sender,
                full_name=sender.capitalize(),
                role="System" if sender == "System" else "User",
                is_online=sender in manager.active_connections,
                unread_count=0
            ))
    
    # 3. Calculate unread counts
    for user in users:
        unread = await db.chat_messages.count_documents({
            "receiver": current_user, 
            "sender": user.username,
            "group_id": None,
            "is_read": False
        })
        user.unread_count = unread
        
    return users

