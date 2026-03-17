from __future__ import annotations


def normalize_match_status(provider_status: str | None) -> str:
    """Convert provider-specific status codes/strings to our normalized statuses.

    Normalized statuses used in the DB/sync layer:
      - scheduled
      - live
      - finished
      - postponed
      - cancelled

    This is intentionally conservative: unknown statuses fall back to
    "scheduled" so we don't incorrectly mark a match as finished/live.
    """

    if provider_status is None:
        return "scheduled"

    raw = str(provider_status).strip()
    if not raw:
        return "scheduled"

    upper = raw.upper()

    # Common football short codes (API-Football, etc.)
    if upper in {"NS", "TBD", "SCHEDULED"}:
        return "scheduled"
    if upper in {"1H", "2H", "HT", "ET", "BT", "P", "LIVE", "IN PLAY", "INPLAY"}:
        return "live"
    if upper in {"FT", "AET", "PEN", "FIN", "FINAL", "FINISHED", "ENDED"}:
        return "finished"
    if upper in {"PST", "POSTPONED", "POSTP"}:
        return "postponed"
    if upper in {"CANC", "CANCELLED", "CANCELED", "ABD", "ABANDONED"}:
        return "cancelled"

    # Common verbose statuses across sports
    if "POSTP" in upper:
        return "postponed"
    if "CANCEL" in upper or "ABANDON" in upper:
        return "cancelled"
    if "LIVE" in upper or "IN PLAY" in upper or "IN-PROGRESS" in upper or "IN PROGRESS" in upper:
        return "live"
    if "FINAL" in upper or "FINISH" in upper or "END" in upper:
        return "finished"

    return "scheduled"
