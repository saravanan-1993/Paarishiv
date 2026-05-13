from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys

# Ensure backend directory is in the Python path for Vercel
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.api import auth, projects, materials, labour, finance, vendors, purchase_orders, grns, employees, attendance, chat, fleet, hrms, inventory, surprise_attendance, approvals, roles, workflow, settings, logs, quotations, labour_attendance, notifications, subcontractor_billing

# Ensure static/uploads exists locally
is_vercel = os.environ.get("VERCEL") == "1"
upload_dir = os.path.join(os.getcwd(), "static", "uploads")

app = FastAPI(title="Civil Construction ERP API", docs_url="/api/docs", openapi_url="/api/openapi.json")

if not is_vercel:
    try:
        static_dir = os.path.join(os.getcwd(), "static")
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
        # Mount entire static folder under /static
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
        print(f"Static files mounted from: {static_dir}")
    except Exception as e:
        print(f"Could not setup static files: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(materials.router)
api_router.include_router(labour.router)
api_router.include_router(employees.router)
api_router.include_router(attendance.router)
api_router.include_router(finance.router)
api_router.include_router(vendors.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(grns.router)
api_router.include_router(chat.router)
api_router.include_router(fleet.router)
api_router.include_router(hrms.router)
api_router.include_router(inventory.router)
api_router.include_router(surprise_attendance.router)
api_router.include_router(approvals.router)
api_router.include_router(roles.router)
api_router.include_router(workflow.router)
api_router.include_router(settings.router)
api_router.include_router(logs.router)
api_router.include_router(quotations.router)
api_router.include_router(labour_attendance.router)
api_router.include_router(notifications.router)
api_router.include_router(subcontractor_billing.router)

app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    # Idempotent role-sub-tabs migration — adds any sub-tab keys that the code
    # now requires but existing role docs in the DB don't have yet. Without this,
    # roles created before the sub-tab list grew would silently lose approval
    # access for new entity types (DPR, SC Advances, Stock Returns, Transfers).
    try:
        from app.api.roles import SUB_TABS
        from database import db
        roles_doc = await db.roles.find_one({"_id": "global_roles"})
        if roles_doc and isinstance(roles_doc.get("roles"), list):
            changed = False
            for role in roles_doc["roles"]:
                perms = role.get("permissions")
                if not isinstance(perms, list):
                    continue
                for p in perms:
                    if not isinstance(p, dict):
                        continue
                    mod = p.get("name")
                    expected = SUB_TABS.get(mod)
                    if not expected:
                        continue
                    existing = p.get("subTabs")
                    if not isinstance(existing, list):
                        continue
                    # Backfill ONLY for the Administrator role (which should
                    # always have everything). For other roles we don't touch
                    # what the admin configured — they keep exactly what they
                    # granted, but new sub-tab keys can be added via the UI.
                    if role.get("name") == "Administrator":
                        merged = sorted(set(existing) | set(expected), key=lambda x: expected.index(x) if x in expected else 999)
                        if merged != existing:
                            p["subTabs"] = merged
                            changed = True
            if changed:
                await db.roles.update_one({"_id": "global_roles"}, {"$set": {"roles": roles_doc["roles"]}})
                print("Role sub-tabs migrated: Administrator role updated with new sub-tab keys.")
    except Exception as e:
        print(f"Role migration check failed (non-fatal): {e}")

    if not os.environ.get("VERCEL"):
        try:
            from app.services.scheduler import start_scheduler
            start_scheduler()
        except Exception as e:
            print(f"Scheduler failed to start: {e}")

@app.get("/")
async def root():
    return {"message": "Civil ERP API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
