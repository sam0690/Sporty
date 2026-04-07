from datetime import date

from sqlalchemy.orm import Session

from app.league.models import League, LeagueStatus
from app.services.notification_service import notify_league_active, notify_league_completed


def auto_update_league_statuses(db: Session) -> dict[str, int]:
    """Apply deterministic daily lifecycle transitions for leagues.

    Transitions handled here:
      - setup -> active when start_date <= today
      - active -> completed when end_date < today

    This function is idempotent by design because it updates only leagues
    currently in the source status for each transition.
    """
    today = date.today()

    setup_to_active = (
        db.query(League)
        .filter(
            League.status == LeagueStatus.SETUP,
            League.start_date.is_not(None),
            League.start_date <= today,
        )
        .all()
    )

    active_to_completed = (
        db.query(League)
        .filter(
            League.status == LeagueStatus.ACTIVE,
            League.end_date.is_not(None),
            League.end_date < today,
        )
        .all()
    )

    setup_ids = []
    completed_ids = []

    for league in setup_to_active:
        league.status = LeagueStatus.ACTIVE
        setup_ids.append(league.id)

    for league in active_to_completed:
        league.status = LeagueStatus.COMPLETED
        completed_ids.append(league.id)

    setup_notifications = notify_league_active(db, setup_ids)
    completed_notifications = notify_league_completed(db, completed_ids)

    db.commit()

    return {
        "setup_to_active": len(setup_ids),
        "active_to_completed": len(completed_ids),
        "active_notifications": setup_notifications,
        "completed_notifications": completed_notifications,
    }
