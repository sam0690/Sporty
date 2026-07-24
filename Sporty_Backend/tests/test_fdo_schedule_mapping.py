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

# La Liga + Bundesliga 2026-27 (verified against both providers 2026-07-24)
FDO_TO_AF_ES_DE = {
    "Athletic Club": "Athletic Club",
    "CA Osasuna": "Osasuna",
    "Club Atlético de Madrid": "Atletico Madrid",
    "Deportivo Alavés": "Alaves",
    "Elche CF": "Elche",
    "FC Barcelona": "Barcelona",
    "Getafe CF": "Getafe",
    "Levante UD": "Levante",
    "Málaga CF": "Malaga",
    "RC Celta de Vigo": "Celta Vigo",
    "RC Deportivo La Coruña": "Deportivo La Coruna",
    "RCD Espanyol de Barcelona": "Espanyol",
    "Rayo Vallecano de Madrid": "Rayo Vallecano",
    "Real Betis Balompié": "Real Betis",
    "Real Madrid CF": "Real Madrid",
    "Real Racing Club de Santander": "Racing Santander",
    "Real Sociedad de Fútbol": "Real Sociedad",
    "Sevilla FC": "Sevilla",
    "Valencia CF": "Valencia",
    "Villarreal CF": "Villarreal",
    "1. FC Köln": "1. FC Köln",
    "1. FC Union Berlin": "Union Berlin",
    "1. FSV Mainz 05": "FSV Mainz 05",
    "Bayer 04 Leverkusen": "Bayer Leverkusen",
    "Borussia Dortmund": "Borussia Dortmund",
    "Borussia Mönchengladbach": "Borussia Mönchengladbach",
    "Eintracht Frankfurt": "Eintracht Frankfurt",
    "FC Augsburg": "FC Augsburg",
    "FC Bayern München": "Bayern München",
    "FC Schalke 04": "FC Schalke 04",
    "Hamburger SV": "Hamburger SV",
    "RB Leipzig": "RB Leipzig",
    "SC Freiburg": "SC Freiburg",
    "SC Paderborn 07": "SC Paderborn 07",
    "SV 07 Elversberg": "SV Elversberg",
    "SV Werder Bremen": "Werder Bremen",
    "TSG 1899 Hoffenheim": "1899 Hoffenheim",
    "VfB Stuttgart": "VfB Stuttgart",
}


def test_all_laliga_bundesliga_names_map():
    for fdo, af in FDO_TO_AF_ES_DE.items():
        assert _fdo_team_name(fdo) == af, f"{fdo!r} -> {_fdo_team_name(fdo)!r}, want {af!r}"


def test_all_2026_27_club_names_map():
    for fdo, af in FDO_TO_AF.items():
        assert _fdo_team_name(fdo) == af, f"{fdo!r} -> {_fdo_team_name(fdo)!r}, want {af!r}"


def test_unknown_name_passes_through_stripped():
    assert _fdo_team_name("Wrexham AFC") == "Wrexham"
    assert _fdo_team_name("Some Club FC") == "Some Club"


def test_status_map_never_emits_unknown():
    allowed = {"scheduled", "live", "finished", "postponed", "cancelled"}
    assert set(_FDO_STATUS_MAP.values()) <= allowed
