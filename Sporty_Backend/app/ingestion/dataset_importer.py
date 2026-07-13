from __future__ import annotations

import csv
import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User  # noqa: F401
from app.core.team_names import canonical_team_name
from app.league.models import Season, Sport, TransferWindow
from app.match.models import Match  # noqa: F401
from app.player.models import FootballStat, Player, PlayerGameweekStat, RealTeam
from app.player.models_nba import NBAStat
from app.scoring.models import DefaultScoringRule  # noqa: F401

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".csv", ".json", ".sql"}
FOOTBALL_POSITIONS = {
    "g": "GKP",
    "gk": "GKP",
    "gkp": "GKP",
    "goalkeeper": "GKP",
    "d": "DEF",
    "def": "DEF",
    "defender": "DEF",
    "m": "MID",
    "mid": "MID",
    "midfielder": "MID",
    "f": "FWD",
    "fw": "FWD",
    "fwd": "FWD",
    "forward": "FWD",
}

DEFAULT_SEASON_DATES = {
    "football": (date(2099, 8, 1), date(2100, 5, 31)),
    "basketball": (date(2098, 10, 1), date(2099, 6, 30)),
}


@dataclass(slots=True)
class FileImportReport:
    path: str
    format: str
    sport: str | None = None
    season: str | None = None
    rows_seen: int = 0
    rows_imported: int = 0
    rows_skipped: int = 0
    unmapped_columns: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass(slots=True)
class DatasetImportReport:
    files: list[FileImportReport] = field(default_factory=list)

    @property
    def imported_rows(self) -> int:
        return sum(file_report.rows_imported for file_report in self.files)

    @property
    def skipped_rows(self) -> int:
        return sum(file_report.rows_skipped for file_report in self.files)


