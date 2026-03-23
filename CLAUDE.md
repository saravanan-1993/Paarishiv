# Civil ERP - Project Guide for Claude

## Overview
Civil Construction ERP system for managing projects, materials, workforce, finance, inventory, and fleet operations.

**Stack:** FastAPI (Python) + React 18 (Vite) + MongoDB (Motor) + Tailwind CSS + Cloudinary

## Quick Start
```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt && python3 main.py

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

## Project Structure
```
civil-erp/
├── backend/
│   ├── main.py                    # FastAPI entry, all routers mounted under /api
│   ├── database.py                # MongoDB connection (motor async), get_database()
│   ├── app/api/                   # Route handlers (one file per module)
│   │   ├── auth.py                # POST /auth/login, GET /auth/me
│   │   ├── projects.py            # /projects - CRUD, DPRs, tasks, documents
│   │   ├── employees.py           # /employees - CRUD with validation
│   │   ├── materials.py           # /materials - material master & inventory
│   │   ├── inventory.py           # /inventory - warehouse, requests, transfers, ledger
│   │   ├── finance.py             # /finance - expenses, income, receipts, bills
│   │   ├── purchase_orders.py     # /purchase-orders - PO lifecycle
│   │   ├── grns.py                # /grns - goods received notes
│   │   ├── vendors.py             # /vendors - vendor master & ledger
│   │   ├── hrms.py                # /hrms - HR dashboard, attendance, leaves, payroll
│   │   ├── attendance.py          # /attendance - clock in/out, breaks
│   │   ├── fleet.py               # /fleet - vehicles, trips, fuel, maintenance
│   │   ├── chat.py                # /chat - messages, groups, WebSocket
│   │   ├── approvals.py           # /approvals - approve/reject workflows
│   │   ├── workflow.py            # /workflow - timeline, activity log
│   │   ├── roles.py               # /roles - role & permission management
│   │   ├── settings.py            # /settings - company, SMTP, Cloudinary, profile
│   │   ├── logs.py                # /logs - activity audit trail
│   │   ├── surprise_attendance.py # /surprise-attendance - site visits
│   │   └── labour.py              # /labour - labour management
│   ├── app/models/                # Pydantic models (project.py, employee.py, etc.)
│   ├── app/utils/
│   │   ├── auth.py                # JWT (python-jose), bcrypt, get_current_user()
│   │   ├── rbac.py                # RBACPermission class, check_permission()
│   │   ├── email.py               # SMTP email (env or DB config fallback)
│   │   ├── cloudinary.py          # File upload (Cloudinary + local /static/uploads fallback)
│   │   └── logging.py             # log_activity() → activity_log collection
│   └── app/services/scheduler.py  # Background task scheduler
├── frontend/
│   ├── src/App.jsx                # Main router (React Router v6), layout
│   ├── src/main.jsx               # Vite entry point
│   ├── src/pages/                 # One component per route
│   │   ├── Dashboard.jsx          # / - role-based dashboard
│   │   ├── Projects.jsx           # /projects
│   │   ├── ProjectDetails.jsx     # /projects/:id
│   │   ├── HRMS.jsx               # /hr
│   │   ├── Finance.jsx            # /finance
│   │   ├── Materials.jsx          # /materials
│   │   ├── Fleet.jsx              # /fleet
│   │   ├── Chat.jsx               # /chat (WebSocket)
│   │   ├── Approvals.jsx          # /approvals
│   │   ├── Settings.jsx           # /settings
│   │   ├── Login.jsx, Users.jsx, Logs.jsx, Reports.jsx, etc.
│   ├── src/components/            # 50+ modal & UI components
│   │   ├── dashboards/            # Role-specific dashboard views
│   │   ├── Header.jsx, Sidebar.jsx
│   │   ├── *Modal.jsx             # All modal components
│   ├── src/context/
│   │   ├── AuthContext.jsx        # useAuth() - login/logout, localStorage token
│   │   └── NotificationContext.jsx # WebSocket notifications
│   ├── src/utils/
│   │   ├── api.js                 # Axios instance + all API endpoint functions
│   │   └── rbac.js                # Role definitions, hasPermission(), DEFAULT_ROLES
│   └── vite.config.js             # Proxy: /api → localhost:8000, /static → localhost:8000
```

## Database (MongoDB: `civil_erp`)
**Key collections:** projects, employees, attendance, materials, inventory, material_requests, material_transfer_requests, vendors, purchase_orders, grns, leaves, payroll, expenses, receipts, bills, purchase_bills, vehicles, trips, maintenance, fuel_stock, fuel_logs, chat_messages, chat_groups, surprise_attendance, activity_log, roles, settings, warehouse_inventory, stock_ledger, manpower_requests, labour

## Auth & RBAC
- **JWT auth:** 24hr tokens via `python-jose`, bcrypt passwords
- **get_current_user():** FastAPI dependency, returns `{username, role, full_name, _id}`
- **RBACPermission(module, action):** FastAPI dependency class for route-level access control
- **Roles:** Administrator (full), Site Engineer, Project Coordinator, Accountant, HR Manager, Project Manager, Purchase Officer, Employee
- **DB structure:** Single doc `{_id: "global_roles", roles: [{name, permissions: [{name, actions: {view, edit, delete}}]}]}`
- **Frontend:** `hasPermission(user, module, action)` in `utils/rbac.js`

## Conventions

### Backend (Python)
- Files: `snake_case.py`
- Functions/vars: `snake_case`
- Classes: `PascalCase`
- All routes are `async` with `motor` async MongoDB
- Every route uses `db=Depends(get_database)` and `current_user=Depends(get_current_user)`
- RBAC via `dependencies=[Depends(RBACPermission("Module", "action"))]`
- Log important actions: `await log_activity(db, user_id, username, action, details, type)`
- DB fields: mixed (`snake_case` new + `camelCase` legacy like `fullName`, `employeeCode`)

### Frontend (React/JSX)
- Components: `PascalCase.jsx`
- Utils: `camelCase.js`
- State: React Context (AuthContext, NotificationContext) — no Redux
- API calls: via `utils/api.js` (e.g., `projectAPI.getAll()`, `employeeAPI.create(data)`)
- Modals accept: `isOpen`, `onClose`, `onSuccess`, optional `data`
- Icons: `lucide-react`
- Charts: `recharts`
- PDF: `jspdf` + `jspdf-autotable`
- Handlers: `handle*` prefix (handleSubmit, handleDelete)
- Token stored in `localStorage['erp_user']`

## Key Patterns
```python
# Backend route pattern
@router.get("/", dependencies=[Depends(RBACPermission("Module", "view"))])
async def get_items(db=Depends(get_database), current_user=Depends(get_current_user)):
    items = await db.collection.find({}).to_list(100)
    for item in items:
        item["_id"] = str(item["_id"])
    return items
```

```javascript
// Frontend data fetching pattern
const [data, setData] = useState([]);
useEffect(() => {
    const fetch = async () => {
        try { const res = await moduleAPI.getAll(); setData(res.data); }
        catch (err) { console.error(err); }
    };
    fetch();
}, []);
```

## Environment Variables (.env)
```
SECRET_KEY, MONGODB_URL, DATABASE_NAME=civil_erp
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
```

## Bug Tracker
See `BUG_TRACKER.md` in project root — 48 fixed, 9 in progress, 11 not started (total 68 bugs tracked).
