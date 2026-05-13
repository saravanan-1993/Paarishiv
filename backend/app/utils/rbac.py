from fastapi import Depends, HTTPException, status
from app.utils.auth import get_current_user
from database import get_database
from typing import Optional

# v2 module key → v1 display label mapping
_KEY_TO_LABEL = {
    "dashboard": "Dashboard",
    "projects": "Projects",
    "hrms": "HRMS",
    "accounts": "Accounts",
    "procurement": "Procurement",
    "inventory": "Inventory Management",
    "fleet": "Fleet Management",
    "approvals": "Approvals",
    "reports": "Reports",
    "site_reports": "Site Reports",
    "team_chat": "Team Chat",
    "settings": "Settings",
    "system_logs": "System Logs",
}

# Reverse: display label → v2 key
_LABEL_TO_KEY = {v: k for k, v in _KEY_TO_LABEL.items()}


def normalize_role(role: str) -> str:
    """Remove all spaces and lowercase so 'Project Co ordinator' == 'Project Coordinator'."""
    return "".join((role or "").lower().split())

def role_in(user_role: str, allowed: list) -> bool:
    """Space-insensitive, case-insensitive role membership check."""
    norm = normalize_role(user_role)
    return any(norm == normalize_role(r) for r in allowed)

def _resolve_v2(permissions: dict, module_label: str, action: str, feature: Optional[str]):
    """
    Resolve permission check against a v2 permissions dict.
    Returns True if allowed, False if denied, None if module not found.
    """
    # Try to find the module by converting label → key
    mod_key = _LABEL_TO_KEY.get(module_label) or module_label.lower().replace(" ", "_")
    mod = permissions.get(mod_key)
    if mod is None:
        # Fallback: try the raw label as key
        mod = permissions.get(module_label)
    if mod is None or not isinstance(mod, dict):
        return None  # module not found

    # Check action at module level
    if not mod.get(action):
        return False

    # If a submodule / feature is requested, check submodules dict
    if feature:
        subs = mod.get("submodules", {})
        if isinstance(subs, dict):
            # Try exact key match
            sub = subs.get(feature)
            if sub is None:
                # Try converting label → key (e.g. "Quotations" → "quotations")
                sub_key = feature.lower().replace(" ", "_").replace("&", "and")
                sub = subs.get(sub_key)
            if sub is None:
                # Feature not listed → check if it exists in subTabs list (hybrid)
                sub_tabs = mod.get("subTabs", [])
                if isinstance(sub_tabs, list):
                    if feature not in sub_tabs:
                        return False
                else:
                    return False
            elif isinstance(sub, dict):
                if not sub.get("view", False):
                    return False
            else:
                return False

    return True


# Admin-class role names that hold privilege-escalation rights (creating /
# deleting other admin accounts). Resolved dynamically via role_in() so any
# casing / whitespace variant matches.
ADMIN_CLASS_ROLES = ["Super Admin", "Administrator"]


def is_admin_role(role_name: str) -> bool:
    """True if the role is in the admin class (Super Admin / Administrator)."""
    return role_in(role_name, ADMIN_CLASS_ROLES)


async def _build_assignment_or_clauses(db, user: dict) -> list:
    """Build the $or clauses for finding projects this user is assigned to
    (as engineer or coordinator). Resolves via username, employee code, _id,
    employee record, and siteId.
    """
    emp_code = user.get("username") or user.get("employeeCode") or ""
    emp_id_str = str(user.get("_id") or user.get("id") or "")
    or_clauses = [
        {"engineer_id": emp_code},
        {"coordinator_id": emp_code},
    ]
    if emp_id_str:
        or_clauses.append({"engineer_id": emp_id_str})
        or_clauses.append({"coordinator_id": emp_id_str})
    try:
        emp = await db.employees.find_one({"$or": [{"employeeCode": emp_code}, {"username": emp_code}]})
        if emp:
            emp_real_id = str(emp.get("_id", ""))
            if emp_real_id:
                or_clauses.append({"engineer_id": emp_real_id})
                or_clauses.append({"coordinator_id": emp_real_id})
            if emp.get("employeeCode"):
                or_clauses.append({"engineer_id": emp["employeeCode"]})
                or_clauses.append({"coordinator_id": emp["employeeCode"]})
            if emp.get("siteId"):
                or_clauses.append({"_id": emp["siteId"]})
    except Exception:
        pass
    return or_clauses


