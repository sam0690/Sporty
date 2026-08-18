"""Bring player photos up to the FotMob/FPL studio-headshot standard.

WHY
---
The pool's photos came from a three-tier waterfall in
scripts/backfill_player_team_images.py: TheSportsDB `strCutout` (a curated,
square, transparent studio headshot — the look we want), then a Wikipedia page
image, then API-Football's `photo`. Its TheSportsDB club-validation map covered
only the 20 EPL clubs, so everything outside the Premier League fell straight
through to the lower tiers. Measured on 2026-08-18, 1,688 of 2,096 football
players (81%) were off-standard — La Liga and Bundesliga were 100% off — and
the pool mixed 500px transparent cutouts with match-action JPEGs, soft 150px
thumbnails, and API-Football's grey "no photo" silhouette.

WHAT IT DOES
------------
Audits every football photo by its bytes (app/services/media/photo_quality.py),
then re-sources the ones that fail:

  1. EPL   -> Fantasy Premier League's official headshot, keyed by the FPL
              element `code` stored in Player.fpl_code. 500x500 transparent
              PNG, uniform crop, plain background — the reference standard.
  2. other -> TheSportsDB `strCutout`, accepted ONLY when the candidate is a
              Soccer player AND its club id matches the club we have them at.
              A wrong-person photo is worse than a dated one.
  3. none  -> if what's there now is a grey silhouette or an action shot, the
              photo is CLEARED so the frontend renders its styled initials
              chip (PlayerAvatar.tsx). A blank is more consistent than a
              stranger's stock avatar sitting beside real headshots.

Every fetched image is re-graded with the same classifier before it is
uploaded, so the script can never trade one bad photo for another.

Replacement, not duplication: upload_player_photo() keys the R2 object on the
player id, so `player-photos/{uuid}.png` is overwritten in place. Naming,
format and extension are therefore uniform by construction.

Basketball is deliberately untouched: cdn.nba.com serves the NBA's own uniform
1040x760 studio headshots for all 582 players.

RUN IT
------
    venv/bin/python scripts/refresh_player_photos.py --audit
    venv/bin/python scripts/refresh_player_photos.py --match-fpl            # dry run
    venv/bin/python scripts/refresh_player_photos.py --match-fpl --apply
    venv/bin/python scripts/refresh_player_photos.py --competition EPL --limit 25 --apply

Run scripts/fix_html_entities_in_names.py FIRST: mojibake names (the pool still
holds e.g. "O. HÃ¸jlund") silently fail both name matches.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
import time
from collections import Counter
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.media.photo_quality import (
    HEADER_BYTES,
    MISSING,
    OK,
    UNREACHABLE,
    classify,
    is_acceptable,
)
from app.services.storage_service import upload_player_photo
from app.services.sync.name_matching import Candidate, NameIndex, normalize
from scripts.backfill_player_team_images import SPORTSDB_TEAM_ID_MAP
from scripts.reseed_prices_from_fpl import FPL_TEAM_ALIASES, fetch_bootstrap

USER_AGENT = "Mozilla/5.0 (compatible; sporty-photos/1.0)"

# FPL publishes the same headshot at several sizes; 250x250 is the path segment
# but the object served is the full 500x500 master, which is what we want.
FPL_PHOTO_URL = "https://resources.premierleague.com/premierleague/photos/players/250x250/p{code}.png"

SPORTSDB_API = "https://www.thesportsdb.com/api/v1/json/3"

# Our RealTeam.competition values map to more than one TheSportsDB league:
# the pool carries second-tier clubs (Hull City, Hamburger SV, Malaga) under
# the same competition label as the top flight.
SPORTSDB_LEAGUES = {
    "EPL": ["English Premier League", "English League Championship"],
    "LALIGA": ["Spanish La Liga", "Spanish Segunda Division"],
    "BUNDESLIGA": ["German Bundesliga", "German 2. Bundesliga"],
}

# Clubs whose id must NOT be discovered by search, keyed on normalize()d name.
# None means "known-unresolvable, skip these players": TheSportsDB's search
# returns Deportivo *Fabril* — La Coruna's reserve side, in Primera RFEF — as
# the only Soccer candidate for the senior club, and validating a first-team
# squad against a reserve-team roster is exactly the wrong-person risk the
# club check exists to prevent. Its 31 players keep their current photos until
# someone supplies the senior side's real id here.
SPORTSDB_CLUB_ID_PINS: dict[str, str | None] = {
    "deportivo la coruna": None,
}

# TheSportsDB's free tier truncates search_all_teams.php to 10 clubs per
# league, and its per-club search is unreliable on formal names: "Hamburger SV"
# returns nothing (it indexes "Hamburg") and "Deportivo La Coruna" resolves to
# Deportivo Fabril, the B team. Only clubs that actually failed resolution are
# pinned here — the script prints anything still unresolved rather than
# guessing, and players at an unresolved club are skipped, never loose-matched.
SPORTSDB_CLUB_QUERY_OVERRIDES = {
    # Keys are normalize()d club names, which means NO DIGITS — normalize()
    # folds "FC Schalke 04" to "fc schalke". Writing the number in a key here
    # makes it unreachable.
    "hamburger sv": "Hamburg",
    "fc schalke": "Schalke 04",
    "vfb stuttgart": "Stuttgart",
    "bayern munchen": "Bayern Munich",
    "borussia monchengladbach": "Borussia Monchengladbach",
    "athletic club": "Athletic Bilbao",
    "alaves": "Deportivo Alaves",
    "fsv mainz": "Mainz",
    "sc paderborn": "Paderborn",
    "sv elversberg": "Elversberg",
    "fc koln": "FC Koln",
    "sc freiburg": "Freiburg",
    "racing santander": "Racing de Santander",
    # Guards against a B team: a bare "Deportivo La Coruna" search returns
    # Deportivo Fabril, their reserve side, as the sole Soccer candidate.
    "deportivo la coruna": "Deportivo La Coruna",
}

# TheSportsDB's free tier is unmetered but fragile under bursts; the audit
# fetches only 2KB per image from R2 and can go wide, the provider calls stay
# sequential.
AUDIT_CONCURRENCY = 8
SPORTSDB_DELAY_SECONDS = 1.1
MAX_RETRY_DELAY_SECONDS = 8.0


# --------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------

async def _probe(client: httpx.AsyncClient, url: str) -> tuple[bytes, int] | None:
    """Fetch just enough of an image to grade it, or None if unreadable.

    Retries once: probing runs wide, and immediately after a bulk upload the
    CDN will refuse a burst. A blip here used to be indistinguishable from
    "this player has no photo", which silently turned 117 good photos into a
    reported data loss.
    """
    for attempt in range(2):
        try:
            response = await client.get(
                url, headers={"Range": f"bytes=0-{HEADER_BYTES - 1}"}, timeout=30
            )
            if response.status_code < 400:
                # 206 reports the full size in Content-Range; a server that
                # ignored the Range header sent everything, so len() is true.
                content_range = response.headers.get("content-range", "")
                total = (
                    int(content_range.rsplit("/", 1)[-1])
                    if "/" in content_range
                    else len(response.content)
                )
                return response.content, total
        except (httpx.HTTPError, ValueError):
            pass
        if attempt == 0:
            await asyncio.sleep(2)
    return None


async def audit(rows: list[tuple]) -> dict:
    """Grade every player's current photo. Returns {player_id: grade}."""
    semaphore = asyncio.Semaphore(AUDIT_CONCURRENCY)
    grades: dict = {}

    async def one(player_id, url):
        if not url:
            grades[player_id] = MISSING
            return
        async with semaphore:
            probed = await _probe(client, url)
        grades[player_id] = UNREACHABLE if probed is None else classify(*probed)

    async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        await asyncio.gather(*(one(r[0], r[2]) for r in rows))

    return grades


