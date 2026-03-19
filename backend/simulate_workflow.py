import asyncio
from datetime import datetime
from database import db
from bson import ObjectId
from app.api.workflow import initialize_project_workflow, trigger_workflow_event

async def simulate():
    print("Starting simulation...")
    user_admin = {"username": "admin", "role": "Administrator", "fullName": "Super Admin"}
    user_engineer = {"username": "engineer1", "role": "Site Engineer", "fullName": "John Eng"}
    user_po = {"username": "po1", "role": "Purchase Officer", "fullName": "Mike PO"}
    user_vendor = {"username": "vendor1", "role": "Vendor", "fullName": "Supplier Co."}
    user_inventory = {"username": "inv1", "role": "Inventory Manager", "fullName": "Sarah Inv"}
    user_accountant = {"username": "acc1", "role": "Accountant", "fullName": "Tom Acc"}

    # 1. Create Project
    project_name = "Project Simulation " + datetime.now().strftime("%H%M%S")
    project_dict = {
        "name": project_name,
        "client": "Demo Client Ltd",
        "location": "Chennai Demo Site",
        "budget": 5000000,
        "spent": 0,
        "status": "Ongoing",
        "engineer_id": "engineer1",
        "start_date": datetime.now().isoformat(),
        "end_date": datetime.now().isoformat(),
        "tasks": [],
        "dprs": [],
        "documents": [],
        "created_at": datetime.now().isoformat()
    }
    
    res = await db.projects.insert_one(project_dict)
    pid = str(res.inserted_id)
    print(f"Created project: {pid} - {project_name}")

    await initialize_project_workflow(pid, db)
    await trigger_workflow_event(pid, "project_created", user_admin, db, "Simulated Project created")
    await asyncio.sleep(1)

    # 2. Site Engineer Assigned
    await trigger_workflow_event(pid, "engineer_assigned", user_admin, db, "Assigned: engineer1")
    await asyncio.sleep(1)

    # 3. DPR Submitted
    dpr_id = f"DPR-{datetime.now().strftime('%y%m%d%H%M%S')}"
    dpr_dict = {
        "id": dpr_id,
        "date": datetime.now().strftime("%d %b %Y"),
        "status": "Pending",
        "created_at": datetime.now().isoformat(),
        "notes": "Simulated DPR"
    }
    await db.projects.update_one({"_id": ObjectId(pid)}, {"$push": {"dprs": dpr_dict}})
    await trigger_workflow_event(pid, "dpr_submitted", user_engineer, db, f"DPR {dpr_id} attached")
    await asyncio.sleep(1)

    # 4. DPR Verified
    await db.projects.update_one({"_id": ObjectId(pid), "dprs.id": dpr_id}, {"$set": {"dprs.$.status": "Verified"}})
    await trigger_workflow_event(pid, "dpr_verified", user_admin, db, f"DPR {dpr_id} verified")
    await asyncio.sleep(1)

    # 5. Material Consolidated
    req_dict = {
        "project_id": pid,
        "project_name": project_name,
        "status": "Pending",
        "requested_items": [{"name": "Cement", "quantity": 100, "unit": "Bags"}],
        "created_at": datetime.now()
    }
    res_req = await db.material_requests.insert_one(req_dict)
    await trigger_workflow_event(pid, "material_consolidated", user_engineer, db, "Material Request created")
    await asyncio.sleep(1)

    # 6. Request Approved / Sent to PO
    await db.material_requests.update_one({"_id": res_req.inserted_id}, {"$set": {"status": "Approved"}})
    await trigger_workflow_event(pid, "sent_to_po", user_admin, db, f"Material Request Approved")
    await asyncio.sleep(1)

    # 7. PO Created
    po_dict = {
        "vendor_name": "UltraTech Cement",
        "project_name": project_name,
        "status": "Pending",
        "request_id": str(res_req.inserted_id),
        "items": [{"name": "Cement", "qty": 100, "unit": "Bags", "rate": 350}],
        "total_amount": 35000,
        "created_at": datetime.now()
    }
    res_po = await db.purchase_orders.insert_one(po_dict)
    await trigger_workflow_event(pid, "po_created", user_po, db, "PO generated for UltraTech Cement")
    await asyncio.sleep(1)

    # 8. Vendor Dispatched
    await db.purchase_orders.update_one({"_id": res_po.inserted_id}, {"$set": {"status": "Dispatched"}})
    await trigger_workflow_event(pid, "vendor_dispatched", user_vendor, db, "Materials dispatched by vendor")
    await asyncio.sleep(1)

    # 9. GRN Updated
    grn_dict = {
        "po_id": str(res_po.inserted_id),
        "status": "Received",
        "receipt_type": "Final",
        "items": [{"name": "Cement", "po_qty": 100, "unit": "Bags", "received_qty": 100, "rejected_qty": 0}],
        "created_at": datetime.now()
    }
    res_grn = await db.grns.insert_one(grn_dict)
    await db.purchase_orders.update_one({"_id": res_po.inserted_id}, {"$set": {"status": "Closed"}})
    await trigger_workflow_event(pid, "grn_updated", user_inventory, db, f"GRN recorded")
    await asyncio.sleep(1)

    # 10. Accounts Entry
    bill_dict = {
        "grn_id": str(res_grn.inserted_id),
        "project_name": project_name,
        "vendor_name": "UltraTech Cement",
        "total_amount": 35000,
        "bill_no": f"INV-{datetime.now().strftime('%y%m%d%M%S')}",
        "status": "Unpaid",
        "created_at": datetime.now(),
        "bill_date": datetime.now().isoformat(),
        "items": [{"name": "Cement", "qty": 100, "unit": "Bags", "rate": 350, "gst": 18, "amount": 35000}]
    }
    res_bill = await db.purchase_bills.insert_one(bill_dict)
    await db.projects.update_one({"_id": ObjectId(pid)}, {"$inc": {"spent": 35000}})
    await trigger_workflow_event(pid, "accounts_entry", user_accountant, db, f"Purchase Bill entered")
    await asyncio.sleep(1)

    # 11. Vendor Payment Settled
    exp_dict = {
        "category": "Material Purchase",
        "amount": 35000,
        "project": project_name,
        "grn_id": str(res_grn.inserted_id),
        "created_at": datetime.now()
    }
    await db.expenses.insert_one(exp_dict)
    await db.grns.update_one({"_id": res_grn.inserted_id}, {"$set": {"status": "Paid"}})
    await trigger_workflow_event(pid, "payment_settled", user_accountant, db, f"Payment settled")
    await asyncio.sleep(1)

    # 12. Project Ongoing
    await db.projects.update_one({"_id": ObjectId(pid)}, {"$set": {"status": "Ongoing"}})
    await trigger_workflow_event(pid, "project_ongoing", user_engineer, db, "Project marks as Ongoing")
    
    print(f"Simulation Complete for project '{project_name}'! Stage: Project Ongoing. Check UI now.")

if __name__ == '__main__':
    asyncio.run(simulate())
