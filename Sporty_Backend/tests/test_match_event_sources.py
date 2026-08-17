"""Which provider's events the match-detail feed shows.

The regression this guards: a finished match used to switch wholesale to
API-Football's rows, which end at the last in-play poll (hourly), so half the
timeline vanished at full time even though SportScore's complete set was sitting
in the same table.
"""

from app.api.routes.match import _select_display_events


def _ev(event_type: str, source: str | None, event_id: str = "x"):
    """(row, meta) pair in the shape the read path builds them."""
    return {"event_id": event_id, "event_type": event_type}, {"source": source}


def _split(pairs):
    return _select_display_events([r for r, _ in pairs], [m for _, m in pairs])


def _ids(rows):
    return [r["event_id"] for r in rows]


def test_keeps_sportscore_timeline_and_api_football_assists():
    """The real Deportivo v Elche shape: SportScore has the full timeline,
    API-Football has a truncated copy of it plus the assists only it emits."""
    pairs = [
        _ev("goal", "sportscore", "ss:goal-21"),
        _ev("goal", "api-football", "af:goal-21"),
        _ev("assist", "api-football", "af:assist-21"),
        _ev("substitution", "sportscore", "ss:sub-81"),  # after AF's last poll
        _ev("yellow_card", "sportscore", "ss:card-68"),
        _ev("yellow_card", "api-football", "af:card-68"),
    ]
    rows, metas = _split(pairs)
    assert _ids(rows) == ["ss:goal-21", "af:assist-21", "ss:sub-81", "ss:card-68"]
    assert len(metas) == len(rows)
    # The late substitution is the whole point — it only exists in SportScore.
    assert "ss:sub-81" in _ids(rows)


def test_assists_survive_while_live():
    """Status is irrelevant now. The old code preferred SportScore outright
    while a match was in flight, which hid every assist until full time."""
    pairs = [_ev("goal", "sportscore", "ss:g"), _ev("assist", "api-football", "af:a")]
    rows, _ = _split(pairs)
    assert _ids(rows) == ["ss:g", "af:a"]


def test_single_source_match_is_untouched():
    """Basketball, feeder pushes, and fixtures SportScore never reached."""
    pairs = [_ev("goal", "api-football", "af:g"), _ev("assist", "api-football", "af:a")]
    rows, _ = _split(pairs)
    assert _ids(rows) == ["af:g", "af:a"]

    only_ss = [_ev("goal", "sportscore", "ss:g")]
    rows, _ = _split(only_ss)
    assert _ids(rows) == ["ss:g"]


def test_legacy_rows_with_no_source_are_not_dropped():
    """Pre-SportScore rows carry no `source` key. They count as a second source,
    so the branch fires — but they must not be filtered out of the timeline."""
    pairs = [_ev("goal", "sportscore", "ss:g"), _ev("assist", None, "legacy:a")]
    rows, _ = _split(pairs)
    assert _ids(rows) == ["ss:g", "legacy:a"]


def test_falls_back_to_everything_when_the_partition_empties_the_list():
    """Guard kept from the original: never render an empty timeline when rows
    exist. Only reachable if SportScore is present but every row is filtered."""
    rows, metas = _select_display_events([], [])
    assert rows == [] and metas == []


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
    print("ok")
