"""NBA standings, computed from our own match results.

No provider call. Standings are a pure function of game results, and we already
store every 2026-27 game in `matches` — the daily BallDontLie fixture sync
re-pulls all ~1,200 rows including final scores, so the table self-heals within
24h even if a live tick missed a game. BallDontLie's own /standings endpoint is
paid-tier (401 on ours) and stats.nba.com soft-blocks under polling, so deriving
is both the cheapest and the most reliable option available.

The payload deliberately mimics football-data.org's standings shape so the
existing competition endpoint, snapshot model and frontend table can serve it:
`{"standings": [{"type","group","table":[row]}], "season": {...}}`. That
`standings` list is already an array of groups upstream, which is exactly what
NBA conferences and divisions need. Football's per-row keys (draw, goalsFor,
goalDifference, points) are simply absent; NBA rows carry won/lost/winPct/
gamesBehind/streak instead.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.league.models import Season, Sport
from app.match.models import Match
from app.player.models import RealTeam
from app.services.sync import basketball_sync

logger = logging.getLogger(__name__)

COMPETITION = "NBA"

# Basketball RealTeam.name holds the ABBREVIATION ("ATL") — fixtures join on it,
# so it cannot be changed to a full name. City alone is ambiguous (both LA
# teams), and city + name reads "Atlanta ATL", so display names live here.
# Same approach as SPORTSCORE_TEAM_SLUGS: a small static map for a set that
# changes about once a decade, rather than a column and a migration.
NBA_TEAM_NAMES: dict[str, str] = {
    "ATL": "Atlanta Hawks",
    "BKN": "Brooklyn Nets",
    "BOS": "Boston Celtics",
    "CHA": "Charlotte Hornets",
    "CHI": "Chicago Bulls",
    "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks",
    "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors",
    "HOU": "Houston Rockets",
    "IND": "Indiana Pacers",
    "LAC": "LA Clippers",
    "LAL": "Los Angeles Lakers",
    "MEM": "Memphis Grizzlies",
    "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks",
    "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans",
    "NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic",
    "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings",
    "SAS": "San Antonio Spurs",
    "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz",
    "WAS": "Washington Wizards",
}


def display_name(team: RealTeam) -> str:
    """Full team name for display; falls back to whatever we stored."""
    key = team.abbreviation or team.name or ""
    return NBA_TEAM_NAMES.get(key) or team.name or key

# Standard NBA display order — the API's grouping is alphabetical otherwise.
_CONFERENCE_ORDER = ["East", "West"]
_DIVISION_ORDER = [
    "Atlantic", "Central", "Southeast",      # East
    "Northwest", "Pacific", "Southwest",     # West
]


# Season year and label come from the fixture sync, deliberately NOT
# reimplemented here: the standings read the rows that sync writes, so if the
# two disagreed about which season is current the table would silently be built
# for a season we hold no games for.
current_nba_season = basketball_sync.current_nba_season
season_label = basketball_sync.season_label


class _Record:
    __slots__ = ("team", "won", "lost", "streak_kind", "streak_len", "_form")

    def __init__(self, team: RealTeam) -> None:
        self.team = team
        self.won = 0
        self.lost = 0
        self.streak_kind: str | None = None
        self.streak_len = 0
        self._form: list[str] = []

    def record(self, is_win: bool) -> None:
        # Games are fed in chronological order, so the streak is just the tail.
        result = "W" if is_win else "L"
        if is_win:
            self.won += 1
        else:
            self.lost += 1
        if result == self.streak_kind:
            self.streak_len += 1
        else:
            self.streak_kind, self.streak_len = result, 1
        self._form.append(result)

    @property
    def played(self) -> int:
        return self.won + self.lost

    @property
    def win_pct(self) -> float:
        # NBA convention: 3 decimals, and 0-0 shows as .000 rather than blank.
        return round(self.won / self.played, 3) if self.played else 0.0

    @property
    def form(self) -> str:
        return ",".join(self._form[-5:])

    @property
    def streak(self) -> str | None:
        return f"{self.streak_kind}{self.streak_len}" if self.streak_kind else None


def _games_behind(leader: _Record, row: _Record) -> float:
    """NBA games-back: ((leadW - W) + (L - leadL)) / 2. 0 for the leader."""
    return round(((leader.won - row.won) + (row.lost - leader.lost)) / 2, 1)


def _sorted(records: list[_Record]) -> list[_Record]:
    # Win pct first (the NBA's actual ordering), then wins, then fewest losses.
    # Real tiebreakers are head-to-head/division/conference records; those need
    # data we do not model, so a stable alphabetical fallback keeps the order
    # deterministic instead of arbitrary.
    return sorted(
        records,
        key=lambda r: (-r.win_pct, -r.won, r.lost, r.team.name or ""),
    )


def _rows(records: list[_Record]) -> list[dict]:
    ordered = _sorted(records)
    if not ordered:
        return []
    leader = ordered[0]
    return [
        {
            "position": index,
            "team": {
                "id": str(r.team.id),
                "name": display_name(r.team),
                "shortName": r.team.name,
                "tla": r.team.abbreviation,
                "crest": r.team.logo_url,
            },
            "playedGames": r.played,
            "won": r.won,
            "lost": r.lost,
            "winPct": r.win_pct,
            "gamesBehind": _games_behind(leader, r),
            "streak": r.streak,
            "conference": r.team.conference,
            "division": r.team.division,
            "form": r.form or None,
        }
        for index, r in enumerate(ordered, start=1)
    ]


def build_standings(db: Session, season: int | None = None) -> dict:
    """League / conference / division tables for one NBA season.

    Only `finished` matches count — a scheduled or in-progress game has no
    result yet, and counting a live game's current score would make the table
    flicker mid-evening.
    """
    season = season if season is not None else current_nba_season()
    label = season_label(season)

    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return _empty(label)

    teams = db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()
    if not teams:
        return _empty(label)

    records: dict[str, _Record] = {
        team.name: _Record(team) for team in teams if team.name
    }

    matches = (
        db.query(Match)
        .filter(
            Match.sport_id == sport.id,
            Match.season == label,
            Match.status == "finished",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
        )
        .order_by(Match.match_date)
        .all()
    )

    for match in matches:
        # The query above already scopes to finished games with scores; this
        # repeats it so the tally is correct for any caller, not just that one.
        if match.status != "finished" or match.home_score is None or match.away_score is None:
            continue
        home = records.get(match.home_team)
        away = records.get(match.away_team)
        if home is None or away is None:
            # A fixture naming a team we have no roster row for. Skipping keeps
            # the other 29 teams' records correct rather than failing the table.
            logger.warning(
                "NBA standings: unknown team in match %s (%s v %s)",
                match.external_api_id, match.home_team, match.away_team,
            )
            continue
        if match.home_score == match.away_score:
            continue  # NBA games cannot tie; a 0-0 "finished" row is bad data
        home_won = match.home_score > match.away_score
        home.record(home_won)
        away.record(not home_won)

    all_records = list(records.values())
    by_conference: dict[str, list[_Record]] = defaultdict(list)
    by_division: dict[str, list[_Record]] = defaultdict(list)
    for record in all_records:
        by_conference[record.team.conference or "Unknown"].append(record)
        by_division[record.team.division or "Unknown"].append(record)

    groups = [{"type": "TOTAL", "group": "League", "table": _rows(all_records)}]
    groups += [
        {"type": "CONFERENCE", "group": name, "table": _rows(by_conference[name])}
        for name in _CONFERENCE_ORDER
        if by_conference.get(name)
    ]
    groups += [
        {"type": "DIVISION", "group": name, "table": _rows(by_division[name])}
        for name in _DIVISION_ORDER
        if by_division.get(name)
    ]

    played = sum(r.played for r in all_records) // 2
    start, end = _season_dates(db, sport.id, season)
    return {
        "competition": {"tag": COMPETITION, "name": "NBA", "sport": "basketball"},
        "standings": groups,
        "season": {
            "id": season,
            "label": label,
            "gamesPlayed": played,
            "startDate": start,
            "endDate": end,
        },
    }


def _season_dates(db: Session, sport_id, season: int) -> tuple[str | None, str | None]:
    """The real window from our own Season row — that's what the app runs on,
    and the frontend prints it as the date the table starts filling in. Falls
    back to the calendar-year approximation if no Season row matches."""
    row = (
        db.query(Season)
        .filter(Season.sport_id == sport_id, Season.start_date.isnot(None))
        .filter(extract("year", Season.start_date) == season)
        .order_by(Season.start_date)
        .first()
    )
    if row is None:
        return f"{season}-10-01", f"{season + 1}-06-30"
    return (
        row.start_date.isoformat() if row.start_date else None,
        row.end_date.isoformat() if row.end_date else None,
    )


def _empty(label: str) -> dict:
    return {
        "competition": {"tag": COMPETITION, "name": "NBA", "sport": "basketball"},
        "standings": [],
        "season": {"label": label, "gamesPlayed": 0},
    }


def build_matches(db: Session, season: int | None = None) -> dict:
    """The season's fixtures and results, shaped like the standings payload.

    Same source as the standings — our own `matches` rows — so the two can
    never disagree. Mirrors football-data.org's matches envelope closely enough
    for the shared competition page, except `matchday` is null: the NBA has no
    matchweeks, so the frontend groups these by date instead.
    """
    season = season if season is not None else current_nba_season()
    label = season_label(season)

    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return {"competition": {"tag": COMPETITION, "name": "NBA"}, "matches": []}

    crest_by_name = {
        team.name: team
        for team in db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()
        if team.name
    }

    def _team(name: str | None) -> dict:
        team = crest_by_name.get(name or "")
        if team is None:
            return {"id": None, "name": name, "tla": name, "crest": None}
        return {
            "id": str(team.id),
            "name": display_name(team),
            "shortName": team.name,
            "tla": team.abbreviation,
            "crest": team.logo_url,
        }

    matches = (
        db.query(Match)
        .filter(Match.sport_id == sport.id, Match.season == label)
        .order_by(Match.match_date)
        .all()
    )

    return {
        "competition": {"tag": COMPETITION, "name": "NBA", "sport": "basketball"},
        "season": {"id": season, "label": label},
        "matches": [
            {
                "id": match.external_api_id,
                "utcDate": match.match_date.isoformat() if match.match_date else None,
                # Our vocabulary is scheduled/live/finished; the shared page
                # keys off FINISHED, so map to football-data.org's words.
                "status": {
                    "finished": "FINISHED",
                    "live": "IN_PLAY",
                }.get(match.status, "SCHEDULED"),
                "matchday": None,
                "stage": "REGULAR_SEASON",
                "homeTeam": _team(match.home_team),
                "awayTeam": _team(match.away_team),
                "score": {
                    "winner": _winner(match),
                    "fullTime": {"home": match.home_score, "away": match.away_score},
                },
            }
            for match in matches
        ],
    }


def _winner(match: Match) -> str | None:
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score == match.away_score:
        return None  # NBA games cannot tie; treat as unknown rather than DRAW
    return "HOME_TEAM" if match.home_score > match.away_score else "AWAY_TEAM"
