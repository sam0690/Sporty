"""
Match sync service — Fetch and sync matches/fixtures from external APIs.

Syncs match data from:
  - API-Football (football/soccer)
  - API-NBA (basketball)
  - CricAPI (cricket)

Usage:
    from app.services.sync.match_sync import sync_football_matches
    
    db = SessionLocal()
    await sync_football_matches(db, league_id=39, season=2024)
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.external_apis.basketball_api import BasketballAPIClient
from app.external_apis.cricket_api import CricketAPIClient
from app.external_apis.football_api import FootballAPIClient
from app.external_apis.football_data_org import get_pl_matches
from app.league.models import Sport
from app.match.models import Match
from app.services.scoring.trigger import enqueue_scoring_for_finished_match

# ── football-data.org schedule layer ────────────────────────────────────────
# Season schedule rows are created as external_api_id="fdo:<id>" placeholders;
# the API-Football date-window pass "claims" them day-of by swapping in the
# numeric fixture id (matched on kickoff date + team names), which is what the
# live poll / predictions / FT-sheet paths key on.

_FDO_STATUS_MAP = {
    "SCHEDULED": "scheduled", "TIMED": "scheduled",
    "IN_PLAY": "live", "PAUSED": "live",
    "FINISHED": "finished",
    "POSTPONED": "postponed", "SUSPENDED": "postponed", "CANCELLED": "cancelled",
}

# football-data.org full names -> API-Football team names (the form stored in
# Match.home_team/away_team). Explicit map, not fuzzy — same policy as
# app/core/team_names.py. Names not listed just get the FC/AFC affixes stripped.
_FDO_NAME_ALIASES = {
    "Brighton & Hove Albion": "Brighton",
    "Ipswich Town": "Ipswich",
    "Leeds United": "Leeds",
    "Newcastle United": "Newcastle",
    "Tottenham Hotspur": "Tottenham",
    "Coventry City": "Coventry",
    "West Ham United": "West Ham",
    "Wolverhampton Wanderers": "Wolves",
}


def _fdo_team_name(raw: str) -> str:
    name = raw.strip()
    for suffix in (" FC", " AFC"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    if name.startswith("AFC "):
        name = name[len("AFC "):]
    return _FDO_NAME_ALIASES.get(name, name)


def _find_same_fixture(db: Session, sport_id, home: str, away: str, match_date: datetime) -> Match | None:
    """Same two teams on the same UTC day — unambiguous within one league."""
    day_start = match_date.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(Match)
        .filter(
            Match.sport_id == sport_id,
            Match.home_team == home,
            Match.away_team == away,
            Match.match_date >= day_start,
            Match.match_date < day_start + timedelta(days=1),
        )
        .first()
    )


async def _sync_football_schedule_fdo(db: Session, sport_id) -> tuple[int, int]:
    """Upsert the full current-season EPL schedule from football-data.org.

    Schedule only: creates/updates kickoff times and scheduled/postponed/
    cancelled statuses. Never writes scores or 'finished' — finals and stats
    always flow through the API-Football live/reconcile path so scoring is
    never bypassed. Rows already claimed by API-Football (numeric id) only
    get kickoff-time updates while still scheduled.
    """
    payload = await get_pl_matches()
    added = updated = 0
    for m in payload.get("matches", []):
        fdo_id = m.get("id")
        utc = m.get("utcDate")
        home = _fdo_team_name((m.get("homeTeam") or {}).get("name") or "")
        away = _fdo_team_name((m.get("awayTeam") or {}).get("name") or "")
        status = _FDO_STATUS_MAP.get(m.get("status"), "scheduled")
        if not fdo_id or not utc or not home or not away:
            continue
        match_date = datetime.fromisoformat(utc.replace("Z", "+00:00"))

        row = db.query(Match).filter(Match.external_api_id == f"fdo:{fdo_id}").first()
        if row is None:
            row = _find_same_fixture(db, sport_id, home, away, match_date)
        if row is None:
            if status in ("live", "finished"):
                continue  # in-play/final data belongs to the API-Football path
            db.add(Match(
                sport_id=sport_id,
                external_api_id=f"fdo:{fdo_id}",
                home_team=home,
                away_team=away,
                match_date=match_date,
                status=status,
                competition="Premier League",
                season=str((m.get("season") or {}).get("startDate", ""))[:4]
                or str(match_date.year if match_date.month >= 7 else match_date.year - 1),
            ))
            added += 1
        elif (row.external_api_id or "").isdigit():
            if row.status == "scheduled" and row.match_date != match_date:
                row.match_date = match_date  # TV-pick kickoff shifts
                updated += 1
        else:
            changed = row.match_date != match_date or (
                status in ("scheduled", "postponed", "cancelled") and row.status != status
            )
            row.match_date = match_date
            if status in ("scheduled", "postponed", "cancelled"):
                row.status = status
            updated += changed
    db.commit()
    return added, updated


async def sync_football_matches(
    db: Session, league_id: int = 39, season: int = 2024
):
    """
    Fetch and sync football fixtures from API-Football.

    Args:
        db: Database session
        league_id: League ID (39 = Premier League, 140 = La Liga)
        season: Year (e.g., 2024)
    """
    print(f"⚽ Syncing football matches (League {league_id}, Season {season})...")

    # Get sport
    football = db.query(Sport).filter(Sport.name == "football").first()
    if not football:
        print("❌ Football sport not found in database. Create it first.")
        return

    # Season schedule from football-data.org (skipped without a token; the
    # date-window fallback below still creates rows day-of).
    if settings.FOOTBALL_DATA_ORG_TOKEN:
        try:
            added, updated = await _sync_football_schedule_fdo(db, football.id)
            print(f"  📅 Schedule (football-data.org): {added} added, {updated} updated")
        except Exception as e:  # noqa: BLE001 — schedule layer is optional
            print(f"  ⚠️ football-data.org schedule sync failed: {e}")

    # Fetch from API
    client = FootballAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_fixtures(league_id=league_id, season=season)
        fixtures = response.get("response", [])
        errors = response.get("errors") or None

        if not fixtures and errors:
            # The Free plan blocks current-season fixture lists (a "plan"
            # error) but allows date queries within today ± 1 day, unfiltered.
            # Fall back to today+tomorrow and filter to our league client-side
            # — match rows then exist before the live poll's window gate needs
            # them. ponytail: full-season schedule visibility needs the paid tier.
            print(f"  Season list unavailable ({errors}); falling back to date window")
            fixtures = []
            today = datetime.now(timezone.utc).date()
            for offset in (0, 1):
                day_payload = await client.get_fixtures_by_date(
                    (today + timedelta(days=offset)).isoformat()
                )
                fixtures += [
                    f for f in day_payload.get("response", [])
                    if (f.get("league") or {}).get("id") == league_id
                ]

        for fixture_data in fixtures:
            fixture = fixture_data.get("fixture", {})
            teams = fixture_data.get("teams", {})
            league = fixture_data.get("league", {})
            goals = fixture_data.get("goals", {})

            fixture_id = fixture.get("id")
            match_date_str = fixture.get("date")
            status_obj = fixture.get("status", {})
            status_short = status_obj.get("short", "NS")  # NS = Not Started

            # Parse match date
            match_date = datetime.fromisoformat(match_date_str.replace("Z", "+00:00"))

            home_team = teams.get("home", {}).get("name")
            away_team = teams.get("away", {}).get("name")

            if not fixture_id or not home_team or not away_team:
                continue

            # Map API status to our status
            status_map = {
                "NS": "scheduled",  # Not Started
                "1H": "live",  # First Half
                "HT": "live",  # Half Time
                "2H": "live",  # Second Half
                "ET": "live",  # Extra Time
                "P": "live",  # Penalty
                "FT": "finished",  # Full Time
                "AET": "finished",  # After Extra Time
                "PEN": "finished",  # After Penalty
                "PST": "postponed",
                "CANC": "cancelled",
                "ABD": "cancelled",  # Abandoned
                "AWD": "finished",  # Technical Loss
                "WO": "finished",  # WalkOver
            }

            status = status_map.get(status_short, "scheduled")

            # Check if exists
            existing = (
                db.query(Match)
                .filter(Match.external_api_id == str(fixture_id))
                .first()
            )
            if existing is None:
                # Claim the football-data.org schedule placeholder for this
                # fixture: swap in the numeric id the live poll / predictions
                # / FT-sheet paths key on.
                placeholder = _find_same_fixture(
                    db, football.id, home_team, away_team, match_date
                )
                if placeholder is not None and not (placeholder.external_api_id or "").isdigit():
                    placeholder.external_api_id = str(fixture_id)
                    existing = placeholder

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = status
                existing.match_date = match_date
                existing.home_score = goals.get("home")
                existing.away_score = goals.get("away")
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

                if previous_status != "finished" and status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=football.id,
                    )
            else:
                # Create new
                match = Match(
                    sport_id=football.id,
                    external_api_id=str(fixture_id),
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=status,
                    home_score=goals.get("home"),
                    away_score=goals.get("away"),
                    competition=league.get("name", "Premier League"),
                    season=str(season),
                )
                db.add(match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Football matches synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing football matches: {e}")
        db.rollback()


async def sync_basketball_games(db: Session, season: int = 2024):
    """
    Fetch and sync basketball games from API-NBA.

    Args:
        db: Database session
        season: Year (e.g., 2024)
    """
    print(f"🏀 Syncing basketball games (Season {season})...")

    # Get sport
    basketball = db.query(Sport).filter(Sport.name == "basketball").first()
    if not basketball:
        print("❌ Basketball sport not found in database. Create it first.")
        return

    # Fetch from API
    client = BasketballAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_games(season=season)
        games = response.get("response", [])

        for game_data in games:
            game_id = game_data.get("id")
            date_obj = game_data.get("date", {})
            teams_obj = game_data.get("teams", {})
            scores_obj = game_data.get("scores", {})
            status_obj = game_data.get("status", {})

            # Parse date
            date_str = date_obj.get("start")
            if not date_str:
                continue

            match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))

            home_team = teams_obj.get("home", {}).get("name")
            away_team = teams_obj.get("visitors", {}).get("name")

            if not game_id or not home_team or not away_team:
                continue

            # Map API status
            status_long = status_obj.get("long", "Scheduled")
            status = "scheduled"
            if "Live" in status_long or "In Play" in status_long:
                status = "live"
            elif "Finished" in status_long:
                status = "finished"

            # Check if exists
            existing = (
                db.query(Match).filter(Match.external_api_id == str(game_id)).first()
            )

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = status
                existing.match_date = match_date
                existing.home_score = scores_obj.get("home", {}).get("points")
                existing.away_score = scores_obj.get("visitors", {}).get("points")
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

                if previous_status != "finished" and status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=basketball.id,
                    )
            else:
                # Create new
                match = Match(
                    sport_id=basketball.id,
                    external_api_id=str(game_id),
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=status,
                    home_score=scores_obj.get("home", {}).get("points"),
                    away_score=scores_obj.get("visitors", {}).get("points"),
                    competition="NBA",
                    season=str(season),
                )
                db.add(match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Basketball games synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing basketball games: {e}")
        db.rollback()


async def sync_cricket_matches(db: Session):
    """
    Fetch and sync cricket matches from CricAPI.

    Args:
        db: Database session
    """
    print("🏏 Syncing cricket matches...")

    # Get sport
    cricket = db.query(Sport).filter(Sport.name == "cricket").first()
    if not cricket:
        print("❌ Cricket sport not found in database. Create it first.")
        return

    # Fetch from API
    client = CricketAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_matches()
        matches_data = response.get("data", [])

        for match in matches_data:
            match_id = match.get("id")
            name = match.get("name", "")  # e.g., "India vs Australia"
            match_type = match.get("matchType", "")
            date_str = match.get("date")
            status = match.get("status", "")

            if not match_id or not name:
                continue

            # Parse teams from name
            teams = name.split(" vs ")
            if len(teams) != 2:
                continue

            home_team = teams[0].strip()
            away_team = teams[1].strip()

            # Parse date
            match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))

            # Map status
            our_status = "scheduled"
            if "Live" in status:
                our_status = "live"
            elif "Completed" in status or "Won" in status:
                our_status = "finished"

            # Check if exists
            existing = (
                db.query(Match).filter(Match.external_api_id == match_id).first()
            )

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = our_status
                existing.match_date = match_date
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({our_status}, {match_date.date()})"
                )

                if previous_status != "finished" and our_status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=cricket.id,
                    )
            else:
                # Create new
                new_match = Match(
                    sport_id=cricket.id,
                    external_api_id=match_id,
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=our_status,
                    competition=match_type,
                    season="2024",  # CricAPI doesn't have explicit seasons
                )
                db.add(new_match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({our_status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Cricket matches synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing cricket matches: {e}")
        db.rollback()
