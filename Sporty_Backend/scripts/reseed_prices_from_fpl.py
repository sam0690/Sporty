"""One-time price re-seed for the Premier League pool from the official FPL API.

WHY
---
Repricing ran away in 2026-07 (see scripts/purge_dataset_import_stats.py for
the mechanism) and a cap backfill then clamped everything above the ceiling to
exactly 17.0, leaving 165 football players at an identical price. Elite and
fringe players became indistinguishable and no squad could be built under the
100.0 budget. The algorithm fixes stop it recurring; this script restores sane
absolute values to start from.

The game's economy is already on FPL's scale — `budget_per_team` is 100.00 and
`squad_size` is 15, exactly FPL's — so prices are copied through 1:1
(`now_cost / 10`) with no scaling or compression.

This is a ONE-OFF, not a scheduled sync: prices are owned by
`app/services/pricing/repricing.py` from here on. FPL is only the starting
point, which is also why no FPL id is stored — matching is done by name at run
time and then discarded.

WHAT IT WRITES
--------------
For each matched player:
  * `cost` = FPL `now_cost / 10`
  * `anchor_cost` = the same value — the fixed reference repricing may drift
    at most MAX_DRIFT_FROM_ANCHOR away from, which is what makes the ceiling
    pile-up structurally impossible rather than merely unlikely.
  * `real_team` / `real_team_id` when FPL reports a genuine club change
  * a `PlayerPriceHistory` row (algorithm_version="fpl_reseed_2026_08") so the
    movement is auditable exactly like organic repricing

Players in the EPL pool that FPL does not list are set `is_available=False`
(relegated-club squads and departed players). FPL players missing from our DB
are only REPORTED — creating them would produce players with no API-Football
`external_api_id`, which `football_live_sync._resolve_player` could never
resolve, so they would silently score zero all season.

Existing squads are unaffected: budgets are computed from
`TeamPlayer.cost_at_acquisition`, not live `Player.cost`.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/reseed_prices_from_fpl.py
    venv/bin/python scripts/reseed_prices_from_fpl.py --apply
"""
from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from pathlib import Path

import httpx

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, PlayerPriceHistory, RealTeam
from app.services.sync.name_matching import Candidate, NameIndex, normalize

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"

ALGORITHM_VERSION = "fpl_reseed_2026_08"

# FPL uses short broadcast names; our RealTeam rows use full club names. Same
# shape and purpose as _FDO_NAME_ALIASES in app/services/sync/match_sync.py.
# Without this, ~149 players look like they changed club when only a handful
# actually did.
FPL_TEAM_ALIASES = {
    "Spurs": "Tottenham Hotspur",
    "Man City": "Manchester City",
    "Man Utd": "Manchester United",
    "Nott'm Forest": "Nottingham Forest",
    "Newcastle": "Newcastle United",
    "Leeds": "Leeds United",
    "Wolves": "Wolverhampton Wanderers",
    "Brighton": "Brighton & Hove Albion",
    "West Ham": "West Ham United",
    "Sheffield Utd": "Sheffield United",
    "Luton": "Luton Town",
    "Ipswich": "Ipswich Town",
    "Hull": "Hull City",
    "Coventry": "Coventry City",
    "Norwich": "Norwich City",
    "Leicester": "Leicester City",
    "Stoke": "Stoke City",
    "Cardiff": "Cardiff City",
    "Swansea": "Swansea City",
    "Birmingham": "Birmingham City",
}


def fetch_bootstrap() -> dict:
    # Public endpoint, no key. Deliberately NOT routed through
    # FootballAPIClient: this is not API-Football and must not consume that
    # client's daily request budget.
    response = httpx.get(
        FPL_BOOTSTRAP_URL,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0 (compatible; sporty-reseed/1.0)"},
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the changes. Without this the script only reports.",
    )
    args = parser.parse_args()

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
    print(f"FPL elements: {len(elements)}  clubs: {len(fpl_teams)}")

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()

        # The EPL pool, plus players whose club carries no competition tag —
        # that is where relegated clubs land, and they are still buyable today.
        players = (
            db.query(Player)
            .join(RealTeam, RealTeam.id == Player.real_team_id)
            .filter(
                Player.sport_id == sport.id,
                RealTeam.competition.in_(["EPL"]) | RealTeam.competition.is_(None),
            )
            .all()
        )
        print(f"DB pool considered (EPL + untagged): {len(players)}")

        clubs_by_name = {
            normalize(team.name): team
            for team in db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()
        }

        history_rows: list[PlayerPriceHistory] = []
        repriced = 0
        transferred = 0
        deactivated = 0
        unresolved_clubs: list[str] = []
        matched_codes: set[int] = set()

        for player in players:
            element = index.match(player.name, club=player.real_team)
            if element is None:
                if player.is_available:
                    player.is_available = False
                    deactivated += 1
                continue

            matched_codes.add(element["code"])

            new_cost = (Decimal(element["now_cost"]) / Decimal("10")).quantize(
                Decimal("0.01")
            )
            if new_cost != player.cost:
                history_rows.append(
                    PlayerPriceHistory(
                        player_id=player.id,
                        transfer_window_id=None,
                        old_cost=player.cost,
                        new_cost=new_cost,
                        delta=new_cost - player.cost,
                        algorithm_version=ALGORITHM_VERSION,
                    )
                )
                player.cost = new_cost
                repriced += 1

            # Anchor every matched player, including ones already at the right
            # price — the bound is what stops the next ratchet, not the reprice.
            player.anchor_cost = new_cost

            if not player.is_available:
                player.is_available = True

            fpl_club = fpl_teams[element["team"]]
            target_name = FPL_TEAM_ALIASES.get(fpl_club, fpl_club)
            if normalize(target_name) != normalize(player.real_team or ""):
                target = clubs_by_name.get(normalize(target_name))
                if target is None:
                    # Never auto-create: a new RealTeam gets competition=NULL,
                    # which silently drops its players out of every
                    # competition-scoped pool (app/league/competition_scope.py).
                    unresolved_clubs.append(f"{player.name}: {player.real_team} -> {target_name}")
                    continue
                print(f"  transfer: {player.name}: {player.real_team} -> {target.name}")
                player.real_team = target.name
                player.real_team_id = target.id
                transferred += 1

        missing = [e for e in elements if e["code"] not in matched_codes]

        print(f"\nRepriced           : {repriced}")
        print(f"Club transfers     : {transferred}")
        print(f"Deactivated        : {deactivated}")
        print(f"Unmatched in FPL   : {len(missing)} (reported only, not created)")

        if unresolved_clubs:
            print(f"\nUnresolved clubs ({len(unresolved_clubs)}) — left on current club:")
            for line in unresolved_clubs[:20]:
                print(f"  {line}")

        if missing:
            print("\nFPL players absent from our DB (need a roster sync):")
            for element in missing[:25]:
                print(
                    f"  {element['web_name']:<20} {fpl_teams[element['team']]:<20} "
                    f"{element['now_cost'] / 10}"
                )
            if len(missing) > 25:
                print(f"  ... and {len(missing) - 25} more")

        if not args.apply:
            db.rollback()
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        if history_rows:
            db.add_all(history_rows)
        db.commit()
        print(f"\nCommitted. {len(history_rows)} price-history row(s) written.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
