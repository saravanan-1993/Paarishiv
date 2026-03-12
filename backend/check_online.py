import asyncio
import os
from database import get_database

async def check():
    import sys
    sys.path.append(os.getcwd())
    from app.api.chat import manager
    print(f"Online users: {list(manager.active_connections.keys())}")

if __name__ == "__main__":
    # This won't work easily because the manager is in a different process
    # But I can check the logs for connect events.
    pass
