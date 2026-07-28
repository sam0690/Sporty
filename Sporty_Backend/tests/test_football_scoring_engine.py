"""Position-aware football scoring interpreter — pure-function tests.

Covers the three things the new engine must get right that the old
goals/assists/cards-only formula got wrong: a keeper's clean-sheet/saves/
pen-save now score (they scored 0 before), a defender earns from defensive
contribution, and the position-weighted worked example (Salah) totals as
designed.
"""
from decimal import Decimal

from app.services.scoring.football_engine import Rule, compute_bps, compute_football_score

# Mirror of the seeded rule set (scripts/seed_football_scoring_rules.py) — the
# subset the tests exercise.
RULES = [
    Rule("appearance", None, "threshold", Decimal(1), Decimal(1)),
    Rule("appearance_full", None, "threshold", Decimal(60), Decimal(1)),
    Rule("goal", "GKP", "per_unit", None, Decimal(6)),
    Rule("goal", "DEF", "per_unit", None, Decimal(6)),
    Rule("goal", "MID", "per_unit", None, Decimal(5)),
    Rule("goal", "FWD", "per_unit", None, Decimal(4)),
    Rule("assist", None, "per_unit", None, Decimal(3)),
    Rule("clean_sheet", "GKP", "per_unit", None, Decimal(4)),
    Rule("clean_sheet", "DEF", "per_unit", None, Decimal(4)),
    Rule("clean_sheet", "MID", "per_unit", None, Decimal(1)),
    Rule("save", "GKP", "per_n", Decimal(3), Decimal(1)),
    Rule("penalty_save", "GKP", "per_unit", None, Decimal(5)),
    Rule("conceded", "GKP", "per_n", Decimal(2), Decimal(-1)),
    Rule("conceded", "DEF", "per_n", Decimal(2), Decimal(-1)),
    Rule("yellow_card", None, "per_unit", None, Decimal(-1)),
    Rule("defensive_contribution", "DEF", "threshold", Decimal(10), Decimal(2)),
    Rule("defensive_contribution", "MID", "threshold", Decimal(12), Decimal(2)),
    Rule("key_pass", "MID", "per_n", Decimal(3), Decimal(1)),
]


def _score(position, **stats):
    return compute_football_score(position, stats, RULES)


def test_salah_worked_example():
    # 90', 1 goal, 1 assist, 4 key passes — MID. (bonus is a separate layer)
    total, breakdown = _score("MID", minutes=90, goals=1, assists=1, key_passes=4)
    # appearance 2 + goal 5 + assist 3 + key_pass(4//3=1) 1 = 11
    assert total == Decimal(11)
    by = {b["action"]: b["subtotal"] for b in breakdown}
    assert by["appearance"] == 1 and by["appearance_full"] == 1
    assert by["goal"] == 5 and by["assist"] == 3 and by["key_pass"] == 1


def test_goalkeeper_clean_sheet_saves_penalty_now_score():
    # The exact case that scored 0 under the old formula.
    total, breakdown = _score(
        "GKP", minutes=90, clean_sheets=1, saves=6, penalties_saved=1, goals=0
    )
    # appearance 2 + clean_sheet 4 + saves(6//3=2) + pen_save 5 = 13
    assert total == Decimal(13)


def test_defender_rewarded_for_defensive_work_without_a_goal():
    total, _ = _score("DEF", minutes=90, tackles=6, interceptions=3, blocks=2)
    # appearance 2 + defensive_contribution(11 >= 10) 2 = 4
    assert total == Decimal(4)


def test_position_weighting_and_conceded():
    # A defender who scores + concedes 2: appearance 2 + goal 6 + conceded(2//2=1)*-1
    total, _ = _score("DEF", minutes=90, goals=1, goals_conceded=2)
    assert total == Decimal(2 + 6 - 1)
    # Same line as a forward: goal worth 4, forwards have no conceded rule.
    total_fwd, _ = _score("FWD", minutes=90, goals=1, goals_conceded=2)
    assert total_fwd == Decimal(2 + 4)


def test_sub_sixty_minutes_is_one_appearance_point():
    total, _ = _score("MID", minutes=30)
    assert total == Decimal(1)


def test_bps_rewards_all_around_and_is_position_aware():
    # A forward's single goal.
    fwd = compute_bps("FWD", {"minutes": 90, "goals": 1})  # 6 + 24
    assert fwd == Decimal(30)
    # A defender with a clean sheet + heavy defensive work and no goal is
    # competitive on BPS — the point of the system.
    defn = compute_bps("DEF", {"minutes": 90, "clean_sheets": 1,
                               "tackles": 5, "interceptions": 3, "blocks": 2})
    assert defn == Decimal(6 + 12 + 10 + 3 + 2)  # 33
    # Cards/own goals drag BPS down.
    assert compute_bps("MID", {"minutes": 90, "red_cards": 1}) == Decimal(6 - 9)
