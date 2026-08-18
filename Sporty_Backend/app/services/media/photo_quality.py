"""Classify a player photo by its bytes, without decoding it.

Lives in app/ rather than in the script so the audit and the write path share
one definition of "good". The script both *reports* on stored photos and
*accepts or rejects* freshly-fetched ones; if those used different rules it
could report a player as fixed while having written something no better than
what it replaced.

Deliberately header-only: Pillow is not a dependency of this project and a
full decode buys nothing here. The PNG IHDR chunk is at a fixed offset and the
JPEG SOF marker is a short walk, so the first ~2KB of a ranged GET is enough
to classify — which also means the audit never downloads 2,000 full images.

Thresholds are calibrated against the live pool (2026-08-18), not guessed:

  * ok          the TheSportsDB `strCutout` / FPL headshot shape — 500x500
                transparent PNG, 190-330KB.
  * placeholder API-Football serves a generic grey silhouette for players it
                has no photo of. It is a real 150x150 PNG, so only its size
                distinguishes it: ~5KB against 18-28KB for a real face.
  * action      only the Wikipedia fallback tier ever wrote JPEGs, and those
                are match-action shots — wrong crop, wrong framing.
  * lowres      API-Football's real headshots. Correct framing, too soft.
"""
from __future__ import annotations

import struct

OK = "ok"
LOWRES = "lowres"
PLACEHOLDER = "placeholder"
ACTION = "action"
MISSING = "missing"
UNREADABLE = "unreadable"
# Distinct from MISSING: the player HAS a photo_url, we just could not read it
# this run. Conflating the two makes a transient network blip look like data
# loss — 117 perfectly good photos were reported missing that way.
UNREACHABLE = "unreachable"

MIN_OK_EDGE = 400
MIN_OK_BYTES = 60_000
MAX_PLACEHOLDER_BYTES = 9_000

# Enough for the PNG IHDR and for the JPEG SOF of every image in the pool.
HEADER_BYTES = 2048


def read_dimensions(header: bytes) -> tuple[str, int, int] | None:
    """(format, width, height) from an image header, or None if unrecognised."""
    if header[:8] == b"\x89PNG\r\n\x1a\n" and len(header) >= 24:
        width, height = struct.unpack(">II", header[16:24])
        return "PNG", width, height

    if header[:2] == b"\xff\xd8":
        offset = 2
        while offset + 9 <= len(header):
            if header[offset] != 0xFF:
                offset += 1
                continue
            marker = header[offset + 1]
            # SOF0/1/2 carry the frame dimensions; every other marker is a
            # length-prefixed segment we skip over.
            if marker in (0xC0, 0xC1, 0xC2):
                height, width = struct.unpack(">HH", header[offset + 5 : offset + 9])
                return "JPEG", width, height
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                offset += 2
                continue
            segment = struct.unpack(">H", header[offset + 2 : offset + 4])[0]
            if segment < 2:
                return None
            offset += 2 + segment
        return "JPEG", 0, 0

    return None


def classify(header: bytes | None, total_bytes: int) -> str:
    """Grade a photo. `total_bytes` is the full object size, not len(header)."""
    if not header:
        return MISSING

    parsed = read_dimensions(header)
    if parsed is None:
        return UNREADABLE

    image_format, width, height = parsed

    # Checked before format so an undersized JPEG is not mislabelled as a
    # salvageable action shot — a 5KB grey square is a placeholder either way.
    if total_bytes < MAX_PLACEHOLDER_BYTES:
        return PLACEHOLDER
    if image_format == "JPEG":
        return ACTION
    if width >= MIN_OK_EDGE and height >= MIN_OK_EDGE and total_bytes > MIN_OK_BYTES:
        return OK
    return LOWRES


def is_acceptable(header: bytes | None, total_bytes: int) -> bool:
    """Gate on the write path: only OK bytes may replace an existing photo."""
    return classify(header, total_bytes) == OK
