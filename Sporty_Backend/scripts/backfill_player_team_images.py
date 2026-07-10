"""One-time backfill for player photos and real-team logos.

Basketball: our seeded rows already carry real NBA.com IDs
(external_api_id = "nba:<id>"), so photo/logo URLs are constructed
directly from NBA's public CDN — no API call needed.

Football: no such linkage exists (the CSV's own IDs were discarded
during seeding), so team logos are fetched once from API-Football by
name match and re-hosted in our own R2 bucket (requires
RAPIDAPI_FOOTBALL_KEY). Player photos instead come from two free,
keyless sources, tried in order:

  1. TheSportsDB - one bulk request per club roster (~19 requests
     total, not one per player), so it's fast and barely touched by
     rate limits. Primary source.
  2. Wikipedia - found via the MediaWiki search API by name, one
     request per player. Slower and more rate-limit-prone, so it only
     runs against whatever TheSportsDB didn't match (e.g. Nottingham
     Forest, whose name collides with an unrelated netball club in
     TheSportsDB's search index).

Coverage isn't 100% either way: fringe squad players missing from both
sources are left with a placeholder (or a manual admin photo_url edit).

Run manually:
    venv/bin/python scripts/backfill_player_team_images.py
"""
import asyncio
import html
import re
from datetime import date

import httpx
from sqlalchemy import or_, text

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.storage_service import upload_player_photo, upload_team_logo

NBA_HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{id}.png"
NBA_LOGO_URL = "https://cdn.nba.com/logos/nba/{id}/global/L/logo.svg"

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
# Wikimedia's API etiquette requires a descriptive User-Agent identifying the
# application - https://meta.wikimedia.org/wiki/User-Agent_policy
WIKIPEDIA_USER_AGENT = "SportyFantasyApp/1.0 (backfill script; contact via repo)"

# API-Football's free tier only serves seasons 2022-2024, so newly
# promoted 2025-26 clubs (Leeds United, Burnley, Sunderland) aren't
# reachable here and are left unmatched.
FOOTBALL_TEAM_NAME_MAP = {
    "arsenal": "Arsenal",
    "aston villa": "Aston Villa",
    "bournemouth": "Bournemouth",
    "brentford": "Brentford",
    "brighton hove albion": "Brighton",
    "chelsea": "Chelsea",
    "crystal palace": "Crystal Palace",
    "everton": "Everton",
    "fulham": "Fulham",
    "liverpool": "Liverpool",
    "liverpool fc": "Liverpool",
    "manchester city": "Manchester City",
    "manchester united": "Manchester United",
    "newcastle united": "Newcastle",
    "nottingham forest": "Nottingham Forest",
    "tottenham hotspur": "Tottenham",
    "west ham united": "West Ham",
    "wolverhampton": "Wolves",
}

# TheSportsDB team IDs, resolved via searchteams.php / search_all_teams.php
# and verified by hand (a couple of club names collide with unrelated teams
# in other sports there - e.g. plain "Wolverhampton" hits an amateur club,
# and searchteams.php never surfaces the Nottingham Forest football club
# over a same-named netball team no matter the query - its id below was
# instead cross-referenced via known Forest players' searchplayers.php
# results, which do return the correct idTeam - so this is a hardcoded map,
# not a live search, same reasoning as FOOTBALL_TEAM_NAME_MAP above). Unlike
# API-Football, TheSportsDB does have the newly-promoted 2025-26 clubs.
SPORTSDB_TEAM_ID_MAP = {
    "arsenal": "133604",
    "aston villa": "133601",
    "bournemouth": "134301",
    "brentford": "134355",
    "brighton hove albion": "133619",
    "burnley": "133623",
    "chelsea": "133610",
    "crystal palace": "133632",
    "everton": "133615",
    "fulham": "133600",
    "leeds united": "133635",
    "liverpool": "133602",
    "manchester city": "133613",
    "manchester united": "133612",
    "newcastle united": "134777",
    "nottingham forest": "133720",
    "sunderland": "133603",
    "tottenham hotspur": "133616",
    "west ham united": "133636",
    "wolverhampton": "133599",
}
SPORTSDB_API = "https://www.thesportsdb.com/api/v1/json/3"


