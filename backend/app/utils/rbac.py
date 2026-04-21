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
        if role_name in ["Super Admin", "Administrator"]:
            return True

        # Get roles from DB
        roles_doc = await db.roles.find_one({"_id": "global_roles"})
        if not roles_doc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System roles not initialized"
            )

        roles = roles_doc.get("roles", [])
        role = next((r for r in roles if r.get("name") == role_name), None)

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
