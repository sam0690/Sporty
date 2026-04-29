from __future__ import annotations

from app.adapters.base import ISportAdapter
from app.adapters.basketball import BasketballAdapter
from app.adapters.cricket import CricketAdapter
from app.adapters.football import FootballAdapter


ADAPTER_REGISTRY: dict[str, ISportAdapter] = {
    "football": FootballAdapter(),
    "cricket": CricketAdapter(),
    "basketball": BasketballAdapter(),
}