def print_audit(rows: list[tuple], grades: dict) -> None:
    by_grade = Counter(grades.values())
    total = len(rows)
    print(f"\n  {'grade':<14}{'count':>7}   share")
    for grade, count in by_grade.most_common():
        print(f"  {grade:<14}{count:>7}   {100 * count / total:5.1f}%")

    per_competition: dict[str, Counter] = {}
    for player_id, _name, _url, _code, _club, competition in rows:
        bucket = per_competition.setdefault(competition or "(none)", Counter())
        bucket["total"] += 1
        if grades.get(player_id) != OK:
            bucket["flagged"] += 1

    print(f"\n  {'competition':<16}{'total':>7}{'flagged':>9}")
    for competition, bucket in sorted(per_competition.items(), key=lambda kv: -kv[1]["total"]):
        print(f"  {competition:<16}{bucket['total']:>7}{bucket['flagged']:>9}")
    print(f"\n  conforming: {by_grade[OK]} / {total}")


def write_csv(rows: list[tuple], grades: dict, path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["player_id", "name", "club", "competition", "grade", "photo_url"])
        for player_id, name, url, _code, club, competition in rows:
            writer.writerow([player_id, name, club, competition or "", grades.get(player_id, MISSING), url or ""])
    print(f"  wrote {path}")