def _normalize(name: str) -> str:
    name = html.unescape(name)
    name = re.sub(r"[^a-z0-9 ]", "", name.lower())
    return re.sub(r"\s+", " ", name).strip()


def backfill_basketball(db) -> None:
    players = db.query(Player).filter(Player.external_api_id.like("nba:%")).all()
    for player in players:
        nba_id = player.external_api_id.split(":", 1)[1]
        player.photo_url = NBA_HEADSHOT_URL.format(id=nba_id)

    teams = db.query(RealTeam).filter(RealTeam.external_api_id.like("nba:%")).all()
    for team in teams:
        nba_id = team.external_api_id.split(":", 1)[1]
        team.logo_url = NBA_LOGO_URL.format(id=nba_id)

    db.commit()
    print(f"Basketball: set photo_url for {len(players)} players, logo_url for {len(teams)} teams")


async def backfill_football_team_logos(db) -> None:
    client = FootballAPIClient()
    data = await client.get_teams(league_id=39, season=2024)
    api_teams_by_name = {t["team"]["name"]: t["team"] for t in data["response"]}

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        print("Football: no 'football' sport row found, skipping")
        return

    teams = db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()

    matched: list[str] = []
    unmatched: list[str] = []

    async with httpx.AsyncClient() as http_client:
        for team in teams:
            api_name = FOOTBALL_TEAM_NAME_MAP.get(_normalize(team.name))
            api_team = api_teams_by_name.get(api_name) if api_name else None
            if not api_team:
                unmatched.append(team.name)
                continue

            resp = await http_client.get(api_team["logo"], timeout=30)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/png").split(";")[0]
            extension = content_type.split("/")[-1]

            team.logo_url = upload_team_logo(team.id, resp.content, content_type, extension)
            matched.append(team.name)

    db.commit()
    print(f"Football: uploaded logos for {len(matched)} teams: {matched}")
    print(f"Football: unmatched, left NULL for {len(unmatched)} teams: {unmatched}")


MAX_RETRY_DELAY_SECONDS = 8.0


async def _get_with_retry(http_client: httpx.AsyncClient, url: str, params: dict | None = None, retries: int = 3) -> httpx.Response:
    """GET a URL, retrying on 429 with capped backoff.

    Wikimedia's shared-IP rate limit applies to both the api.php lookups and
    the upload.wikimedia.org image downloads, so both call sites route through
    here. Retry-After is capped rather than trusted outright - a large
    server-supplied value would otherwise stall this whole (unattended,
    sequential) run on a single player. Better to skip a stubborn player fast
    and pick it up on a later re-run (the backfill is idempotent) than block
    for however long the server asks.
    """
    for attempt in range(retries):
        resp = await http_client.get(url, params=params)
        if resp.status_code != 429:
            resp.raise_for_status()
            return resp

        delay = min(float(resp.headers.get("retry-after", 2 ** attempt)), MAX_RETRY_DELAY_SECONDS)
        await asyncio.sleep(delay)

    resp.raise_for_status()  # exhausted retries — raise the last 429
    return resp


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _apply_sportsdb_enrichment(player: Player, c: dict) -> None:
    """Copy TheSportsDB's biographical fields onto a Player row."""
    player.nationality = c.get("strNationality") or player.nationality
    player.date_of_birth = _parse_date(c.get("dateBorn")) or player.date_of_birth
    player.height = c.get("strHeight") or player.height
    player.weight = c.get("strWeight") or player.weight
    player.bio = c.get("strDescriptionEN") or player.bio
    player.wage = c.get("strWage") or player.wage
    player.signing_fee = c.get("strSigning") or player.signing_fee
    player.date_signed = _parse_date(c.get("dateSigned")) or player.date_signed
    player.agent = c.get("strAgent") or player.agent

    number = c.get("strNumber")
    if number:
        try:
            player.jersey_number = int(number)
        except ValueError:
            pass

    social = dict(player.social_links or {})
    for key, field in [
        ("twitter", "strTwitter"), ("instagram", "strInstagram"),
        ("facebook", "strFacebook"), ("youtube", "strYoutube"),
        ("website", "strWebsite"),
    ]:
        value = c.get(field)
        if value:
            social[key] = value
    if social:
        player.social_links = social


