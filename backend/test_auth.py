import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Mocking dependencies
import sys
sys.path.append(os.getcwd())

from app.utils.auth import authenticate_user

async def test_auth():
    print("Testing admin password...")
    try:
        user = await authenticate_user("admin", "password")
        print(f"Auth result: {user}")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_auth())