# --------------------------------------------------------------------------
# FPL id matching
# --------------------------------------------------------------------------

def match_fpl(db, apply: bool) -> None:
    """Populate Player.fpl_code by name-matching against bootstrap-static.

    Done once so that every later photo refresh is an id lookup. Reuses the
    same NameIndex that reseed_prices_from_fpl.py matches prices with — its
    rules (punctuation folding, initial-prefix given names, club only as a
    tie-breaker) were each written against a real production mismatch.
    """
    payload = fetch_bootstrap()
    elements = payload["elements"]
    fpl_teams = {team["id"]: team["name"] for team in payload["teams"]}

    def club_of(element: dict) -> str:
        club = fpl_teams[element["team"]]
        return FPL_TEAM_ALIASES.get(club, club)

    index = NameIndex.build(
        Candidate.build(
            given=element["first_name"],
            family=element["second_name"],
            short=element["web_name"],
            club=club_of(element),
            payload=element,
        )
        for element in elements
    )

    sport = db.query(Sport).filter(Sport.name == "football").one()
    players = (
        db.query(Player)
        .join(RealTeam, RealTeam.id == Player.real_team_id)
        .filter(Player.sport_id == sport.id, RealTeam.competition == "EPL")
        .all()
    )

    matched = 0
    for player in players:
        element = index.match(player.name, club=player.real_team)
        if element is None:
            continue
        matched += 1
        if apply:
            player.fpl_code = element["code"]

    # Coverage is measured against FPL's roster, NOT ours. Our EPL pool runs
    # ~180 players larger because API-Football lists academy squads that FPL
    # never registers, so scoring against our own count understates the match
    # rate by ~20 points and reads as a failure when nothing is wrong. Those
    # extras simply have no FPL photo and fall through to the TheSportsDB tier.
    print(f"FPL elements       : {len(elements)}")
    print(f"EPL players (ours) : {len(players)}")
    print(f"Matched            : {matched}  ({100 * matched / max(len(elements), 1):.1f}% of FPL's roster,"
          f" {100 * matched / max(len(players), 1):.1f}% of ours)")
    print(f"No FPL entry       : {len(players) - matched} (academy/departed — TheSportsDB tier handles these)")

    if apply:
        db.commit()
        print("fpl_code written.")
    else:
        print("Dry run — pass --apply to write fpl_code.")


# --------------------------------------------------------------------------
# TheSportsDB club resolution
# --------------------------------------------------------------------------

def _sportsdb_get(client: httpx.Client, path: str, params: dict) -> dict:
    """GET TheSportsDB, retrying a 429 with capped backoff.

    The cap matters because this runs unattended over ~1,200 players: a large
    server-supplied Retry-After would otherwise stall the whole run on one
    player. Skipping fast is fine — the script is idempotent and re-runnable.
    """
    for attempt in range(3):
        try:
            response = client.get(f"{SPORTSDB_API}/{path}", params=params, timeout=30)
        except httpx.HTTPError:
            time.sleep(MAX_RETRY_DELAY_SECONDS)
            continue

        if response.status_code == 429:
            time.sleep(min(float(response.headers.get("retry-after", 2**attempt)), MAX_RETRY_DELAY_SECONDS))
            continue

        try:
            return response.json() or {}
        except ValueError:
            # Under sustained load TheSportsDB serves an HTML throttle page
            # with a 200, so .json() raises. Treating that as fatal would kill
            # a 40-minute unattended run on one bad response; an empty result
            # just means "no candidate", which is already the safe outcome.
            time.sleep(MAX_RETRY_DELAY_SECONDS)
    return {}


# Committed rather than treated as a throwaway cache: these ids are stable,
# they gate player identity, and re-deriving them goes through the flaky
# search path that this file exists to avoid.
CLUB_CACHE_PATH = Path(__file__).with_name("sportsdb_club_ids.json")


