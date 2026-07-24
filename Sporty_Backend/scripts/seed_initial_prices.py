"""One-off: give the flat-4.0 seeded football players a realistic starting
price before repricing takes over live.

Signal: last completed season's (2024-25) top-100 goal-contributors per
competition from football-data.org (goals + assists → a fantasy-output
proxy → cost band). Non-scorers get a gentle position-tiered start just
above the floor. Only players currently at exactly 4.0 are touched, so the
226 EPL players already priced from the historical CSVs are left alone.

Cost is a *starting* price only; the daily pricing.recalculate task evolves
it from real form once the season runs.

Dry run by default (prints the band distribution + examples); --apply commits.
Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/seed_initial_prices.py
"""
import json
import os
import sys
import time
import unicodedata
from collections import Counter
from decimal import Decimal
from pathlib import Path

import httpx

import app.main  # noqa: F401  — registers models
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam

CACHE = Path(os.environ.get("EPL_SYNC_CACHE", "/tmp/epl_api_cache"))
CACHE.mkdir(parents=True, exist_ok=True)
TOKEN = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_DATA_ORG_TOKEN="))
APPLY = "--apply" in sys.argv

# Last COMPLETED season on the free tier (2024 = 2024-25). Captures the
# current stars in their current-ish clubs (Mbappé→Madrid, Kane→Bayern).
SIGNAL_SEASON = 2024

# competition tag -> football-data.org code
COMP_CODES = {"EPL": "PL", "LALIGA": "PD", "BUNDESLIGA": "BL1"}

# Output proxy -> cost. Mbappé (31g/3a → 164) lands ~13.5; a 5g/3a player ~6.
_FACTOR = Decimal("0.058")
MIN_COST, MAX_COST = Decimal("4.0"), Decimal("15.0")

# Gentle starting tier for players with no goal signal (repricing lifts the
# genuinely good ones once matches play).
POSITION_FLOOR = {"GKP": Decimal("4.5"), "DEF": Decimal("4.5"),
                  "MID": Decimal("5.0"), "FWD": Decimal("5.5")}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def _round_half(cost: Decimal) -> Decimal:
    return (cost * 2).quantize(Decimal("1")) / 2


def fetch_scorers(code: str) -> list[dict]:
    f = CACHE / f"fdo_scorers_{code}_{SIGNAL_SEASON}.json"
    if f.exists():
        return json.loads(f.read_text()).get("scorers", [])
    time.sleep(6.5)  # 10 req/min
    r = httpx.get(
        f"https://api.football-data.org/v4/competitions/{code}/scorers",
        headers={"X-Auth-Token": TOKEN},
        params={"season": SIGNAL_SEASON, "limit": 100},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    f.write_text(json.dumps(data))
    return data.get("scorers", [])


def output_to_cost(goals: int, assists: int) -> Decimal:
    proxy = Decimal(goals) * 5 + Decimal(assists) * 3  # fantasy attacking points
    cost = MIN_COST + proxy * _FACTOR
    return _round_half(max(MIN_COST, min(MAX_COST, cost)))


db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()

# Our flat-4.0 players, grouped by competition tag.
rows = (
    db.query(Player, RealTeam.competition)
    .join(RealTeam, Player.real_team_id == RealTeam.id)
    .filter(Player.sport_id == fb.id, Player.cost == Decimal("4.0"),
            RealTeam.competition.in_(list(COMP_CODES)))
    .all()
)
by_comp: dict[str, list[Player]] = {}
for player, comp in rows:
    by_comp.setdefault(comp, []).append(player)

def _first(name: str) -> str:
    toks = fold(name).split()
    return toks[0].rstrip(".") if len(toks) > 1 else ""


def _surname(name: str) -> str:
    toks = fold(name).split()
    return toks[-1] if toks else ""


matched, heuristic = [], []
for comp, players in by_comp.items():
    scorers = fetch_scorers(COMP_CODES[comp])
    idx: dict[str, list[dict]] = {}
    for s in scorers:
        idx.setdefault(_surname(s["player"]["name"]), []).append(
            {"first": _first(s["player"]["name"]), **s}
        )

    # Our players sharing a (surname, first) key are ambiguous — an initial
    # match would tie all of them to one scorer (the Pérez-cluster bug). Only
    # unique keys are eligible for initial matching.
    our_key_counts = Counter((_surname(p.name), _first(p.name)[:1]) for p in players)

    for p in players:
        surname, first = _surname(p.name), _first(p.name)
        is_initial = len(first) == 1
        cands = idx.get(surname, [])
        # Candidate scorers whose first name is compatible with ours.
        if is_initial:
            hits = [c for c in cands if c["first"][:1] == first]
        else:
            hits = [c for c in cands if c["first"] == first]

        ambiguous = is_initial and our_key_counts[(surname, first[:1])] > 1
        hit = hits[0] if (len(hits) == 1 and not ambiguous) else None

        if hit:
            new_cost = output_to_cost(hit.get("goals") or 0, hit.get("assists") or 0)
            matched.append((p, comp, new_cost, hit.get("goals") or 0, hit.get("assists") or 0))
        else:
            new_cost = POSITION_FLOOR.get(p.position, Decimal("4.5"))
            heuristic.append((p, comp, new_cost))

if APPLY:
    for p, _c, cost, *_ in matched:
        p.cost = cost
    for p, _c, cost in heuristic:
        p.cost = cost
    db.commit()
    print("\n*** COMMITTED ***")
else:
    db.rollback()
    print("\n*** DRY RUN (no writes) ***")

print(f"\nflat-4.0 players processed: {len(matched) + len(heuristic)}")
print(f"  priced from last-season goals: {len(matched)}")
print(f"  position-tier default:         {len(heuristic)}")

bands = Counter()
for _p, _c, cost, *_ in matched:
    bands[float(cost)] += 1
for _p, _c, cost in heuristic:
    bands[float(cost)] += 1
print("\ncost band distribution:")
for cost in sorted(bands):
    print(f"  {cost:>5}: {bands[cost]}")

print("\ntop 15 priced (from goal output):")
for p, comp, cost, g, a in sorted(matched, key=lambda x: x[2], reverse=True)[:15]:
    print(f"  {float(cost):>5}  {p.name:<24} {comp:<10} ({g}g {a}a)")

db.close()