class DatasetImporter:
    def __init__(
        self,
        db: Session,
        *,
        repo_root: Path | None = None,
        dataset_roots: Iterable[Path] | None = None,
    ) -> None:
        self.db = db
        self.repo_root = repo_root or Path(__file__).resolve().parents[2]
        self.dataset_roots = list(dataset_roots) if dataset_roots is not None else self._default_dataset_roots()

    def _default_dataset_roots(self) -> list[Path]:
        roots = [self.repo_root / "EPL", self.repo_root / "basketball"]
        return [root for root in roots if root.exists()]

    def discover_files(self) -> list[Path]:
        files: list[Path] = []
        for root in self.dataset_roots:
            if not root.exists():
                logger.info("Dataset root missing, skipping: %s", root)
                continue
            for path in sorted(root.rglob("*")):
                if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
                    files.append(path)
        return files

    def import_all(self) -> DatasetImportReport:
        report = DatasetImportReport()
        self._reset_player_catalog()
        files = self.discover_files()
        if not files:
            logger.warning(
                "No supported dataset files found under %s",
                ", ".join(str(path) for path in self.dataset_roots),
            )
            return report

        window_counters: dict[tuple[str, str], int] = {}

        for path in files:
            sport_name = self._infer_sport(path)
            season_name = self._infer_season_name(path, sport_name)
            key = (sport_name, season_name)
            window_counters[key] = window_counters.get(key, 0) + 1

            try:
                file_report = self.import_file(path, window_number=window_counters[key])
                self.db.commit()
            except Exception as exc:
                self.db.rollback()
                file_report = FileImportReport(path=str(path), format=path.suffix.lower().lstrip("."))
                file_report.sport = sport_name
                file_report.season = season_name
                file_report.errors.append(str(exc))
            report.files.append(file_report)

        return report

    def _reset_player_catalog(self) -> None:
        self.db.execute(text("TRUNCATE TABLE players, real_teams CASCADE"))
        self.db.commit()
        logger.info(
            "Reset player catalog with cascading truncate for players and real_teams",
        )

    def import_file(self, path: Path, *, window_number: int) -> FileImportReport:
        file_format = path.suffix.lower().lstrip(".")
        report = FileImportReport(path=str(path), format=file_format)
        sport_name = self._infer_sport(path)
        report.sport = sport_name

        try:
            if file_format == "csv":
                rows = self._load_csv(path)
                report.rows_seen = len(rows)
                season_name = self._infer_season_name(path, sport_name)
                season = self._ensure_import_season(sport_name, season_name)
                transfer_window = self._ensure_transfer_window(season, window_number=window_number)
                if sport_name == "football":
                    self._import_football_csv(rows, report, season_name=season_name, transfer_window=transfer_window)
                elif sport_name == "basketball":
                    self._import_basketball_csv(rows, report, season_name=season_name, transfer_window=transfer_window)
                else:
                    raise ValueError(f"Unsupported sport directory for CSV import: {path}")
            elif file_format == "json":
                raise ValueError("JSON dataset imports are not implemented yet")
            elif file_format == "sql":
                raise ValueError("SQL dataset imports are not implemented yet")
            else:
                raise ValueError(f"Unsupported dataset format: {file_format}")
        except Exception as exc:
            report.errors.append(str(exc))
            logger.exception("Dataset import failed for %s", path)
            raise

        logger.info(
            "Imported dataset file=%s sport=%s rows=%s imported=%s skipped=%s",
            path.name,
            report.sport,
            report.rows_seen,
            report.rows_imported,
            report.rows_skipped,
        )
        return report

    def _infer_sport(self, path: Path) -> str:
        parts = {part.lower() for part in path.parts}
        if "epl" in parts:
            return "football"
        if "basketball" in parts:
            return "basketball"
        raise ValueError(f"Unable to infer sport from path: {path}")

    def _infer_season_name(self, path: Path, sport_name: str) -> str:
        match = re.search(r"(20\d{2})[-_/](\d{2})", path.stem)
        if match:
            return f"{match.group(1)}/{match.group(2)}"
        if sport_name in DEFAULT_SEASON_DATES:
            start_date, end_date = DEFAULT_SEASON_DATES[sport_name]
            return f"{start_date.year}/{str(end_date.year)[-2:]}"
        return "dataset-import"

    def _season_dates(self, sport_name: str, season_name: str) -> tuple[date, date]:
        if sport_name in DEFAULT_SEASON_DATES:
            return DEFAULT_SEASON_DATES[sport_name]

        match = re.match(r"^(20\d{2})/(\d{2})$", season_name)
        if match:
            start_year = int(match.group(1))
            end_year = start_year + 1
            return date(start_year, 1, 1), date(end_year, 12, 31)

        today = date.today()
        return today.replace(month=1, day=1), today.replace(month=12, day=31)

    def _ensure_sport(self, sport_name: str) -> Sport:
        sport = self.db.query(Sport).filter(Sport.name == sport_name).first()
        if sport:
            return sport

        sport = Sport(
            name=sport_name,
            display_name=sport_name.title(),
            is_active=True,
        )
        self.db.add(sport)
        self.db.flush()
        logger.info("Created missing sport=%s", sport_name)
        return sport

    def _ensure_import_season(self, sport_name: str, season_name: str) -> Season:
        sport = self._ensure_sport(sport_name)
        season_key = f"dataset-import-{season_name.replace('/', '-') }"
        season = (
            self.db.query(Season)
            .filter(Season.sport_id == sport.id, Season.name == season_key)
            .first()
        )
        if season:
            return season

        start_date, end_date = self._season_dates(sport_name, season_name)
        season = Season(
            sport_id=sport.id,
            name=season_key,
            start_date=start_date,
            end_date=end_date,
            is_active=False,
        )
        self.db.add(season)
        self.db.flush()
        logger.info("Created import season=%s for sport=%s", season_key, sport_name)
        return season

    def _ensure_transfer_window(self, season: Season, *, window_number: int) -> TransferWindow:
        transfer_window = (
            self.db.query(TransferWindow)
            .filter(TransferWindow.season_id == season.id, TransferWindow.number == window_number)
            .first()
        )
        base_day = datetime.combine(season.start_date, time.min, tzinfo=timezone.utc)
        start_at = base_day + timedelta(days=window_number - 1)
        end_at = start_at + timedelta(days=1) - timedelta(seconds=1)
        # Deadlines anchored to the START of the gameweek so it locks the moment
        # it opens — BEFORE its matches play — matching generate_transfer_windows.
        # (End-anchored deadlines let users edit while results come in.)
        transfer_deadline_at = start_at
        lineup_deadline_at = start_at + timedelta(minutes=1)

        if transfer_window:
            transfer_window.start_at = start_at
            transfer_window.end_at = end_at
            transfer_window.transfer_deadline_at = transfer_deadline_at
            transfer_window.lineup_deadline_at = lineup_deadline_at
            transfer_window.transfers_locked = False
            transfer_window.lineup_locked = False
            return transfer_window

        transfer_window = TransferWindow(
            season_id=season.id,
            number=window_number,
            start_at=start_at,
            end_at=end_at,
            transfer_deadline_at=transfer_deadline_at,
            lineup_deadline_at=lineup_deadline_at,
            transfers_locked=False,
            lineup_locked=False,
        )
        self.db.add(transfer_window)
        self.db.flush()
        logger.info(
            "Created transfer window season=%s number=%s",
            season.name,
            window_number,
        )
        return transfer_window

    def _load_csv(self, path: Path) -> list[dict[str, str]]:
        encodings = ("utf-8-sig", "utf-8", "latin-1", "cp1252")
        last_error: Exception | None = None
        for encoding in encodings:
            try:
                with path.open(newline="", encoding=encoding) as handle:
                    reader = csv.DictReader(handle)
                    if reader.fieldnames is None:
                        raise ValueError(f"CSV file has no header row: {path}")
                    return list(reader)
            except UnicodeDecodeError as exc:
                last_error = exc
                continue
        raise UnicodeDecodeError("utf-8", b"", 0, 1, f"Unable to decode CSV file: {path}") from last_error

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-zA-Z0-9]+", "_", normalized.strip().lower())
        return normalized.strip("_")

    def _first_value(self, row: dict[str, Any], *names: str) -> str | None:
        for name in names:
            value = row.get(name)
            if value is not None:
                text = str(value).strip()
                if text:
                    return text
        return None

    def _to_int(self, value: Any, default: int = 0) -> int:
        if value is None:
            return default
        text = str(value).strip()
        if not text:
            return default
        try:
            return int(float(text))
        except ValueError:
            return default

    def _to_decimal(self, value: Any, default: Decimal = Decimal("0")) -> Decimal:
        if value is None:
            return default
        text = str(value).strip()
        if not text:
            return default
        try:
            return Decimal(text)
        except InvalidOperation:
            return default

    def _cap_minutes(self, minutes: int) -> int:
        return max(0, min(minutes, 120))

    def _football_position(self, value: str | None) -> str:
        if not value:
            return "UNK"
        normalized = value.strip().lower()
        return FOOTBALL_POSITIONS.get(normalized, value.strip().upper())

    def _ensure_real_team(
        self,
        *,
        sport: Sport,
        external_id: str,
        name: str,
        abbreviation: str | None = None,
    ) -> RealTeam:
        team = (
            self.db.query(RealTeam)
            .filter(RealTeam.sport_id == sport.id, RealTeam.external_api_id == external_id)
            .first()
        )
        if team:
            team.name = name
            team.abbreviation = abbreviation
            return team

        team = RealTeam(
            sport_id=sport.id,
            external_api_id=external_id,
            name=name,
            abbreviation=abbreviation,
        )
        self.db.add(team)
        self.db.flush()
        return team

    def _upsert_player(
        self,
        *,
        sport: Sport,
        external_id: str,
        name: str,
        position: str,
        real_team: str,
        real_team_ref: RealTeam,
        cost: Decimal,
        is_available: bool = True,
    ) -> Player:
        player = (
            self.db.query(Player)
            .filter(Player.sport_id == sport.id, Player.external_api_id == external_id)
            .first()
        )
        if player is None:
            # Fallback: match by identity (name + real team) so a source that
            # slugs the same player differently (another team spelling, another
            # namespace) updates the existing row instead of forking a
            # duplicate. This is the follow-up the e6f7a8b9c0d1 dedupe
            # migration required before the unique players index could exist.
            # The existing external_api_id is deliberately kept — identities
            # must not ping-pong between sources.
            # ponytail: lower(name) equality, not whitespace-collapsed like the
            # index expression — CSV names are clean; tighten if a source isn't.
            player = (
                self.db.query(Player)
                .filter(
                    Player.sport_id == sport.id,
                    Player.real_team_id == real_team_ref.id,
                    func.lower(Player.name) == name.strip().lower(),
                )
                .first()
            )
        if player:
            player.name = name
            player.position = position
            player.real_team = real_team
            player.real_team_id = real_team_ref.id
            player.cost = cost
            player.is_available = is_available
            return player

        player = Player(
            sport_id=sport.id,
            external_api_id=external_id,
            name=name,
            position=position,
            real_team=real_team,
            real_team_id=real_team_ref.id,
            cost=cost,
            is_available=is_available,
        )
        self.db.add(player)
        self.db.flush()
        return player

    def _football_player_external_id(self, *, player_name: str, team_name: str, position: str) -> str:
        return (
            "football:"
            f"{self._normalize_text(player_name)}:"
            f"{self._normalize_text(team_name)}:"
            f"{self._normalize_text(position)}"
        )

    def _upsert_base_stat(
        self,
        *,
        player: Player,
        transfer_window: TransferWindow,
        minutes_played: int,
        fantasy_points: Decimal,
    ) -> PlayerGameweekStat:
        stat = (
            self.db.query(PlayerGameweekStat)
            .filter(
                PlayerGameweekStat.player_id == player.id,
                PlayerGameweekStat.transfer_window_id == transfer_window.id,
            )
            .first()
        )
        if stat:
            stat.minutes_played = minutes_played
            stat.fantasy_points = fantasy_points
            return stat

        stat = PlayerGameweekStat(
            player_id=player.id,
            transfer_window_id=transfer_window.id,
            minutes_played=minutes_played,
            fantasy_points=fantasy_points,
        )
        self.db.add(stat)
        self.db.flush()
        return stat

    def _upsert_nba_stat(
        self,
        *,
        base_stat: PlayerGameweekStat,
        points: int,
        assists: int,
        rebounds: int,
        steals: int,
        blocks: int,
    ) -> NBAStat:
        stat = self.db.query(NBAStat).filter(NBAStat.base_stat_id == base_stat.id).first()
        if stat:
            stat.points = points
            stat.assists = assists
            stat.rebounds = rebounds
            stat.steals = steals
            stat.blocks = blocks
            return stat

        stat = NBAStat(
            base_stat_id=base_stat.id,
            points=points,
            assists=assists,
            rebounds=rebounds,
            steals=steals,
            blocks=blocks,
        )
        self.db.add(stat)
        self.db.flush()
        return stat

    def _upsert_football_stat(
        self,
        *,
        base_stat: PlayerGameweekStat,
        goals: int,
        assists: int,
        clean_sheets: int,
        yellow_cards: int,
        red_cards: int,
        own_goals: int,
        penalties_saved: int,
        penalties_missed: int,
        saves: int,
        goals_conceded: int,
        bonus: int,
    ) -> FootballStat:
        stat = self.db.query(FootballStat).filter(FootballStat.base_stat_id == base_stat.id).first()
        if stat:
            stat.goals = goals
            stat.assists = assists
            stat.clean_sheets = clean_sheets
            stat.yellow_cards = yellow_cards
            stat.red_cards = red_cards
            stat.own_goals = own_goals
            stat.penalties_saved = penalties_saved
            stat.penalties_missed = penalties_missed
            stat.saves = saves
            stat.goals_conceded = goals_conceded
            stat.bonus = bonus
            return stat

        stat = FootballStat(
            base_stat_id=base_stat.id,
            goals=goals,
            assists=assists,
            clean_sheets=clean_sheets,
            yellow_cards=yellow_cards,
            red_cards=red_cards,
            own_goals=own_goals,
            penalties_saved=penalties_saved,
            penalties_missed=penalties_missed,
            saves=saves,
            goals_conceded=goals_conceded,
            bonus=bonus,
        )
        self.db.add(stat)
        self.db.flush()
        return stat

    def _football_cost(self, rating: Decimal | None, goals: int, assists: int) -> Decimal:
        if rating is None:
            rating = Decimal("5.00")
        score = rating + (Decimal(goals) * Decimal("0.10")) + (Decimal(assists) * Decimal("0.05"))
        return max(Decimal("4.00"), min(Decimal("12.00"), score.quantize(Decimal("0.01"))))

    def _basketball_cost(self, points: int, assists: int, rebounds: int) -> Decimal:
        score = (
            Decimal("4.00")
            + Decimal(points) / Decimal("250")
            + Decimal(assists) / Decimal("400")
            + Decimal(rebounds) / Decimal("500")
        )
        return max(Decimal("4.00"), min(Decimal("15.00"), score.quantize(Decimal("0.01"))))

    def _football_fantasy_points(self, goals: int, assists: int, yellow_cards: int, red_cards: int) -> Decimal:
        return (
            Decimal(goals) * Decimal("5")
            + Decimal(assists) * Decimal("3")
            + Decimal(yellow_cards) * Decimal("-1")
            + Decimal(red_cards) * Decimal("-2")
        )

    def _basketball_fantasy_points(
        self,
        *,
        points: int,
        assists: int,
        rebounds: int,
        steals: int,
        blocks: int,
    ) -> Decimal:
        return (
            (Decimal(points) / Decimal("10")) * Decimal("3")
            + (Decimal(assists) / Decimal("10")) * Decimal("2")
            + Decimal(rebounds)
            + Decimal(steals) * Decimal("2")
            + Decimal(blocks) * Decimal("2")
        ).quantize(Decimal("0.01"))

    def _import_football_csv(
        self,
        rows: list[dict[str, str]],
        report: FileImportReport,
        *,
        season_name: str,
        transfer_window: TransferWindow,
    ) -> None:
        sport = self._ensure_sport("football")
        used_columns = {
            "player_name",
            "team_name",
            "position",
            "id",
            "minutesPlayed",
            "minutes_played",
            "goals",
            "assists",
            "cleanSheet",
            "cleanSheets",
            "yellowCards",
            "redCards",
            "directRedCards",
            "yellowRedCards",
            "ownGoals",
            "penaltySave",
            "penaltiesTaken",
            "penaltyGoals",
            "attemptPenaltyMiss",
            "saves",
            "goalsConceded",
            "rating",
        }
        report.season = season_name
        if rows:
            report.unmapped_columns = sorted(set(rows[0].keys()) - used_columns)

        for row in rows:
            report.rows_seen += 1
            player_name = self._first_value(row, "player_name")
            try:
                team_name = self._first_value(row, "team_name")
                position = self._football_position(self._first_value(row, "position"))
                if not player_name or not team_name:
                    raise ValueError("Missing player_name or team_name")
                # Canonicalise BEFORE building external ids: the two EPL CSVs
                # spell the club differently ("Liverpool" vs "Liverpool FC"),
                # which forked the slug namespace and double-seeded the whole
                # roster (merged back by the liverpool-dedupe migration).
                team_name = canonical_team_name(team_name)

                external_id = self._football_player_external_id(
                    player_name=player_name,
                    team_name=team_name,
                    position=position,
                )

                team = self._ensure_real_team(
                    sport=sport,
                    external_id=f"football:{self._normalize_text(team_name)}",
                    name=team_name,
                )

                goals = self._to_int(self._first_value(row, "goals"))
                assists = self._to_int(self._first_value(row, "assists"))
                clean_sheets = self._to_int(self._first_value(row, "cleanSheet", "cleanSheets"))
                raw_yellow_cards = self._to_int(self._first_value(row, "yellowCards"))
                yellow_cards = min(raw_yellow_cards, 2)
                red_cards = self._to_int(self._first_value(row, "redCards"))
                red_cards += self._to_int(self._first_value(row, "directRedCards"))
                red_cards += self._to_int(self._first_value(row, "yellowRedCards"))
                raw_red_cards = red_cards
                red_cards = min(red_cards, 1)
                own_goals = self._to_int(self._first_value(row, "ownGoals"))
                penalties_saved = self._to_int(self._first_value(row, "penaltySave"))
                saves = self._to_int(self._first_value(row, "saves"))
                goals_conceded = self._to_int(self._first_value(row, "goalsConceded"))
                bonus = self._to_int(self._first_value(row, "bonus"))
                raw_minutes_played = self._to_int(self._first_value(row, "minutesPlayed", "minutes_played"))
                minutes_played = self._cap_minutes(raw_minutes_played)
                if raw_minutes_played != minutes_played and not any("minutes_played capped" in warning for warning in report.warnings):
                    report.warnings.append(
                        f"minutes_played capped to 120 for schema compatibility (first raw value: {raw_minutes_played})"
                    )
                if raw_yellow_cards != yellow_cards and not any("yellow_cards capped" in warning for warning in report.warnings):
                    report.warnings.append(
                        f"yellow_cards capped to 2 for schema compatibility (first raw value: {raw_yellow_cards})"
                    )
                if raw_red_cards != red_cards and not any("red_cards capped" in warning for warning in report.warnings):
                    report.warnings.append(
                        f"red_cards capped to 1 for schema compatibility (first raw value: {raw_red_cards})"
                    )

                penalties_missed = self._to_int(self._first_value(row, "attemptPenaltyMiss"))
                if penalties_missed == 0:
                    penalties_taken = self._to_int(self._first_value(row, "penaltiesTaken"))
                    penalty_goals = self._to_int(self._first_value(row, "penaltyGoals"))
                    penalties_missed = max(penalties_taken - penalty_goals, 0)

                rating = self._to_decimal(self._first_value(row, "rating"), default=Decimal("5.00"))
                cost = self._football_cost(rating, goals, assists)
                fantasy_points = self._football_fantasy_points(goals, assists, yellow_cards, red_cards)

                player = self._upsert_player(
                    sport=sport,
                    external_id=external_id,
                    name=player_name,
                    position=position,
                    real_team=team_name,
                    real_team_ref=team,
                    cost=cost,
                    is_available=True,
                )
                base_stat = self._upsert_base_stat(
                    player=player,
                    transfer_window=transfer_window,
                    minutes_played=minutes_played,
                    fantasy_points=fantasy_points,
                )
                self._upsert_football_stat(
                    base_stat=base_stat,
                    goals=goals,
                    assists=assists,
                    clean_sheets=clean_sheets,
                    yellow_cards=yellow_cards,
                    red_cards=red_cards,
                    own_goals=own_goals,
                    penalties_saved=penalties_saved,
                    penalties_missed=penalties_missed,
                    saves=saves,
                    goals_conceded=goals_conceded,
                    bonus=bonus,
                )
                report.rows_imported += 1
            except Exception as exc:
                report.rows_skipped += 1
                report.warnings.append(f"Row skipped for {player_name or 'unknown'}: {exc}")
                logger.exception("Skipping football row in %s", report.path)

    def _import_basketball_csv(
        self,
        rows: list[dict[str, str]],
        report: FileImportReport,
        *,
        season_name: str,
        transfer_window: TransferWindow,
    ) -> None:
        sport = self._ensure_sport("basketball")
        used_columns = {
            "PLAYER_ID",
            "PLAYER",
            "TEAM_ID",
            "TEAM",
            "GP",
            "MIN",
            "PTS",
            "AST",
            "REB",
            "STL",
            "BLK",
        }
        report.season = season_name
        if rows:
            report.unmapped_columns = sorted(set(rows[0].keys()) - used_columns)

        for row in rows:
            report.rows_seen += 1
            player_name = self._first_value(row, "PLAYER")
            try:
                player_id = self._first_value(row, "PLAYER_ID")
                team_id = self._first_value(row, "TEAM_ID")
                team_abbreviation = self._first_value(row, "TEAM")
                if not player_name or not player_id or not team_id or not team_abbreviation:
                    raise ValueError("Missing one of PLAYER, PLAYER_ID, TEAM_ID, TEAM")

                team = self._ensure_real_team(
                    sport=sport,
                    external_id=f"nba:{team_id}",
                    name=team_abbreviation,
                    abbreviation=team_abbreviation,
                )

                games_played = self._to_int(self._first_value(row, "GP"))
                if games_played <= 0:
                    raise ValueError("GP must be > 0 to derive per-game stats")

                # Source rows are season totals (PTS/AST/REB/STL/BLK/MIN summed
                # across GP games played). _basketball_cost's divisors are
                # calibrated for that season-total scale, so cost keeps using
                # the totals directly. But each CSV row is stored as a single
                # PlayerGameweekStat/NBAStat row — those need to read like one
                # game's box score (matching football/cricket rows), so divide
                # by GP before computing fantasy_points and persisting.
                season_points = self._to_int(self._first_value(row, "PTS"))
                season_assists = self._to_int(self._first_value(row, "AST"))
                season_rebounds = self._to_int(self._first_value(row, "REB"))

                points = season_points // games_played
                assists = season_assists // games_played
                rebounds = season_rebounds // games_played
                steals = self._to_int(self._first_value(row, "STL")) // games_played
                blocks = self._to_int(self._first_value(row, "BLK")) // games_played
                raw_minutes_played = self._to_int(self._first_value(row, "MIN")) // games_played
                minutes_played = self._cap_minutes(raw_minutes_played)
                if raw_minutes_played != minutes_played and not any("minutes_played capped" in warning for warning in report.warnings):
                    report.warnings.append(
                        f"minutes_played capped to 120 for schema compatibility (first raw value: {raw_minutes_played})"
                    )
                cost = self._basketball_cost(season_points, season_assists, season_rebounds)
                fantasy_points = self._basketball_fantasy_points(
                    points=points,
                    assists=assists,
                    rebounds=rebounds,
                    steals=steals,
                    blocks=blocks,
                )

                player = self._upsert_player(
                    sport=sport,
                    external_id=f"nba:{player_id}",
                    name=player_name,
                    position="UNK",
                    real_team=team_abbreviation,
                    real_team_ref=team,
                    cost=cost,
                    is_available=True,
                )
                base_stat = self._upsert_base_stat(
                    player=player,
                    transfer_window=transfer_window,
                    minutes_played=minutes_played,
                    fantasy_points=fantasy_points,
                )
                self._upsert_nba_stat(
                    base_stat=base_stat,
                    points=points,
                    assists=assists,
                    rebounds=rebounds,
                    steals=steals,
                    blocks=blocks,
                )
                report.rows_imported += 1
            except Exception as exc:
                report.rows_skipped += 1
                report.warnings.append(f"Row skipped for {player_name or 'unknown'}: {exc}")
                logger.exception("Skipping basketball row in %s", report.path)


def import_attached_datasets(
    db: Session,
    *,
    repo_root: Path | None = None,
    dataset_roots: Iterable[Path] | None = None,
) -> DatasetImportReport:
    importer = DatasetImporter(db, repo_root=repo_root, dataset_roots=dataset_roots)
    return importer.import_all()
