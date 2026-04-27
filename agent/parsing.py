"""JSON parsing helpers — shared across all four jury roles.

Claude (especially Haiku) wraps JSON in ```json fences or trails prose.
Strip both. Fall back to the first {...} span. Raise on parse failure so
the caller can retry or log.
"""
from __future__ import annotations

import json
import re

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)
_OPEN_FENCE_RE = re.compile(r"^```(?:json)?\s*", re.IGNORECASE)


def parse_json_object(text: str) -> dict:
    text = text.strip()
    m = _FENCE_RE.search(text)
    if m:
        text = m.group(1).strip()
    else:
        # Tolerate truncated responses that opened a ```json fence but never
        # closed it (output cap hit mid-stream).
        text = _OPEN_FENCE_RE.sub("", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object found: {text[:300]!r}")
    blob = text[start : end + 1]
    try:
        return json.loads(blob)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse failed ({e}): {blob[:300]!r}") from e
