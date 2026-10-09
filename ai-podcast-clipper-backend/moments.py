import json
import re

MAX_CLIPS = 5


def parse_moments(raw: str) -> list:
    """Turn Gemini's response into a list of moments, salvaging truncated JSON."""
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json"):].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-len("```")].strip()

    try:
        moments = json.loads(cleaned)
    except json.JSONDecodeError:
        # model response got truncated, salvage whatever complete objects are in there
        moments = [
            json.loads(m)
            for m in re.findall(r"\{[^{}]*\}", cleaned)
            if '"start"' in m and '"end"' in m
        ]
        print(f"Salvaged {len(moments)} moments from malformed JSON")
    if not moments or not isinstance(moments, list):
        print("Error: Identified moments is not a list")
        moments = []
    return moments


def select_moments(moments: list, max_clips: int = MAX_CLIPS) -> list:
    """Keep 30-60s moments (some tolerance); top up with the longest leftovers if under 3.

    Never returns more than max_clips: the web app reserves one credit per clip it asks for.
    """
    valid = [
        m for m in moments
        if isinstance(m, dict) and "start" in m and "end" in m
        and m["end"] > m["start"]
    ]
    well_sized = [m for m in valid if 25 <= (m["end"] - m["start"]) <= 70]
    if len(well_sized) < 3:
        extras = sorted(
            (m for m in valid if m not in well_sized and (m["end"] - m["start"]) >= 15),
            key=lambda m: m["end"] - m["start"],
            reverse=True,
        )
        well_sized += extras[: 3 - len(well_sized)]
        print(f"Topped up to {len(well_sized)} moments with shorter clips")
    if well_sized:
        return well_sized[:max_clips]
    print("Warning: no usable moments returned; using raw moments")
    return moments[:max_clips]
