from fastapi import Depends, HTTPException, status
from app.utils.auth import get_current_user
from database import get_database
from typing import Optional

class RBACPermission:
    """
    RBAC dependency for FastAPI routes.
    Usage: dependencies=[Depends(RBACPermission("Accounts", "view", "Ledger"))]
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
        role = next((r for r in roles if r["name"] == role_name), None)

        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' not found"
            )

        # Check module permissions
        permissions = role.get("permissions", [])
        module_perm = next((p for p in permissions if p["name"] == self.module), None)

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
