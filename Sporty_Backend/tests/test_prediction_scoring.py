"""Rubric check for the Predictor scoring ladder (5/3/1/0)."""

from app.prediction.services import (
    POINTS_EXACT,
    POINTS_RESULT,
    POINTS_RESULT_AND_GD,
    POINTS_WRONG,
    score_prediction,
)


def test_exact_score():
    assert score_prediction(2, 1, 2, 1) == POINTS_EXACT
    assert score_prediction(0, 0, 0, 0) == POINTS_EXACT


def test_correct_result_and_goal_difference():
    # predicted home win by 1, actual home win by 1, but not exact
    assert score_prediction(2, 1, 3, 2) == POINTS_RESULT_AND_GD
    # draw with same (zero) GD but different scoreline
    assert score_prediction(1, 1, 2, 2) == POINTS_RESULT_AND_GD


def test_correct_result_only():
    # both home wins, different goal difference
    assert score_prediction(2, 1, 3, 0) == POINTS_RESULT
    assert score_prediction(3, 0, 1, 0) == POINTS_RESULT


def test_wrong_result():
    assert score_prediction(2, 1, 0, 1) == POINTS_WRONG  # predicted home, away won
    assert score_prediction(1, 1, 2, 0) == POINTS_WRONG  # predicted draw, home won
    assert score_prediction(0, 2, 1, 1) == POINTS_WRONG  # predicted away, draw


if __name__ == "__main__":
    test_exact_score()
    test_correct_result_and_goal_difference()
    test_correct_result_only()
    test_wrong_result()
    print("prediction scoring ok")
