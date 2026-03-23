import asyncio
import motor.motor_asyncio
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb+srv://admin:z9EQ50SnM0yzv3On@cluster0.lvnxfa7.mongodb.net/civil-erp?tls=true&tlsAllowInvalidCertificates=true')
    db = client['civil_erp']
    
    await db.users.update_one(
        {'username': 'coordinator'},
        {'$set': {'password': pwd_context.hash('password'), 'role': 'Project Coordinator', 'full_name': 'Project Coordinator'}},
        upsert=True
    )
    
    await db.users.update_one(
        {'username': 'accountant'},
        {'$set': {'password': pwd_context.hash('password'), 'role': 'Accountant', 'full_name': 'Accountant'}},
        upsert=True
    )
    
    print('Users created successfully!')

if __name__ == '__main__':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