def resolve_clubs(client: httpx.Client, clubs: list[RealTeam]) -> dict[str, str]:
    """Map our club name -> TheSportsDB idTeam, for match validation.

    Cached to disk because TheSportsDB answers a burst with an empty 200
    instead of a 429: resolving all 58 clubs in one pass leaves ~3 of them
    spuriously unresolved, and a DIFFERENT 3 on the next run. Caching means
    each club is only ever asked for once, transient failures heal on the next
    run, and re-runs cost zero provider calls. Delete the cache file to force
    a full re-resolve after a club rename.
    """
    cached: dict[str, str] = {}
    if CLUB_CACHE_PATH.exists():
        cached = json.loads(CLUB_CACHE_PATH.read_text())

    # The 20 EPL club ids were already established by
    # backfill_player_team_images.py — reuse them rather than re-deriving.
    # Some genuinely cannot be re-derived: TheSportsDB's searchteams.php
    # returns nothing at all for "Nottingham Forest", and the free tier
    # truncates league listings to 10 clubs, so they are unreachable by search.
    for club in clubs:
        if club.name not in cached:
            seeded = SPORTSDB_TEAM_ID_MAP.get(normalize(club.name))
            if seeded:
                cached[club.name] = seeded

    blocked = {name for name in SPORTSDB_CLUB_ID_PINS if SPORTSDB_CLUB_ID_PINS[name] is None}
    for club in clubs:
        key = normalize(club.name)
        if key in SPORTSDB_CLUB_ID_PINS and SPORTSDB_CLUB_ID_PINS[key] is not None:
            cached[club.name] = SPORTSDB_CLUB_ID_PINS[key]

    pending = [
        c for c in clubs
        if c.name not in cached and normalize(c.name) not in blocked
    ]
    skipped = sorted(c.name for c in clubs if normalize(c.name) in blocked)
    if skipped:
        print(f"Clubs pinned unresolvable: {', '.join(skipped)} (players skipped)")
    if not pending:
        CLUB_CACHE_PATH.write_text(json.dumps(cached, indent=2, sort_keys=True))
        # Count only the clubs this run actually needs — the cache spans every
        # competition, so len(cached) against a single-competition run reads
        # as nonsense ("57 / 20").
        have = sum(1 for c in clubs if c.name in cached)
        print(f"Clubs resolved     : {have} / {len(clubs)} (all cached)")
        return cached

    listed: dict[str, str] = {}
    for league in {name for club in pending for name in SPORTSDB_LEAGUES.get(club.competition or "", [])}:
        data = _sportsdb_get(client, "search_all_teams.php", {"l": league})
        for team in data.get("teams") or []:
            listed[normalize(team["strTeam"])] = team["idTeam"]
        time.sleep(SPORTSDB_DELAY_SECONDS)

    resolved: dict[str, str] = dict(cached)
    unresolved: list[str] = []
    for club in pending:
        key = normalize(club.name)
        if key in listed:
            resolved[club.name] = listed[key]
            continue

        query = SPORTSDB_CLUB_QUERY_OVERRIDES.get(key, club.name)

        # TheSportsDB answers a burst with an empty 200 rather than a 429, so
        # _sportsdb_get's retry never fires and a perfectly resolvable club
        # (Werder Bremen, Stuttgart) looks unresolvable. One slower retry
        # settles it; club ids are cheap to get right and expensive to guess.
        candidates: list[dict] = []
        for attempt in range(2):
            data = _sportsdb_get(client, "searchteams.php", {"t": query})
            candidates = [t for t in (data.get("teams") or []) if t.get("strSport") == "Soccer"]
            time.sleep(SPORTSDB_DELAY_SECONDS * (1 + attempt * 2))
            if candidates:
                break

        # Exactly one, or we don't know which — an ambiguous club would let a
        # wrong-club player through the only check that guards identity.
        if len(candidates) == 1:
            resolved[club.name] = candidates[0]["idTeam"]
        else:
            unresolved.append(f"{club.name} (query={query!r}, candidates={len(candidates)})")

    CLUB_CACHE_PATH.write_text(json.dumps(resolved, indent=2, sort_keys=True))

    print(f"Clubs resolved     : {len(resolved)} / {len(clubs)}")
    if unresolved:
        print(f"UNRESOLVED clubs ({len(unresolved)}) — players skipped this run,"
              f" retried on the next one:")
        for line in unresolved:
            print(f"  {line}")
    return resolved


# --------------------------------------------------------------------------
# Sourcing
# --------------------------------------------------------------------------

def fetch_image(client: httpx.Client, url: str) -> bytes | None:
    """Download an image and return its bytes only if it grades OK."""
    try:
        response = client.get(url, timeout=45, follow_redirects=True)
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None

    content = response.content
    # The accept guard. Without it a 404 HTML page, a soft thumbnail or a
    # placeholder silhouette would be uploaded over a photo that was no worse.
    if not is_acceptable(content[:HEADER_BYTES], len(content)):
        return None
    return content


def source_from_fpl(client: httpx.Client, player: Player) -> bytes | None:
    """FPL's official headshot, or None if they don't have one.

    FPL's CDN answers a missing photo with 403 and a 243-byte body, not 404 —
    verified against five codes. It is not a header or auth problem (a browser
    User-Agent and Referer make no difference), so a 403 means "no photo" and
    the player should fall through to TheSportsDB, not be retried.
    """
    if not player.fpl_code:
        return None
    return fetch_image(client, FPL_PHOTO_URL.format(code=player.fpl_code))


