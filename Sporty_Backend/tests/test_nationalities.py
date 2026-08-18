"""Guards on the nationality -> flag-code map.

A bad code here is invisible in Python and only surfaces as a 404 image in
the browser, so the shape of every value is asserted rather than eyeballed.
"""
import re

import pytest

from app.services.sync import nationalities
from app.services.sync.nationalities import NATIONALITY_TO_ISO, flag_key, iso_code

# flagcdn serves ISO 3166-1 alpha-2, plus GB subdivisions like "gb-eng".
CODE_PATTERN = re.compile(r"^[a-z]{2}(-[a-z]{3})?$")


def test_every_code_is_well_formed():
    bad = {name: code for name, code in NATIONALITY_TO_ISO.items() if not CODE_PATTERN.match(code)}
    assert bad == {}


def test_every_key_is_lowercase_and_trimmed():
    # iso_code() lowercases its input, so an uppercase key is unreachable.
    bad = [name for name in NATIONALITY_TO_ISO if name != name.strip().lower()]
    assert bad == []


def test_iso_code_normalises_input():
    assert iso_code("  FRANCE  ") == "fr"
    assert iso_code("Brazil") == "br"


@pytest.mark.parametrize("value", [None, "", "   ", "Wakanda"])
def test_iso_code_returns_none_when_unmapped(value):
    assert iso_code(value) is None


@pytest.mark.parametrize(
    "nationality,code",
    [
        ("England", "gb-eng"),
        ("Scotland", "gb-sct"),
        ("Wales", "gb-wls"),
        ("Northern Ireland", "gb-nir"),
        ("Kosovo", "xk"),
        # The UK itself is a real ISO country and must not collide with them.
        ("United Kingdom", "gb"),
    ],
)
def test_home_nations_have_their_own_flags(nationality, code):
    assert iso_code(nationality) == code


@pytest.mark.parametrize(
    "aliases",
    [
        ("usa", "united states"),
        ("dr congo", "congo dr", "drc"),
        ("the netherlands", "netherlands"),
        ("south korea", "korea, south", "korea republic"),
        ("ivory coast", "cote d'ivoire"),
        ("czechia", "czech republic"),
        ("ireland", "republic of ireland"),
        ("turkey", "türkiye"),
        ("trinidad & tobago", "trinidad and tobago"),
        ("bosnia and herzegovina", "bosnia-herzegovina"),
        ("cape verde", "cape verde islands"),
    ],
)
def test_provider_spellings_agree(aliases):
    codes = {iso_code(a) for a in aliases}
    assert len(codes) == 1 and None not in codes


def test_congo_and_dr_congo_are_different_countries():
    assert iso_code("Congo") != iso_code("DR Congo")


def test_flag_url_is_built_from_the_r2_base(monkeypatch):
    monkeypatch.setattr(nationalities.settings, "R2_PUBLIC_URL_BASE", "https://cdn.example/", raising=False)
    assert nationalities.flag_url("Brazil") == "https://cdn.example/flags/br.svg"
    assert nationalities.flag_url("England") == "https://cdn.example/flags/gb-eng.svg"
    assert nationalities.flag_url("Wakanda") is None


def test_flag_url_is_none_without_r2(monkeypatch):
    monkeypatch.setattr(nationalities.settings, "R2_PUBLIC_URL_BASE", "", raising=False)
    assert nationalities.flag_url("Brazil") is None


def test_flag_key_matches_the_upload_script():
    assert flag_key("gb-eng") == "flags/gb-eng.svg"
