"""Phase 3: the API-Football /fixtures/players sheet parser captures the
advanced metrics (tackles/interceptions/blocks/key passes/shots-on-target/
duels/dribbles/rating) that drive defensive-contribution + advanced scoring.
"""
import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")
_backend_root = Path(__file__).resolve().parents[1]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.services.sync.football_live_sync import _parse_player_sheet  # noqa: E402


class _P:
    def __init__(self):
        self.id = uuid.uuid4()


def test_parser_extracts_advanced_metrics_and_clean_sheet():
    pid = _P()
    payload = {
        "response": [
            {
                "team": {"id": 1},
                "players": [
                    {
                        "player": {"id": 100},
                        "statistics": [
                            {
                                "games": {"minutes": 90, "rating": "7.5"},
                                "goals": {"total": 1, "assists": 0, "saves": 0, "conceded": 0},
                                "cards": {"yellow": 0, "red": 0},
                                "penalty": {},
                                "shots": {"total": 3, "on": 2},
                                "passes": {"total": 40, "key": 4},
                                "tackles": {"total": 6, "blocks": 2, "interceptions": 3},
                                "duels": {"total": 10, "won": 7},
                                "dribbles": {"attempts": 5, "success": 3},
                            }
                        ],
                    }
                ],
            }
        ]
    }
    # team 1 is home; away scored 0 → home conceded 0 → clean sheet at 90'
    fixture = {"teams": {"home": {"id": 1}, "away": {"id": 2}}, "goals": {"home": 1, "away": 0}}

    sheet = _parse_player_sheet(payload, fixture, lambda api_id: pid if api_id == 100 else None)
    row = sheet[pid.id]

    assert row["tackles"] == 6 and row["interceptions"] == 3 and row["blocks"] == 2
    assert row["clearances"] == 0  # API-Football has no clearances field
    assert row["key_passes"] == 4 and row["shots_on_target"] == 2
    assert row["duels_won"] == 7 and row["dribbles_won"] == 3
    assert row["rating"] == 7.5
    assert row["clean_sheets"] == 1
    # defensive_contribution basis = 6+3+2+0 = 11 (>= 10 defender threshold)
    assert row["tackles"] + row["interceptions"] + row["blocks"] + row["clearances"] == 11


def test_parser_defaults_missing_advanced_blocks_to_zero():
    pid = _P()
    payload = {"response": [{"team": {"id": 1}, "players": [
        {"player": {"id": 100}, "statistics": [{"games": {"minutes": 20}}]},
    ]}]}
    fixture = {"teams": {"home": {"id": 1}, "away": {"id": 2}}, "goals": {"home": 0, "away": 1}}
    sheet = _parse_player_sheet(payload, fixture, lambda api_id: pid if api_id == 100 else None)
    row = sheet[pid.id]
    assert row["tackles"] == 0 and row["key_passes"] == 0 and row["shots_on_target"] == 0
    assert row["rating"] is None
    assert row["clean_sheets"] == 0  # conceded 1
