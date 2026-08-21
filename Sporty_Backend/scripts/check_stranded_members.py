"""Read-only diagnostic: why a league's leaderboard shows fewer rows than members.

Three numbers diverge and each has a different cause:
  members            — league_memberships rows (ACTIVE)
  teams              — fantasy_teams rows; members who never built one are absent
  leaderboard rows   — teams whose eligibility window has already started

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
               m.created_at        as joined_at,
               t.name              as team_name,
               w.number            as eligible_from_window,
               w.start_at          as window_starts,
               (w.id is null or w.start_at <= now()) as on_leaderboard
        from league_memberships m
        join users u on u.id = m.user_id
        left join fantasy_teams t
               on t.league_id = m.league_id
              and t.user_id = m.user_id
              and t.status = 'ACTIVE'
        left join transfer_windows w on w.id = m.eligible_from_window_id
        where m.league_id = :l
          and m.status = 'ACTIVE'
        order by m.created_at
        """),
        {"l": LEAGUE_ID},
    ).fetchall()

    no_team = [r for r in rows if r.team_name is None]
    not_yet = [r for r in rows if r.team_name is not None and not r.on_leaderboard]

    print(f"\n{len(rows)} active members, {len(rows) - len(no_team)} with a team, "
          f"{len(rows) - len(no_team) - len(not_yet)} on the leaderboard")

    print("\nno team yet (cannot appear on the leaderboard at all):")
    for r in no_team:
        print(f"  {r.username:<22} joined {r.joined_at}")

    print("\nhas a team but eligibility window has not started yet:")
    for r in not_yet:
        print(f"  {r.username:<22} team={r.team_name!r} "
              f"eligible from window {r.eligible_from_window} "
              f"which starts {r.window_starts}")
finally:
    db.rollback()
    db.close()
