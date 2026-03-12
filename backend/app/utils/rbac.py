from fastapi import Depends, HTTPException, status
from app.utils.auth import get_current_user
from database import get_database
from typing import Optional

async def check_permission(module: str, action: str, feature: Optional[str] = None):
    """
    Dependency to check if the current user has the required permission.
    Example usage:
    @router.get("/expenses", dependencies=[Depends(RBACPermission("Accounts", "view", "Ledger"))])
    """
    async def permission_dependency(current_user: dict = Depends(get_current_user), db = Depends(get_database)):
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
            
        # Check permissions
        # In the current structure, permissions are a list of objects with module name
        permissions = role.get("permissions", [])
        module_perm = next((p for p in permissions if p["name"] == module), None)
        
        if not module_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No permissions found for module '{module}'"
            )
            
        # Check module-level action (view/edit/delete)
        actions = module_perm.get("actions", {})
        if not actions.get(action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action '{action}' not allowed for module '{module}'"
            )
            
        # If a specific feature (sub-tab) is requested, check subTabs list
        if feature:
            sub_tabs = module_perm.get("subTabs", [])
            if feature not in sub_tabs:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access to feature '{feature}' in module '{module}' is restricted"
                )
                
        return True
        
    return permission_dependency

class RBACPermission:
    def __init__(self, module: str, action: str, feature: Optional[str] = None):
        self.module = module
        self.action = action
        self.feature = feature

    async def __call__(self, current_user: dict = Depends(get_current_user), db = Depends(get_database)):
        checker = await check_permission(self.module, self.action, self.feature)
        return await checker(current_user, db)
