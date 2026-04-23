"""DeliberationEvent + KnowledgeEntry constructors, with a monotonic counter
and append-only JSONL persistence.

Every event the jury emits goes through `EventStream.emit(...)`. That way
there is exactly one producer of event_ids and one file-writer, so the
consumer (backend SSE, web UI, share renderer) sees a clean append-only log.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from shared.schema import (
    AgentRole,
    Alternative,
    DeliberationEvent,
    EventContent,
    EventType,
    KnowledgeEntry,
    SemanticTag,
)


class EventStream:
    def __init__(self, experiment_id: str, out_dir: Path):
        self.experiment_id = experiment_id
        self.out_dir = out_dir
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.delib_path = out_dir / "deliberation.jsonl"
        self.knowledge_path = out_dir / "knowledge.jsonl"
        self._counter = 0
        self._events: list[DeliberationEvent] = []
        self._knowledge: list[KnowledgeEntry] = []
        # Truncate any prior output.
        self.delib_path.write_text("")
        self.knowledge_path.write_text("")

    def _next_id(self) -> str:
        self._counter += 1
        return f"evt_{self._counter:04d}"

    def emit(
        self,
        *,
        agent: AgentRole,
        event_type: EventType,
        step_number: int,
        summary: str,
        body: str,
        cell_ref: str | None = None,
        semantic_tags: Iterable[SemanticTag] = (),
        alternatives_considered: Iterable[Alternative] = (),
        chosen_because: str | None = None,
        confidence: float = 0.5,
        evidence: Iterable[str] = (),
        supersedes: str | None = None,
    ) -> DeliberationEvent:
        event = DeliberationEvent(
            event_id=self._next_id(),
            experiment_id=self.experiment_id,
            timestamp=datetime.utcnow(),
            agent=agent,
            step_number=step_number,
            cell_ref=cell_ref,
            event_type=event_type,
            content=EventContent(summary=summary[:200], body=body),
            semantic_tags=list(semantic_tags),
            alternatives_considered=list(alternatives_considered),
            chosen_because=chosen_because,
            confidence=confidence,
            evidence=list(evidence),
            supersedes=supersedes,
        )
        self._events.append(event)
        with self.delib_path.open("a") as f:
            f.write(event.to_jsonl())
        return event

    def commit_knowledge(self, entry: KnowledgeEntry) -> None:
        self._knowledge.append(entry)
        with self.knowledge_path.open("a") as f:
            f.write(entry.model_dump_json() + "\n")

    @property
    def events(self) -> list[DeliberationEvent]:
        return self._events

    def recent(self, n: int = 10) -> list[DeliberationEvent]:
        return self._events[-n:]


def parse_tags(raw: Any) -> list[SemanticTag]:
    """Accept a list of strings; drop anything not in the vocabulary."""
    if not isinstance(raw, list):
        return []
    valid = {t.value for t in SemanticTag}
    out: list[SemanticTag] = []
    for item in raw:
        if isinstance(item, str) and item in valid:
            out.append(SemanticTag(item))
    return out


def parse_alternatives(raw: Any) -> list[Alternative]:
    if not isinstance(raw, list):
        return []
    out: list[Alternative] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        reason = item.get("rejected_because")
        if path and reason:
            out.append(Alternative(path=str(path), rejected_because=str(reason)))
    return out