async def get_assigned_project_names(db, user: dict) -> list:
    """Return list of project names where the user is assigned as engineer or
    coordinator. Empty list if no assignments. Pure data lookup — no role-name
    matching.
    """
    or_clauses = await _build_assignment_or_clauses(db, user)
    projects = await db.projects.find({"$or": or_clauses}, {"name": 1}).to_list(200)
    return [p.get("name") for p in projects if p.get("name")]


async def get_role_names_with_permission(db, module: str, action: str = "edit") -> list:
    """Return list of role NAMES whose permission config grants `module.action`.
    Admin-class roles are always included. Pure read — no I/O beyond one DB hit.
    """
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if not roles_doc:
        return list(ADMIN_CLASS_ROLES)

    eligible = set()
    for role in (roles_doc.get("roles", []) or []):
        role_name = role.get("name", "")
        if not role_name:
            continue
        # Admin-class always eligible
        if is_admin_role(role_name):
            eligible.add(role_name)
            continue
        permissions = role.get("permissions", [])
        # v2 dict format
        if isinstance(permissions, dict):
            mod_key = _LABEL_TO_KEY.get(module) or module.lower().replace(" ", "_")
            mod = permissions.get(mod_key) or permissions.get(module) or {}
            if isinstance(mod, dict) and mod.get(action):
                eligible.add(role_name)
        # v1 array format
        elif isinstance(permissions, list):
            for p in permissions:
                if isinstance(p, dict) and p.get("name") == module:
                    if p.get("actions", {}).get(action, False):
                        eligible.add(role_name)
                    break
    return sorted(eligible)


async def get_users_with_permission(db, module: str, action: str = "edit") -> list:
    """Return list of ACTIVE usernames whose role grants `module.action`.
    Admin-class users are always included. Use this in `notify(...)` recipient
    lists instead of hardcoded role-name strings like ["Administrator"].

    Example:
        recipients = await get_users_with_permission(db, "Accounts", "edit")
        await notify(db, submitter, recipients, ...)
    """
    eligible_role_names = await get_role_names_with_permission(db, module, action)
    if not eligible_role_names:
        return []

    employees = await db.employees.find(
        {"status": "Active", "roles": {"$in": eligible_role_names}},
        {"username": 1, "employeeCode": 1}
    ).to_list(500)

    usernames = []
    seen = set()
    for emp in employees:
        u = emp.get("username") or emp.get("employeeCode")
        if u and u not in seen:
            usernames.append(u)
            seen.add(u)
    return usernames


async def get_admin_class_usernames(db) -> list:
    """Return active usernames holding any admin-class role.
    Shortcut wrapper around get_users_with_permission for callers that just want
    "tell every admin" without specifying a module.
    """
    employees = await db.employees.find(
        {"status": "Active", "roles": {"$in": list(ADMIN_CLASS_ROLES)}},
        {"username": 1, "employeeCode": 1}
    ).to_list(500)
    usernames = []
    seen = set()
    for emp in employees:
        u = emp.get("username") or emp.get("employeeCode")
        if u and u not in seen:
            usernames.append(u)
            seen.add(u)
    return usernames


async def is_assignment_scoped(db, user: dict) -> bool:
    """True if the user is currently assigned as engineer or coordinator on any
    project — i.e. their data view should be scoped to those projects rather than
    seeing everything. Admin-class roles are NEVER scoped.
    """
    if is_admin_role(user.get("role") or ""):
        return False
    or_clauses = await _build_assignment_or_clauses(db, user)
    count = await db.projects.count_documents({"$or": or_clauses})
    return count > 0


async def fetch_role_doc(db, role_name: str) -> Optional[dict]:
    """Fetch the user's role definition from the global roles document.

    Returns None if not found. Caller can reuse the returned role across many
    permission checks within the same request to avoid repeated DB hits.
    """
    if not role_name:
        return None
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if not roles_doc:
        return None
    norm_target = normalize_role(role_name)
    for r in (roles_doc.get("roles", []) or []):
        if normalize_role(r.get("name", "")) == norm_target:
            return r
    return None


