from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.api import auth, projects, materials, labour, finance, vendors, purchase_orders, grns, employees, attendance, chat, fleet, hrms, inventory, surprise_attendance, approvals, roles, workflow, settings

# Ensure static/uploads exists locally
is_vercel = os.environ.get("VERCEL") == "1"
upload_dir = os.path.join(os.getcwd(), "static", "uploads")

app = FastAPI(title="Civil Construction ERP API", root_path="/api")

if not is_vercel:
    try:
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
        # Mount static files
        app.mount("/static/uploads", StaticFiles(directory=upload_dir), name="static")
    except Exception as e:
        print(f"Could not setup static files: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(materials.router)
app.include_router(labour.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(finance.router)
app.include_router(vendors.router)
app.include_router(purchase_orders.router)
app.include_router(grns.router)
app.include_router(chat.router)
app.include_router(fleet.router)
app.include_router(hrms.router)
app.include_router(inventory.router)
app.include_router(surprise_attendance.router)
app.include_router(approvals.router)
app.include_router(roles.router)
app.include_router(workflow.router)
app.include_router(settings.router)

@app.on_event("startup")
async def startup_event():
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
