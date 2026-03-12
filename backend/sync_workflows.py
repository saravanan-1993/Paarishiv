import asyncio
from database import db
from app.api.workflow import initialize_project_workflow, trigger_workflow_event

async def sync():
    user = {"username": "System", "role": "Super Admin"}
    print("Syncing workflows for all projects...")
    
    projects = await db.projects.find().to_list(100)
    for p in projects:
        pid = str(p["_id"])
        print(f"Syncing Project: {p.get('name')}")
        
        # ensure init
        await initialize_project_workflow(pid, db)
        
        # Check Project Status
        if p.get("status") in ["Completed", "Ongoing"]:
            await trigger_workflow_event(pid, "project_created", user, db, "Project synced")
            if p.get("engineer_id"):
                await trigger_workflow_event(pid, "engineer_assigned", user, db, f"Assigned: {p['engineer_id']}")
                
        # Check DPRs
        if p.get("dprs"):
            await trigger_workflow_event(pid, "dpr_submitted", user, db, "DPR found in sync")
            for d in p["dprs"]:
                if d.get("status") in ["Verified", "Approved"]:
                    await trigger_workflow_event(pid, "dpr_verified", user, db, "DPR verification found in sync")
                    break
        
        # Check POs
        pos = await db.purchase_orders.find({"project_name": p.get("name")}).to_list(10)
        if pos:
            await trigger_workflow_event(pid, "material_consolidated", user, db, "Material request inferred from PO")
            await trigger_workflow_event(pid, "sent_to_po", user, db, "Sent to PO inferred")
            await trigger_workflow_event(pid, "po_created", user, db, "PO found in sync")
            
            # Check if any PO is dispatched
            for po in pos:
                if po.get("status") == "Dispatched":
                    await trigger_workflow_event(pid, "vendor_dispatched", user, db, "Dispatched PO found in sync")
                    break
            
        # Check GRNs mapping to those POs
        po_ids = [str(po["_id"]) for po in pos]
        if po_ids:
            grns = await db.grns.find({"po_id": {"$in": po_ids}}).to_list(10)
            if grns:
                await trigger_workflow_event(pid, "vendor_dispatched", user, db, "Vendor dispatched inferred from GRN")
                await trigger_workflow_event(pid, "grn_updated", user, db, "GRN found in sync")
                
                # Check bills
                grn_ids = [str(g["_id"]) for g in grns]
                bills = await db.purchase_bills.find({"grn_id": {"$in": grn_ids}}).to_list(10)
                if bills:
                    await trigger_workflow_event(pid, "accounts_entry", user, db, "Purchase bill found in sync")
                    
                # Check payments
                exps = await db.expenses.find({"category": "Material Purchase", "grn_id": {"$in": grn_ids}}).to_list(10)
                if exps:
                    await trigger_workflow_event(pid, "payment_settled", user, db, "Payment found in sync")
    
    print("Done catching up existing projects!")

if __name__ == "__main__":
    asyncio.run(sync())
