import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("DATABASE_NAME", "civil_erp")]

    # 1. Seed roles
    roles_doc = {
        "_id": "global_roles",
        "roles": [
            {"name": "Administrator", "permissions": [
                {"name": "Projects", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "HRMS", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Inventory", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Accounts", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Procurement", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Fleet Management", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "User Management", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Settings", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Reports", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Chat", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Approvals", "actions": {"view": True, "edit": True, "delete": True}},
            ]},
            {"name": "Site Engineer", "permissions": [
                {"name": "Projects", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "HRMS", "actions": {"view": True, "edit": False, "delete": False}},
                {"name": "Inventory", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "Chat", "actions": {"view": True, "edit": True, "delete": False}},
            ]},
            {"name": "Project Coordinator", "permissions": [
                {"name": "Projects", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "HRMS", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "Inventory", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "Approvals", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "Chat", "actions": {"view": True, "edit": True, "delete": False}},
            ]},
            {"name": "Purchase Officer", "permissions": [
                {"name": "Procurement", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Inventory", "actions": {"view": True, "edit": True, "delete": False}},
                {"name": "Chat", "actions": {"view": True, "edit": True, "delete": False}},
            ]},
            {"name": "Accountant", "permissions": [
                {"name": "Accounts", "actions": {"view": True, "edit": True, "delete": True}},
                {"name": "Procurement", "actions": {"view": True, "edit": False, "delete": False}},
                {"name": "Chat", "actions": {"view": True, "edit": True, "delete": False}},
            ]},
        ]
    }
    await db.roles.delete_many({})
    await db.roles.insert_one(roles_doc)
    print("Roles seeded")

    # 2. Seed demo employees
    demo_users = [
        {"employeeCode": "ADMIN001", "fullName": "Super Admin", "email": "admin@paari.com",
         "password": hash_pw("admin@123"), "roles": ["Administrator"],
         "designation": "Administrator", "department": "Management",
         "phone": "9999999999", "status": "Active", "joiningDate": "2024-01-01",
         "basicSalary": 50000, "hra": 5000, "salaryType": "monthly", "dailyWage": 0, "dob": "1990-01-01"},
        {"employeeCode": "SE001", "fullName": "Ravi Kumar", "email": "ravi@paari.com",
         "password": hash_pw("site@123"), "roles": ["Site Engineer"],
         "designation": "Site Engineer", "department": "Engineering",
         "phone": "9888888881", "status": "Active", "joiningDate": "2024-03-01",
         "basicSalary": 35000, "hra": 3000, "salaryType": "monthly", "dailyWage": 0, "dob": "1995-05-15"},
        {"employeeCode": "PC001", "fullName": "Priya Sharma", "email": "priya@paari.com",
         "password": hash_pw("coord@123"), "roles": ["Project Coordinator"],
         "designation": "Project Coordinator", "department": "Projects",
         "phone": "9888888882", "status": "Active", "joiningDate": "2024-02-01",
         "basicSalary": 40000, "hra": 4000, "salaryType": "monthly", "dailyWage": 0, "dob": "1992-08-20"},
        {"employeeCode": "PO001", "fullName": "Karthik Raj", "email": "karthik@paari.com",
         "password": hash_pw("purchase@123"), "roles": ["Purchase Officer"],
         "designation": "Purchase Officer", "department": "Procurement",
         "phone": "9888888883", "status": "Active", "joiningDate": "2024-04-01",
         "basicSalary": 30000, "hra": 3000, "salaryType": "monthly", "dailyWage": 0, "dob": "1993-12-10"},
        {"employeeCode": "AC001", "fullName": "Meena Devi", "email": "meena@paari.com",
         "password": hash_pw("accounts@123"), "roles": ["Accountant"],
         "designation": "Accountant", "department": "Finance",
         "phone": "9888888884", "status": "Active", "joiningDate": "2024-05-01",
         "basicSalary": 32000, "hra": 3000, "salaryType": "monthly", "dailyWage": 0, "dob": "1994-03-25"},
    ]

    await db.employees.delete_many({})
    for u in demo_users:
        u["created_at"] = datetime.now()
        await db.employees.insert_one(u)
        print(f"  Created: {u['employeeCode']} ({u['roles'][0]})")

    # 3. Seed counter
    await db.counters.delete_many({})
    await db.counters.insert_one({"_id": "employee_code", "seq": 5})
    print("Counter seeded (seq=5)")

    print()
    print("=== Demo Accounts Ready ===")
    print("Administrator:       ADMIN001 / admin@123")
    print("Site Engineer:       SE001    / site@123")
    print("Project Coordinator: PC001    / coord@123")
    print("Purchase Officer:    PO001    / purchase@123")
    print("Accountant:          AC001    / accounts@123")

    client.close()

asyncio.run(seed())
