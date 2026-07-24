"""football-data.org name/status mapping — wrong names would create duplicate
Match rows next to the API-Football-created ones."""

from app.services.sync.match_sync import _FDO_STATUS_MAP, _fdo_team_name

# The full 2026-27 EPL: football-data.org full name -> API-Football team name
# (the form stored on Match rows and RealTeam-adjacent fields).
FDO_TO_AF = {
    "Arsenal FC": "Arsenal",
    "Aston Villa FC": "Aston Villa",
    "AFC Bournemouth": "Bournemouth",
    "Brentford FC": "Brentford",
    "Brighton & Hove Albion FC": "Brighton",
    "Chelsea FC": "Chelsea",
    "Coventry City FC": "Coventry",
    "Crystal Palace FC": "Crystal Palace",
    "Everton FC": "Everton",
    "Fulham FC": "Fulham",
    "Hull City AFC": "Hull City",
    "Ipswich Town FC": "Ipswich",
    "Leeds United FC": "Leeds",
    "Liverpool FC": "Liverpool",
    "Manchester City FC": "Manchester City",
    "Manchester United FC": "Manchester United",
    "Newcastle United FC": "Newcastle",
    "Nottingham Forest FC": "Nottingham Forest",
    "Sunderland AFC": "Sunderland",
    "Tottenham Hotspur FC": "Tottenham",
}


def test_all_2026_27_club_names_map():
    for fdo, af in FDO_TO_AF.items():
        assert _fdo_team_name(fdo) == af, f"{fdo!r} -> {_fdo_team_name(fdo)!r}, want {af!r}"


def test_unknown_name_passes_through_stripped():
    assert _fdo_team_name("Wrexham AFC") == "Wrexham"
    assert _fdo_team_name("Some Club FC") == "Some Club"


def test_status_map_never_emits_unknown():
    allowed = {"scheduled", "live", "finished", "postponed", "cancelled"}
    assert set(_FDO_STATUS_MAP.values()) <= allowed
