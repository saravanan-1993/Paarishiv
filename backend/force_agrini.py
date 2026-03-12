import asyncio
from database import db
from app.api.workflow import initialize_project_workflow, trigger_workflow_event

async def main():
    proj = await db.projects.find_one({"name": {"$regex": "Agrini", "$options": "i"}})
    if not proj:
        print("Project not found")
        return
        
    pid = str(proj["_id"])
    print(f"Project ID: {pid}")
    
    # 1. Force initialize workflow
    await initialize_project_workflow(pid, db)
    
    user = {"username": "System", "role": "Super Admin"}
    
    # Trigger missing stages manually
    await trigger_workflow_event(pid, "project_created", user, db, "Project synced automatically")
    
    if proj.get("engineer_id"):
        await trigger_workflow_event(pid, "engineer_assigned", user, db, f"Assigned: {proj['engineer_id']}")
        
    pos = await db.purchase_orders.find({"project_name": proj["name"]}).to_list(10)
    if pos:
        print("Triggering PO created...")
        await trigger_workflow_event(pid, "material_consolidated", user, db, "PO found, material consolidated")
        await trigger_workflow_event(pid, "sent_to_po", user, db, "Sent to PO")
        await trigger_workflow_event(pid, "po_created", user, db, "PO found in sync")
        
    print("Done catching up Agrini.")

asyncio.run(main())
