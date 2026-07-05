"""Shared FastAPI Depends() callable for platform-admin route protection.

Modeled on require_league_owner (app/league/dependencies.py): a thin
Depends()-compatible wrapper around get_current_active_user that raises 403
if the user's role doesn't meet the required tier.

Role is never embedded in the JWT (see app/core/security.py) — it is always
read fresh off the User row that get_current_active_user already loaded, so
a promotion/demotion takes effect on the very next request instead of
waiting out the access token's lifetime.

Lives in app/admin/, not app/auth/, to keep identity/session concerns
(app/auth) separate from authorization concerns (app/admin), and to avoid
app/auth importing from app/admin (which will need app/admin/models.py for
audit logging).
"""

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_active_user
from app.auth.models import User, UserRole

_ROLE_RANK: dict[UserRole, int] = {
    UserRole.USER: 0,
    UserRole.SUPPORT: 1,
    UserRole.ADMIN: 2,
    UserRole.SUPER_ADMIN: 3,
}


def require_admin_role(min_role: UserRole):
    """Dependency factory: Depends(require_admin_role(UserRole.ADMIN))."""

    def _dep(current_user: User = Depends(get_current_active_user)) -> User:
        if _ROLE_RANK[current_user.role] < _ROLE_RANK[min_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient admin privileges",
            )
        return current_user

    return _dep
