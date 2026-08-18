"""Classifier used by scripts/refresh_player_photos.py.

Pure byte-level unit tests — no network, no DB. Every case is a real shape
observed in the production pool on 2026-08-18, so a regression here means the
audit counts and the write-path accept guard have silently changed meaning.
"""
import struct

from app.services.media.photo_quality import (
    ACTION,
    LOWRES,
    MISSING,
    OK,
    PLACEHOLDER,
    UNREADABLE,
    classify,
    is_acceptable,
    read_dimensions,
)


def png_header(width: int, height: int) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", width, height) + b"\x08\x06\x00\x00\x00"


def jpeg_header(width: int, height: int) -> bytes:
    return (
        b"\xff\xd8"
        + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9
        + b"\xff\xc0" + struct.pack(">H", 17) + b"\x08" + struct.pack(">HH", height, width) + b"\x03" + b"\x00" * 9
    )


def test_reads_png_dimensions():
    assert read_dimensions(png_header(500, 500)) == ("PNG", 500, 500)


def test_reads_jpeg_dimensions_past_a_leading_segment():
    # The SOF marker is not the first marker; the parser must skip the
    # length-prefixed JFIF segment to reach it.
    assert read_dimensions(jpeg_header(700, 700)) == ("JPEG", 700, 700)


def test_studio_cutout_is_ok():
    # TheSportsDB strCutout / FPL headshot: 500x500 RGBA, ~200-330KB.
    assert classify(png_header(500, 500), 210_000) == OK


def test_api_football_headshot_is_lowres():
    # Correct framing, too soft to sit next to a 500px cutout.
    assert classify(png_header(150, 150), 22_000) == LOWRES


def test_grey_silhouette_is_placeholder():
    # Same 150x150 PNG shape as a real headshot — only the size gives it away.
    assert classify(png_header(150, 150), 5_100) == PLACEHOLDER


def test_wikipedia_action_shot_is_action():
    assert classify(jpeg_header(700, 700), 64_000) == ACTION


def test_no_photo_is_missing():
    assert classify(None, 0) == MISSING


def test_undersized_jpeg_is_placeholder_not_action():
    # Size is checked before format, so a tiny JPEG is not mistaken for a
    # salvageable action shot.
    assert classify(jpeg_header(150, 150), 4_000) == PLACEHOLDER


def test_large_png_just_under_the_edge_threshold_is_lowres():
    # 399px fails the >=400 edge rule even though the file is big.
    assert classify(png_header(399, 500), 200_000) == LOWRES


def test_big_dimensions_but_tiny_file_is_not_ok():
    # A 500x500 that weighs 8KB is a flat placeholder, not a photograph.
    assert classify(png_header(500, 500), 8_000) == PLACEHOLDER


def test_garbage_bytes_are_unreadable():
    assert classify(b"<html>404 not found</html>", 26) == UNREADABLE


def test_accept_guard_only_passes_studio_grade():
    # The whole point of the guard: never trade one bad photo for another.
    assert is_acceptable(png_header(500, 500), 210_000) is True
    assert is_acceptable(png_header(150, 150), 22_000) is False
    assert is_acceptable(jpeg_header(700, 700), 64_000) is False
    assert is_acceptable(None, 0) is False
