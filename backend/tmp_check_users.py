import asyncio
import motor.motor_asyncio
import pprint

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb+srv://admin:z9EQ50SnM0yzv3On@cluster0.lvnxfa7.mongodb.net/civil-erp?tls=true&tlsAllowInvalidCertificates=true')
    db = client['civil_erp']
    users = await db.users.find().to_list(100)
    for u in users:
        print(f"User: {u.get('username')}, Role: {u.get('role')}")

if __name__ == '__main__':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
