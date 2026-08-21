"""Read-only diagnostic: which of a league's members are not scoring, and why.

Three numbers diverge and each has a different cause:
  members            — league_memberships rows (ACTIVE)
  teams              — fantasy_teams rows; members who never built one have none
  scoring            — teams whose first eligible window has already started

Every ACTIVE member now appears on the leaderboard; the last two groups appear
as non-scoring rows rather than being dropped.

Usage: PYTHONPATH=. venv/bin/python scripts/check_stranded_members.py [league_id]
Rolls back; writes nothing.
"""

import sys

from sqlalchemy import text

from app.database import SessionLocal

LEAGUE_ID = sys.argv[1] if len(sys.argv) > 1 else "0997a6d4-923a-4fea-a796-4e34e2a9fb6d"

db = SessionLocal()
try:
    print("league:", db.execute(
        text("select status, start_date, end_date, draft_mode, allow_midseason_join "
             "from leagues where id = :l"),
        {"l": LEAGUE_ID},
    ).fetchone())

    rows = db.execute(
        text("""
        select u.username,
               m.joined_at         as joined_at,
               t.name              as team_name,
               w.number            as eligible_from_window,
               w.start_at          as window_starts,
               (w.id is null or w.start_at <= now()) as scoring_now
        from league_memberships m
        join users u on u.id = m.user_id
        left join fantasy_teams t
               on t.league_id = m.league_id
              and t.user_id = m.user_id
              and t.status = 'active'
        left join transfer_windows w on w.id = m.eligible_from_window_id
        where m.league_id = :l
          and m.status = 'active'
        order by m.joined_at
        """),
        {"l": LEAGUE_ID},
    ).fetchall()

    no_team = [r for r in rows if r.team_name is None]
    not_yet = [r for r in rows if r.team_name is not None and not r.scoring_now]

    print(f"\n{len(rows)} active members, {len(rows) - len(no_team)} with a team")
    print(f"all {len(rows)} appear on the leaderboard; "
          f"{len(rows) - len(no_team) - len(not_yet)} of them are scoring")

    print("\nno team yet (shown as 'No squad yet', no rank or points):")
    for r in no_team:
        print(f"  {r.username:<22} joined {r.joined_at}")

    print("\nhas a team but its first scoring window has not opened yet:")
    for r in not_yet:
        print(f"  {r.username:<22} team={r.team_name!r} "
              f"scores from window {r.eligible_from_window} "
              f"which starts {r.window_starts}")
finally:
    db.rollback()
    db.close()
