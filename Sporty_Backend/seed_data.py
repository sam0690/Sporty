"""Seed realistic demo data for Sporty.

Usage:
    python seed_data.py

What this script seeds:
- Sports (football, basketball, cricket) if missing
- Seasons (per sport) with exactly one active season globally
- Team catalogs per sport (stored via Player.real_team string)
- 66 players total (22 per sport) with realistic positions and tiered pricing
- Optional PlayerSeason rows if app.player.models.PlayerSeason exists

Notes:
- Current schema has no dedicated Team table, so teams are represented by
  Player.real_team.
- The script is idempotent for seeded records by using deterministic
  external_api_id values (seed:<sport>:<index>).
- Commits exactly once at the end.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import random
from typing import Any

from sqlalchemy.orm import Session

# Import all models so string-based relationships resolve safely.
from app.auth.models import RefreshToken, User  # noqa: F401
from app.database import SessionLocal
from app.league.models import (  # noqa: F401
    FantasyTeam,
    League,
    LeagueMembership,
    LeagueSport,
    LineupSlot,
    Season,
    Sport,
    TeamGameweekLineup,
    TeamPlayer,
    TeamWeeklyScore,
    Transfer,
    TransferWindow,
)
from app.match.models import Match  # noqa: F401
from app.player.models import CricketStat, FootballStat, Player, PlayerGameweekStat  # noqa: F401
from app.player.models_nba import NBAStat  # noqa: F401
from app.scoring.models import DefaultScoringRule, LeagueScoringOverride  # noqa: F401


SEED = 20260406
TOTAL_PLAYERS_PER_SPORT = 22
ACTIVE_SEASON = ("football", "2025/26")

SEASON_DEFS = [
    ("2023/24", date(2023, 8, 1), date(2024, 5, 31)),
    ("2024/25", date(2024, 8, 1), date(2025, 5, 31)),
    ("2025/26", date(2025, 8, 1), date(2026, 5, 31)),
]

SPORTS = [
    ("football", "Football"),
    ("basketball", "Basketball"),
    ("cricket", "Cricket"),
]

TEAM_CATALOG = {
    "football": [
        "Northbridge FC",
        "Riverside Athletic",
        "Kingsport United",
    ],
    "basketball": [
        "Metro City Titans",
        "Harbor Heat",
        "Summit Hawks",
    ],
    "cricket": [
        "Royal Strikers",
        "Capital Chargers",
        "Coastal Warriors",
    ],
}

POSITION_POOL = {
    "football": ["GKP", "DEF", "MID", "FWD"],
    "basketball": ["PG", "SG", "SF", "PF", "C"],
    "cricket": ["BAT", "BOWL", "AR", "WK"],
}

FIRST_NAMES = {
    "football": [
        "Luca", "Mateo", "Ethan", "Noah", "Adrian", "Rafael", "Kai", "Milan",
        "Jonah", "Felix", "Leo", "Arjun", "Ibrahim", "Nico", "Hugo", "Dario",
    ],
    "basketball": [
        "Jalen", "Marcus", "Derrick", "Tobias", "Andre", "Malik", "Jordan", "Caleb",
        "Xavier", "Trevor", "Devin", "Quentin", "Avery", "Tyrese", "Isaiah", "Jamal",
    ],
    "cricket": [
        "Rohan", "Ayaan", "Kabir", "Ishan", "Pranav", "Vikram", "Arnav", "Dev",
        "Kiran", "Rahul", "Nikhil", "Samar", "Zayan", "Farhan", "Adil", "Rehan",
    ],
}

LAST_NAMES = {
    "football": [
        "Santos", "Morrison", "Petrov", "Alvarez", "Bennett", "Silva", "Costa", "Nwosu",
        "Fischer", "Romero", "Navarro", "Keller", "Haddad", "Pereira", "Ibrahim", "Mendez",
    ],
    "basketball": [
        "Carter", "Thompson", "Brooks", "Mitchell", "Dawson", "Hayes", "Turner", "Wallace",
        "Hughes", "Bennett", "Foster", "Reed", "Mason", "Coleman", "Bishop", "Parker",
    ],
    "cricket": [
        "Sharma", "Patel", "Kapoor", "Rao", "Kulkarni", "Mehta", "Reddy", "Chopra",
        "Bose", "Qureshi", "Siddiqui", "Malhotra", "Desai", "Agarwal", "Khan", "Nair",
    ],
}


@dataclass
class PlayerTierConfig:
    price_low: Decimal
    price_high: Decimal
    points_low: int
    points_high: int
    form_low: Decimal
    form_high: Decimal
    ownership_low: Decimal
    ownership_high: Decimal


TIER_CONFIG = {
    "star": PlayerTierConfig(
        price_low=Decimal("10.0"),
        price_high=Decimal("12.0"),
        points_low=190,
        points_high=300,
        form_low=Decimal("7.2"),
        form_high=Decimal("10.0"),
        ownership_low=Decimal("35.0"),
        ownership_high=Decimal("68.0"),
    ),
    "mid": PlayerTierConfig(
        price_low=Decimal("7.0"),
        price_high=Decimal("9.0"),
        points_low=95,
        points_high=185,
        form_low=Decimal("5.0"),
        form_high=Decimal("7.8"),
        ownership_low=Decimal("12.0"),
        ownership_high=Decimal("42.0"),
    ),
    "budget": PlayerTierConfig(
        price_low=Decimal("4.0"),
        price_high=Decimal("6.0"),
        points_low=35,
        points_high=110,
        form_low=Decimal("3.0"),
        form_high=Decimal("6.0"),
        ownership_low=Decimal("2.0"),
        ownership_high=Decimal("25.0"),
    ),
}


def _quantize_1(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _pick_tier(rng: random.Random) -> str:
    roll = rng.random()
    if roll < 0.2:
        return "star"
    if roll < 0.7:
        return "mid"
    return "budget"


def _rand_decimal(rng: random.Random, low: Decimal, high: Decimal) -> Decimal:
    low_i = int(low * 10)
    high_i = int(high * 10)
    return Decimal(rng.randint(low_i, high_i)) / Decimal("10")


def _stat_line_for_season(
    *,
    tier: str,
    season_idx: int,
    rng: random.Random,
) -> dict[str, Decimal | int]:
    cfg = TIER_CONFIG[tier]

    # Slight year-to-year progression/decline.
    trend = rng.choice([-1, 0, 1])
    seasonal_points_shift = trend * season_idx * rng.randint(4, 12)

    total_points = max(0, rng.randint(cfg.points_low, cfg.points_high) + seasonal_points_shift)
    current_price = _quantize_1(
        _rand_decimal(rng, cfg.price_low, cfg.price_high) + Decimal(trend) * Decimal("0.2") * season_idx
    )
    form_score = _quantize_1(
        _rand_decimal(rng, cfg.form_low, cfg.form_high) + Decimal(trend) * Decimal("0.1")
    )
    ownership_percentage = _quantize_1(
        max(
            Decimal("0.5"),
            min(
                Decimal("95.0"),
                _rand_decimal(rng, cfg.ownership_low, cfg.ownership_high) + Decimal(trend) * Decimal("0.8"),
            ),
        )
    )

    return {
        "current_price": max(Decimal("4.0"), current_price),
        "total_points": total_points,
        "form_score": max(Decimal("1.0"), form_score),
        "ownership_percentage": ownership_percentage,
    }


def create_sports(db: Session) -> dict[str, Sport]:
    by_name: dict[str, Sport] = {
        sport.name: sport for sport in db.query(Sport).all()
    }

    for name, display_name in SPORTS:
        if name in by_name:
            continue
        sport = Sport(name=name, display_name=display_name, is_active=True)
        db.add(sport)
        by_name[name] = sport

    db.flush()
    return by_name


def create_seasons(db: Session, sports: dict[str, Sport]) -> dict[tuple[str, str], Season]:
    seasons_by_key: dict[tuple[str, str], Season] = {}

    # Enforce global invariant: exactly one active season record.
    db.query(Season).update({Season.is_active: False}, synchronize_session=False)

    for sport_name, sport in sports.items():
        for season_name, start_date, end_date in SEASON_DEFS:
            season = (
                db.query(Season)
                .filter(Season.sport_id == sport.id, Season.name == season_name)
                .first()
            )
            is_active = (sport_name, season_name) == ACTIVE_SEASON

            if season:
                season.start_date = start_date
                season.end_date = end_date
                season.is_active = is_active
            else:
                season = Season(
                    sport_id=sport.id,
                    name=season_name,
                    start_date=start_date,
                    end_date=end_date,
                    is_active=is_active,
                )
                db.add(season)

            seasons_by_key[(sport_name, season_name)] = season

    db.flush()
    return seasons_by_key


def create_team_catalog() -> dict[str, list[str]]:
    # No Team table currently; use these names through Player.real_team.
    return TEAM_CATALOG


def _build_player_name(
    *,
    sport_name: str,
    index: int,
    rng: random.Random,
    used_names: set[tuple[str, str]],
) -> str:
    first_pool = FIRST_NAMES[sport_name]
    last_pool = LAST_NAMES[sport_name]

    attempts = 0
    while attempts < 20:
        name = f"{rng.choice(first_pool)} {rng.choice(last_pool)}"
        key = (sport_name, name)
        if key not in used_names:
            used_names.add(key)
            return name
        attempts += 1

    # Guaranteed fallback uniqueness for edge cases.
    name = f"{first_pool[index % len(first_pool)]} {last_pool[index % len(last_pool)]} {index + 1}"
    used_names.add((sport_name, name))
    return name


def create_players(
    db: Session,
    sports: dict[str, Sport],
    teams_by_sport: dict[str, list[str]],
    seasons_by_key: dict[tuple[str, str], Season],
) -> tuple[int, int]:
    rng = random.Random(SEED)

    desired_external_ids: list[str] = []
    for sport_name in sports:
        for idx in range(1, TOTAL_PLAYERS_PER_SPORT + 1):
            desired_external_ids.append(f"seed:{sport_name}:{idx:03d}")

    existing_players = (
        db.query(Player)
        .filter(Player.external_api_id.in_(desired_external_ids))
        .all()
    )
    existing_by_external = {p.external_api_id: p for p in existing_players}

    used_names = {(p.sport.name, p.name) for p in db.query(Player).join(Sport).all()}
    created_players: list[Player] = []
    updated = 0

    for sport_name, sport in sports.items():
        teams = teams_by_sport[sport_name]
        positions = POSITION_POOL[sport_name]

        for idx in range(1, TOTAL_PLAYERS_PER_SPORT + 1):
            external_id = f"seed:{sport_name}:{idx:03d}"
            tier = _pick_tier(rng)
            season_idx = 0
            active_stat = _stat_line_for_season(tier=tier, season_idx=season_idx, rng=rng)

            team_name = teams[(idx - 1) % len(teams)]
            position = positions[(idx - 1) % len(positions)]
            player_name = _build_player_name(
                sport_name=sport_name,
                index=idx,
                rng=rng,
                used_names=used_names,
            )

            existing = existing_by_external.get(external_id)
            if existing:
                existing.name = player_name
                existing.position = position
                existing.real_team = team_name
                existing.cost = active_stat["current_price"]  # type: ignore[assignment]
                existing.is_available = True
                updated += 1
                continue

            created_players.append(
                Player(
                    sport_id=sport.id,
                    external_api_id=external_id,
                    name=player_name,
                    position=position,
                    real_team=team_name,
                    cost=active_stat["current_price"],  # type: ignore[arg-type]
                    is_available=True,
                )
            )

    if created_players:
        db.bulk_save_objects(created_players)
        db.flush()

    _seed_player_season_if_supported(
        db=db,
        sports=sports,
        seasons_by_key=seasons_by_key,
        rng=random.Random(SEED + 1),
    )

    return len(created_players), updated


def _seed_player_season_if_supported(
    *,
    db: Session,
    sports: dict[str, Sport],
    seasons_by_key: dict[tuple[str, str], Season],
    rng: random.Random,
) -> None:
    """Seed PlayerSeason rows if the model exists in this codebase.

    This keeps the script compatible with current schema while supporting
    future PlayerSeason adoption with no changes.
    """
    try:
        from app.player.models import PlayerSeason  # type: ignore
    except Exception:
        print("ℹ️  PlayerSeason model not found. Skipping season-level player stats.")
        return

    players = (
        db.query(Player)
        .join(Sport, Player.sport_id == Sport.id)
        .filter(Player.external_api_id.like("seed:%"))
        .all()
    )

    if not players:
        return

    existing_keys = {
        (row.player_id, row.season_id)
        for row in db.query(PlayerSeason)
        .join(Player, PlayerSeason.player_id == Player.id)
        .filter(Player.external_api_id.like("seed:%"))
        .all()
    }

    to_insert: list[Any] = []

    season_names = [row[0] for row in SEASON_DEFS]
    for player in players:
        tier = _pick_tier(rng)
        sport_name = player.sport.name

        for season_idx, season_name in enumerate(season_names):
            season = seasons_by_key[(sport_name, season_name)]
            key = (player.id, season.id)
            if key in existing_keys:
                continue

            stat_line = _stat_line_for_season(tier=tier, season_idx=season_idx, rng=rng)
            to_insert.append(
                PlayerSeason(
                    player_id=player.id,
                    season_id=season.id,
                    current_price=stat_line["current_price"],
                    total_points=stat_line["total_points"],
                    form_score=stat_line["form_score"],
                    ownership_percentage=stat_line["ownership_percentage"],
                )
            )

    if to_insert:
        db.bulk_save_objects(to_insert)
        db.flush()
        print(f"✅ PlayerSeason rows inserted: {len(to_insert)}")
    else:
        print("ℹ️  PlayerSeason exists but no new rows were required.")


def run_seed() -> None:
    db = SessionLocal()

    try:
        sports = create_sports(db)
        seasons = create_seasons(db, sports)
        teams = create_team_catalog()
        created, updated = create_players(db, sports, teams, seasons)

        db.commit()

        total_seed_players = (
            db.query(Player)
            .filter(Player.external_api_id.like("seed:%"))
            .count()
        )

        active_count = db.query(Season).filter(Season.is_active.is_(True)).count()
        print("\n✅ Seed complete")
        print(f"   Sports ensured: {len(sports)}")
        print(f"   Seasons ensured: {len(seasons)}")
        print(f"   Players created: {created}")
        print(f"   Players updated: {updated}")
        print(f"   Total seeded players: {total_seed_players}")
        print(f"   Active seasons (global): {active_count}")

        if active_count != 1:
            print("⚠️  Expected exactly one active season globally.")

    except Exception as exc:
        db.rollback()
        print(f"❌ Seed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