def _role_has_sub_tab(role: Optional[dict], module: str, sub_tab: str) -> bool:
    """Pure check (no I/O) — does this role definition list the given sub_tab?"""
    if not role:
        return False
    permissions = role.get("permissions", [])
    # v2 dict format
    if isinstance(permissions, dict):
        mod_key = _LABEL_TO_KEY.get(module) or module.lower().replace(" ", "_")
        mod = permissions.get(mod_key) or permissions.get(module) or {}
        sub_tabs = mod.get("subTabs", []) if isinstance(mod, dict) else []
        return sub_tab in sub_tabs
    # v1 array format
    if isinstance(permissions, list):
        module_perm = next((p for p in permissions if isinstance(p, dict) and p.get("name") == module), None)
        if not module_perm:
            return False
        return sub_tab in (module_perm.get("subTabs", []) or [])
    return False


async def has_sub_tab_access(db, user: dict, module: str, sub_tab: str, role_doc: Optional[dict] = None) -> bool:
    """Dynamic sub-tab access check — no role-name strings.

    Returns True if the user's role has `sub_tab` listed under the given module's
    subTabs[]. Super Admin / Administrator always pass. Pass `role_doc` (already
    fetched via fetch_role_doc) to skip the DB lookup — useful in hot paths.
    """
    role_name = user.get("role") or ""
    if role_in(role_name, ["Super Admin", "Administrator"]):
        return True
    role = role_doc if role_doc is not None else await fetch_role_doc(db, role_name)
    return _role_has_sub_tab(role, module, sub_tab)


async def require_sub_tab(db, user: dict, module: str, sub_tab: str, role_doc: Optional[dict] = None):
    """Raise 403 if the user can't access the given sub-tab."""
    if not await has_sub_tab_access(db, user, module, sub_tab, role_doc=role_doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access to '{sub_tab}' in '{module}' is not granted to this role"
        )


class RBACPermission:
    """
    RBAC dependency for FastAPI routes.
    Usage: dependencies=[Depends(RBACPermission("Accounts", "view", "Ledger"))]

    Handles both v1 (array) and v2 (dict) permission shapes stored in MongoDB.
    """
    def __init__(self, module: str, action: str, feature: Optional[str] = None):
        self.module = module
        self.action = action
        self.feature = feature

    async def __call__(self, current_user: dict = Depends(get_current_user), db = Depends(get_database)):
        role_name = current_user.get("role")

        # Super Admin bypass
        if role_in(role_name, ["Super Admin", "Administrator"]):
            return True

        # Get roles from DB
        roles_doc = await db.roles.find_one({"_id": "global_roles"})
        if not roles_doc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System roles not initialized"
            )

        roles = roles_doc.get("roles", [])
        role = next((r for r in roles if normalize_role(r.get("name", "")) == normalize_role(role_name)), None)

        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' not found"
            )

        permissions = role.get("permissions", [])

        # ── v2 dict format ────────────────────────────────────────────────
        if isinstance(permissions, dict):
            result = _resolve_v2(permissions, self.module, self.action, self.feature)
            if result is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No permissions found for module '{self.module}'"
                )
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Action '{self.action}' not allowed for module '{self.module}'"
                )
            return True

        # ── v1 array format ───────────────────────────────────────────────
        if not isinstance(permissions, list):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid permissions format"
            )

        module_perm = next((p for p in permissions if isinstance(p, dict) and p.get("name") == self.module), None)

        if not module_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No permissions found for module '{self.module}'"
            )

        # Check module-level action (view/edit/delete)
        actions = module_perm.get("actions", {})
        if not actions.get(self.action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action '{self.action}' not allowed for module '{self.module}'"
            )

        # If a specific feature (sub-tab) is requested, check subTabs list
        if self.feature:
            sub_tabs = module_perm.get("subTabs", [])
            if self.feature not in sub_tabs:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access to feature '{self.feature}' in module '{self.module}' is restricted"
                )

        return True