async def backfill_football_player_photos_sportsdb(db, force: bool = False) -> None:
    """Per-player lookup via TheSportsDB, preferring the curated `strCutout` headshot.

    Primary photo source - run before backfill_football_player_photos
    (Wikipedia), which then only has to cover whatever this couldn't match.

    Uses searchplayers.php (one request per player, not the bulk
    lookup_all_players.php - that endpoint caps out at ~10 players per club
    on the free tier, nowhere near a full squad). strCutout is a curated,
    square, studio-style headshot - much more consistent than strThumb or a
    random Wikipedia infobox photo, which can be anything from a great
    photo-day headshot to an action shot where the player's face isn't even
    visible.

    searchplayers.php returns a single best-guess match per name query, no
    team filter available - for short/common names (e.g. a player literally
    named "Kevin") that guess can be an unrelated same-named player at a
    different club, or a different sport, or retired. Validated by comparing
    the result's idTeam against our club's known TheSportsDB id
    (SPORTSDB_TEAM_ID_MAP) - a wrong-person photo is worse than no photo, so
    mismatches are rejected rather than accepted. Clubs missing from that map
    (Nottingham Forest, test rows) are skipped entirely and left to the
    Wikipedia fallback.

    Also fills in the biographical enrichment fields on Player (nationality,
    date_of_birth, height, weight, jersey_number, bio, wage, signing_fee,
    date_signed, agent, social_links) from the same response - no extra API
    calls, this data comes back alongside the photo fields in one request.

    force=True re-checks every player regardless of existing data (for a
    full from-scratch redo); force=False (default) only attempts players
    still missing a photo or missing enrichment (nationality as the marker -
    it's set whenever a match succeeds, whether or not a photo was found).
    """
    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        print("Football: no 'football' sport row found, skipping")
        return

    teams = db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()

    matched: list[str] = []
    unmatched: list[str] = []

    async with httpx.AsyncClient(timeout=30) as http_client:
        for team in teams:
            expected_sportsdb_id = SPORTSDB_TEAM_ID_MAP.get(_normalize(team.name))
            if not expected_sportsdb_id:
                continue  # e.g. Nottingham Forest, or non-EPL rows

            query = db.query(Player).filter(Player.real_team_id == team.id)
            if not force:
                query = query.filter(
                    or_(Player.photo_url.is_(None), Player.nationality.is_(None))
                )
            players = query.all()

            for i, player in enumerate(players, start=1):
                try:
                    resp = await _get_with_retry(
                        http_client,
                        f"{SPORTSDB_API}/searchplayers.php",
                        params={"p": player.name},
                    )
                    candidates = resp.json().get("player") or []
                    candidate = None
                    for c in candidates:
                        if c.get("strSport") != "Soccer" or c.get("idTeam") != expected_sportsdb_id:
                            continue
                        candidate = c
                        break

                    if not candidate:
                        unmatched.append(player.name)
                        continue

                    _apply_sportsdb_enrichment(player, candidate)

                    image_url = candidate.get("strCutout") or candidate.get("strThumb")
                    if image_url:
                        img_resp = await _get_with_retry(http_client, image_url)
                        content_type = img_resp.headers.get("content-type", "image/png").split(";")[0]
                        extension = content_type.split("/")[-1]
                        player.photo_url = upload_player_photo(player.id, img_resp.content, content_type, extension)
                    matched.append(player.name)
                except httpx.HTTPError as e:
                    print(f"  skip {player.name}: {e}")
                    unmatched.append(player.name)

                await asyncio.sleep(0.3)

            db.commit()
            print(f"  ...{team.name}: {len(players)} processed")

    print(f"Football (TheSportsDB): uploaded photos for {len(matched)} players")
    print(f"Football (TheSportsDB): no match, left NULL for {len(unmatched)} players: {unmatched}")


