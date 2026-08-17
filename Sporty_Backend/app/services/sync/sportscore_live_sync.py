"""SportScore live tick — display-only liveness for football fixtures.

WHY: API-Football's 100 req/day cap forces an HOURLY live poll, so a goal can
go unseen for up to an hour. SportScore is keyless with ~10k req/day, so this
runs every 60 seconds. It writes score, minute, the event feed and substitution
messages, and NOTHING that scoring reads.

THE OWNERSHIP RULE (read before changing anything here):

  * matches.status -> 'live'      : this module may set it.
  * matches.status -> 'finished'  : API-Football ONLY. 'finished' means the FT
                                    stat sheet is booked (see _finish_match);
                                    this module must never imply that.
  * home_score/away_score         : written while live; API-Football overwrites
                                    on its own tick and at full time, and its
                                    value is the one that stands.
  * live_events                   : written with 'ss:'-prefixed event ids so the
                                    two providers can never collide on
                                    (match_id, event_id). Both sets coexist;
                                    app/api/routes/match.py picks one to DISPLAY.
  * fantasy points                : NEVER. apply_live_points is not called here,
                                    and _aggregate_match_events filters these
                                    rows out — without that filter the FT
                                    event-count fallback would book every goal
                                    twice.

Their data has no ids of any kind, so players are resolved by club-scoped name
matching, which refuses ambiguous matches rather than guessing. Unresolved
players still show in the feed under the provider's own name; they simply carry
no player_id, which is exactly what keeps them inert for scoring.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import get_async_redis
from app.admin.feature_flags import get_effective_flag
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage
from app.services.sync.football_live_sync import (
    _club_name_index,
    _fixtures_in_live_window,
    live_key_for,
)
from app.services.sync.name_matching import normalize
from app.services.sync.sportscore_teams import build_match_slug
from app.external_apis.sportscore_api import SportScoreClient

logger = logging.getLogger(__name__)

SOURCE = "sportscore"

# Their incident `type` (lower-cased) -> our event_type. Anything not listed is
# skipped rather than written through: an unknown type would render as a
# generic whistle glyph in the feed, which is worse than showing nothing.
_INCIDENT_TYPE_MAP: dict[str, str] = {
    "goal": "goal",
    "own goal": "own_goal",
    "penalty goal": "goal",
    "yellow card": "yellow_card",
    "red card": "red_card",
    "second yellow card": "red_card",
    "yellow red card": "red_card",
    "substitution": "substitution",
    "missed penalty": "penalty_missed",
    "penalty missed": "penalty_missed",
    "penalty saved": "penalty_saved",
}

# Everything SportScore is CAPABLE of emitting. app/api/routes/match.py merges the
# two providers by type against this set: SportScore owns every type in here (it
# ticks every 60s, so its timeline is complete), API-Football owns the rest —
# today just assists, which SportScore has no incident type for. Derived from the
# map above rather than written out, so adding an incident type moves the display
# boundary with it.
COVERED_EVENT_TYPES = frozenset(_INCIDENT_TYPE_MAP.values())

# How far their reported kickoff may sit from ours before we refuse the payload.
# This is the guard against their slug ambiguity: ONE slug serves both legs of a
# season fixture pair, so without a time check we could ingest the reverse
# fixture's events into today's match.
_MAX_KICKOFF_DRIFT_SECONDS = 3 * 3600

# Their per-request failure rate is ~25% (503 + HTML holding page), so a tick
# fans out concurrently; a serial pass would routinely overrun its own interval.
_MAX_CONCURRENT_FETCHES = 5

# Provider strings are third-party input landing in our DB. Names are clipped
# before storage — nothing here is trusted to be short or well-formed.
_MAX_NAME_LEN = 120


def _clip(value: Any) -> str:
    return str(value or "").strip()[:_MAX_NAME_LEN]


def their_status(payload: dict) -> str:
    """Their status -> ours. Deliberately coarse: we only care whether it is
    over (stop ticking) or in progress (write 'live')."""
    raw = str(payload.get("status") or "").strip().lower()
    if raw in {"finished", "ft", "aet", "pen", "ended", "cancelled", "postponed"}:
        return "finished"
    if raw in {"upcoming", "scheduled", "notstarted", "not started", ""}:
        return "upcoming"
    return "live"


def payload_matches_fixture(payload: dict, match: Match) -> bool:
    """Does this payload really describe the fixture we asked about?

    Their kickoff time is the discriminator — see _MAX_KICKOFF_DRIFT_SECONDS.
    Their fixture LISTS carry junk dates, but the per-match payload's `time` has
    been reliable; a missing/unparseable time is accepted (their data, not ours,
    is degraded) so a format change doesn't silently kill all live coverage.
    """
    raw_time = payload.get("time")
    if not raw_time or not match.match_date:
        return True
    try:
        their_kickoff = datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
    except ValueError:
        return True
    ours = match.match_date
    if ours.tzinfo is None:
        ours = ours.replace(tzinfo=timezone.utc)
    drift = abs((their_kickoff - ours).total_seconds())
    if drift > _MAX_KICKOFF_DRIFT_SECONDS:
        logger.warning(
            "SportScore: payload for %s vs %s is %.1fh from our kickoff — "
            "refusing it (wrong leg of the fixture pair?)",
            match.home_team, match.away_team, drift / 3600,
        )
        return False
    return True


def build_event_rows(
    *,
    live_key: str,
    home_team: str,
    away_team: str,
    incidents: list[dict],
    resolve: Callable[[str, str], Any],
    now: datetime,
) -> tuple[list[dict], list[dict]]:
    """Their incidents -> (live_events rows, LINEUP_CHANGE message payloads).

    Pure apart from `resolve(name, club) -> Player | None`, so the mapping is
    unit-testable against recorded payloads with no DB.

    Substitutions follow the contract the rest of the app already speaks:
    player_id is the player coming ON, meta.related_player_id the one coming
    OFF. Their incidents hand us both by name (`player_in` / `player_out`).
    """
    rows: list[dict] = []
    sub_messages: list[dict] = []

    for incident in incidents:
        raw_type = str(incident.get("type") or "").strip().lower()
        event_type = _INCIDENT_TYPE_MAP.get(raw_type)
        if event_type is None:
            continue

        minute = incident.get("time")
        minute = int(minute) if isinstance(minute, (int, float)) else 0
        team = home_team if incident.get("side") == "home" else away_team

        if event_type == "substitution":
            name_in = _clip(incident.get("player_in"))
            name_out = _clip(incident.get("player_out"))
            if not name_in and not name_out:
                continue
            player_in = resolve(name_in, team) if name_in else None
            player_out = resolve(name_out, team) if name_out else None
            # Keyed on the outgoing player: stable across ticks even as their
            # minute drifts by one, and a player only ever goes off once.
            event_id = f"ss:{live_key}:{minute}:substitution:{normalize(name_out)}"
            rows.append({
                "match_id": live_key,
                "event_id": event_id,
                "sport": "football",
                "event_type": "substitution",
                "player_id": str(player_in.id) if player_in else "",
                "team_id": "",
                "value": 0.0,
                "meta": {
                    "minute": minute,
                    "detail": "Substitution",
                    "source": SOURCE,
                    "team": team,
                    "player_name": name_in,
                    "related_player_id": str(player_out.id) if player_out else None,
                    "related_player_name": name_out,
                },
                "ts": now,
            })
            sub_messages.append({
                "event_id": event_id,
                "match_id": live_key,
                "team_id": team,
                "player_in": str(player_in.id) if player_in else "",
                "player_out": str(player_out.id) if player_out else None,
                "player_in_name": name_in,
                "player_out_name": name_out,
                "minute": minute,
            })
            continue

        name = _clip(incident.get("player"))
        if not name:
            continue
        player = resolve(name, team)
        rows.append({
            "match_id": live_key,
            "event_id": f"ss:{live_key}:{minute}:{event_type}:{normalize(name)}",
            "sport": "football",
            "event_type": event_type,
            "player_id": str(player.id) if player else "",
            "team_id": "",
            "value": 0.0,
            "meta": {
                "minute": minute,
                "detail": _clip(incident.get("type")),
                "source": SOURCE,
                "team": team,
                # Their names are the only identity they give us, so keep them
                # for display: an unresolved player must not render as blank.
                "player_name": name,
            },
            "ts": now,
        })

    return rows, sub_messages


async def sync_sportscore_live(db: Session) -> str:
    """One tick: refresh every in-window football fixture from SportScore."""
    if not get_effective_flag(
        db, "sportscore_live_enabled", default=settings.SPORTSCORE_LIVE_ENABLED
    ):
        return "ok: sportscore live disabled (SPORTSCORE_LIVE_ENABLED=false)"

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        return "ok: football sport not seeded"

    candidates = _fixtures_in_live_window(db, sport.id)
    if not candidates:
        return "ok: no fixtures in live window; provider not called"

    targets: list[tuple[Match, str]] = []
    for match in candidates:
        slug = build_match_slug(match.home_team, match.away_team)
        if slug:  # build_match_slug already logs the miss, by club name
            targets.append((match, slug))
    if not targets:
        return "ok: no fixtures with a mapped SportScore slug"

    client = SportScoreClient()
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_FETCHES)

    async def _fetch(slug: str) -> dict | None:
        async with semaphore:
            return await client.get_match(slug)

    payloads = await asyncio.gather(*(_fetch(slug) for _, slug in targets))

    redis = await get_async_redis()
    now = datetime.now(timezone.utc)
    updated = 0
    skipped = 0

    for (match, _slug), payload in zip(targets, payloads):
        if payload is None:
            skipped += 1  # interstitial/timeout — the next tick retries
            continue
        if not payload_matches_fixture(payload, match):
            skipped += 1
            continue

        status = their_status(payload)
        if status == "upcoming":
            continue
        if status == "finished" and match.status == "finished":
            continue  # nothing left to add; API-Football owns the finish

        live_key = live_key_for(match)
        home_team = match.home_team or ""
        away_team = match.away_team or ""

        # Club-scoped name indexes, built once per fixture. Cross-club matching
        # is what produced a wrong attribution in production, so each side is
        # only ever matched against its own roster.
        indexes = {
            home_team: _club_name_index(db, sport.id, home_team),
            away_team: _club_name_index(db, sport.id, away_team),
        }

        def resolve(name: str, club: str):
            index = indexes.get(club)
            return index.match(name, club=club) if index else None

        incidents = payload.get("incidents")
        rows, sub_messages = build_event_rows(
            live_key=live_key,
            home_team=home_team,
            away_team=away_team,
            incidents=incidents if isinstance(incidents, list) else [],
            resolve=resolve,
            now=now,
        )

        inserted_ids: set[str] = set()
        if rows:
            statement = (
                pg_insert(LiveEvent)
                .values(rows)
                .on_conflict_do_nothing(index_elements=["match_id", "event_id"])
                .returning(LiveEvent.event_id)
            )
            inserted_ids = {row[0] for row in db.execute(statement)}

        minute = payload.get("live_minute")
        minute = int(minute) if isinstance(minute, (int, float)) else None
        home_score = payload.get("home_score")
        away_score = payload.get("away_score")
        if str(home_score).isdigit() and str(away_score).isdigit():
            match.home_score = int(home_score)
            match.away_score = int(away_score)
        # Never 'finished': that word means the FT stat sheet is booked, which
        # only the API-Football path can honour.
        if status == "live" and match.status == "scheduled":
            match.status = "live"
        db.commit()
        updated += 1

        channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
        new_rows = [r for r in rows if r["event_id"] in inserted_ids]
        await redis.publish(channel, WSMessage(
            event="SCORE_UPDATE",
            data={
                "kind": "SPORTSCORE_POLL",
                "match_id": live_key,
                "sport": "football",
                "status": match.status,
                "home": match.home_score,
                "away": match.away_score,
                "minute": minute,
                # Events ride inside SCORE_UPDATE: the frontend declares a
                # MATCH_EVENT message type but drops it on the floor.
                "events": [
                    {
                        "event_id": r["event_id"],
                        "event_type": r["event_type"],
                        "minute": r["meta"]["minute"],
                        "sporty_player_id": r["player_id"] or None,
                        "player_name": r["meta"].get("player_name"),
                        "team": r["meta"].get("team"),
                        "related_sporty_player_id": r["meta"].get("related_player_id"),
                        "related_player_name": r["meta"].get("related_player_name"),
                    }
                    for r in new_rows
                ],
            },
        ).model_dump_json())

        for message in sub_messages:
            if message.pop("event_id") not in inserted_ids:
                continue
            await redis.publish(
                channel,
                WSMessage(event="LINEUP_CHANGE", data=message).model_dump_json(),
            )

    if updated:
        # Dashboard tickers don't poll — they refetch when this rings.
        await redis.publish(settings.LIVE_INDEX_CHANNEL, "{}")

    return (
        f"ok: sportscore refreshed {updated} fixture(s), "
        f"{skipped} skipped of {len(targets)} mapped"
    )
