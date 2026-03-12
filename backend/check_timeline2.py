import asyncio
from database import db
from app.api.workflow import get_project_timeline

async def main():
    proj = await db.projects.find_one({"name": {"$regex": "Agrini", "$options": "i"}})
    if not proj:
        print("Project not found")
        return
        
    print(f"Project ID: {proj['_id']}")
    
    # Check the timeline function
    tls = await get_project_timeline(str(proj['_id']), db)
    print("Timeline count for Agrini:", len(tls))
    
    lines = []
    for t in tls:
        if t['status'] != 'Pending':
            lines.append(f" - {t['stage_name']} : {t['status']}")
            
    print("Non-pending stages:")
    for l in lines: print(l)
        
    pos = await db.purchase_orders.find({"project_name": proj["name"]}).to_list(10)
    print(f"POs: {len(pos)}")
    for p in pos:
        print(f" - PO vendor: {p['vendor_name']}, Status: {p['status']}")


asyncio.run(main())
