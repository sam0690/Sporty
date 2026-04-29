from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel


class SportType(str, Enum):
    FOOTBALL = "football"
    CRICKET = "cricket"
    BASKETBALL = "basketball"


class EventType(str, Enum):
    GOAL = "GOAL"
    WICKET = "WICKET"
    BASKET = "BASKET"
    CARD = "CARD"
    SUB = "SUB"
    STAT = "STAT"


class RawEvent(BaseModel):
    sport: SportType
    match_id: str
    type: str
    payload: dict[str, Any]
    timestamp: int


class NormalizedEvent(BaseModel):
    sport: SportType
    match_id: str
    event_type: EventType
    player_id: str
    team_id: str
    value: float
    meta: dict[str, Any]
    ts: int
    event_id: str


class FantasyPointsDelta(BaseModel):
    match_id: str
    player_id: str
    delta: float
    total_points: float
    ts: int


class ScoreUpdate(BaseModel):
    match_id: str
    home: int
    away: int
    minute: int


class LineupChange(BaseModel):
    match_id: str
    team_id: str
    player_in: str
    player_out: str
    minute: int


class WSMessage(BaseModel):
    event: Literal[
        "MATCH_EVENT",
        "FANTASY_POINTS_DELTA",
        "SCORE_UPDATE",
        "LINEUP_CHANGE",
    ]
    data: dict[str, Any]