def source_from_sportsdb(client: httpx.Client, player: Player, club_id: str | None) -> bytes | None:
    if not club_id:
        return None

    data = _sportsdb_get(client, "searchplayers.php", {"p": player.name})
    time.sleep(SPORTSDB_DELAY_SECONDS)

    for candidate in data.get("player") or []:
        # Both conditions are load-bearing. Sport alone lets a namesake in;
        # club alone lets a different sport's player in. TheSportsDB club data
        # also goes stale, which is why a mismatch is a reject rather than a
        # fallback — being short a photo beats showing the wrong face.
        if candidate.get("strSport") != "Soccer" or candidate.get("idTeam") != club_id:
            continue
        cutout = candidate.get("strCutout")
        if cutout:
            return fetch_image(client, cutout)
    return None


def refresh(db, rows: list[tuple], grades: dict, apply: bool, limit: int | None) -> None:
    flagged = [r for r in rows if grades.get(r[0]) != OK]
    if limit:
        flagged = flagged[:limit]
    print(f"\nFlagged for replacement: {len(flagged)}")

    players = {p.id: p for p in db.query(Player).filter(Player.id.in_([r[0] for r in flagged])).all()}
    club_names = sorted({r[4] for r in flagged})
    clubs = db.query(RealTeam).filter(RealTeam.name.in_(club_names)).all()

    stats = Counter()
    with httpx.Client(headers={"User-Agent": USER_AGENT}) as client:
        club_ids = resolve_clubs(client, clubs)

        for position, (player_id, name, _url, _code, club, _competition) in enumerate(flagged, 1):
            player = players[player_id]

            content = source_from_fpl(client, player)
            source = "fpl"
            if content is None:
                content = source_from_sportsdb(client, player, club_ids.get(club))
                source = "sportsdb"

            if content is not None:
                stats[source] += 1
                if apply:
                    player.photo_url = upload_player_photo(player.id, content, "image/png", "png")
                print(f"  [{position}/{len(flagged)}] {source:9s} {name} ({club})")
            elif grades[player_id] in ("placeholder", "action"):
                # Nothing better exists and what's there misrepresents the
                # player; the initials fallback is the honest render.
                stats["cleared"] += 1
                if apply:
                    player.photo_url = None
            else:
                stats["kept"] += 1

            if apply and position % 25 == 0:
                db.commit()

    if apply:
        db.commit()

    print("\nResult:")
    for key in ("fpl", "sportsdb", "cleared", "kept"):
        print(f"  {key:<10}{stats[key]:>6}")
    if not apply:
        print("\nDry run — nothing written. Pass --apply.")


# --------------------------------------------------------------------------

def load_rows(db, competition: str | None) -> list[tuple]:
    sport = db.query(Sport).filter(Sport.name == "football").one()
    query = (
        db.query(Player.id, Player.name, Player.photo_url, Player.fpl_code, RealTeam.name, RealTeam.competition)
        .join(RealTeam, RealTeam.id == Player.real_team_id)
        .filter(Player.sport_id == sport.id)
    )
    if competition:
        query = query.filter(RealTeam.competition == competition)
    return query.order_by(RealTeam.competition, Player.name).all()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--audit", action="store_true", help="Grade current photos and stop.")
    parser.add_argument("--match-fpl", action="store_true", help="Populate Player.fpl_code from bootstrap-static.")
    parser.add_argument("--apply", action="store_true", help="Write changes. Without it the script only reports.")
    parser.add_argument("--competition", choices=sorted(SPORTSDB_LEAGUES), help="Restrict to one competition.")
    parser.add_argument("--limit", type=int, help="Cap how many players are re-sourced in this run.")
    parser.add_argument("--force", action="store_true", help="Re-source conforming photos too.")
    parser.add_argument("--csv", type=Path, help="Write the per-player audit to this file.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.match_fpl:
            match_fpl(db, apply=args.apply)
            return 0

        rows = load_rows(db, args.competition)
        print(f"Football players   : {len(rows)}")

        grades = asyncio.run(audit(rows))
        print_audit(rows, grades)
        if args.csv:
            write_csv(rows, grades, args.csv)

        if args.audit:
            return 0

        if args.force:
            grades = {player_id: MISSING for player_id in grades}

        refresh(db, rows, grades, apply=args.apply, limit=args.limit)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