async def _find_wikipedia_photo_url(http_client: httpx.AsyncClient, player_name: str) -> str | None:
    """Find a player's Wikipedia page by name and return their infobox photo URL, if any.

    Uses generator=search to resolve the search hit and its page image in a
    single request instead of two, to stay further under Wikipedia's rate limit.
    Requests a thumbnail rather than the full-resolution original - Wikimedia's
    own 429 response tells automated clients to do exactly this (see
    https://w.wiki/GHai), and a 500px thumbnail is plenty for an avatar anyway.
    """
    resp = await _get_with_retry(http_client, WIKIPEDIA_API, params={
        "action": "query",
        "generator": "search",
        "gsrsearch": f"{player_name} footballer",
        "gsrlimit": 1,
        "prop": "pageimages",
        "piprop": "thumbnail",
        "pithumbsize": 500,
        "format": "json",
    })
    pages = resp.json().get("query", {}).get("pages", {})
    for page in pages.values():
        thumbnail = page.get("thumbnail")
        if thumbnail:
            return thumbnail["source"]
    return None


async def backfill_football_player_photos(db, limit: int | None = None) -> None:
    """Find each football player's Wikipedia photo by name and re-host it in R2."""
    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        print("Football: no 'football' sport row found, skipping")
        return

    query = db.query(Player).filter(Player.sport_id == sport.id, Player.photo_url.is_(None))
    if limit:
        query = query.limit(limit)
    players = query.all()

    matched: list[str] = []
    unmatched: list[str] = []

    async with httpx.AsyncClient(headers={"User-Agent": WIKIPEDIA_USER_AGENT}, timeout=30) as http_client:
        for i, player in enumerate(players, start=1):
            try:
                image_url = await _find_wikipedia_photo_url(http_client, player.name)
                if not image_url:
                    unmatched.append(player.name)
                    continue

                resp = await _get_with_retry(http_client, image_url)
                content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
                extension = content_type.split("/")[-1]

                player.photo_url = upload_player_photo(player.id, resp.content, content_type, extension)
                matched.append(player.name)
            except httpx.HTTPError as e:
                print(f"  skip {player.name}: {e}")
                unmatched.append(player.name)

            # Commit every 25 players (not just at the end) - this loop is
            # slow (network + rate-limit backoff, easily 20-30 min for a full
            # roster), so a crash or timeout partway through shouldn't lose
            # everything found so far.
            if i % 25 == 0:
                db.commit()
                print(f"  ...progress: {i}/{len(players)} processed, {len(matched)} matched so far")

            await asyncio.sleep(0.5)  # ponytail: fixed delay + the 429 backoff in _wikipedia_get; swap for a proper rate limiter if this ever runs on a much bigger roster

    db.commit()
    print(f"Football: uploaded Wikipedia photos for {len(matched)} players")
    print(f"Football: no match, left NULL for {len(unmatched)} players: {unmatched}")


def sync_player_team_logos(db) -> None:
    """Copy each player's real team logo onto Player.real_team_logo_url.

    Denormalised on purpose (see the comment on the column in
    app/player/models.py) — avoids joinedload(Player.real_team_ref) at
    every existing query site that eager-loads Player.sport. Re-run this
    after any team logo changes.
    """
    result = db.execute(text("""
        UPDATE players p SET real_team_logo_url = rt.logo_url
        FROM real_teams rt WHERE p.real_team_id = rt.id AND rt.logo_url IS NOT NULL
    """))
    db.commit()
    print(f"Synced real_team_logo_url onto {result.rowcount} players")


def main() -> None:
    db = SessionLocal()
    try:
        backfill_basketball(db)
        asyncio.run(backfill_football_team_logos(db))
        asyncio.run(backfill_football_player_photos_sportsdb(db))
        asyncio.run(backfill_football_player_photos(db))
        sync_player_team_logos(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
