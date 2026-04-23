"""Thin wrapper around anthropic.Messages.create with model routing + usage tracking.

One call site per role. Routing per CLAUDE.md:
- IMPLEMENTER / INTERPRETER / ARCHIVIST → sonnet-4-6
- TAGGER → haiku-4.5 (classification, cheap)
- Hard planning (not used yet) → opus-4-7
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from anthropic import Anthropic

Role = Literal["implementer", "interpreter", "tagger", "archivist"]

MODEL_FOR_ROLE: dict[Role, str] = {
    "implementer": "claude-sonnet-4-6",
    "interpreter": "claude-sonnet-4-6",
    "tagger": "claude-haiku-4-5-20251001",
    "archivist": "claude-sonnet-4-6",
}

_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic()
    return _client


@dataclass
class LLMCall:
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    latency_s: float


def call_role(
    role: Role,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
) -> LLMCall:
    import time

    model = MODEL_FOR_ROLE[role]
    t0 = time.time()
    resp = client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return LLMCall(
        text=text,
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
        model=model,
        latency_s=time.time() - t0,
    )
