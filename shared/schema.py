"""
Panel — Deliberation Schema

Single source of truth for events written by any agent. This schema is read by:
- the agent runtime (/agent)
- the backend SSE endpoint (/backend)
- the web UI (/web, via TypeScript mirror)
- the share-page static renderer

Any change here requires updating all four consumers.
"""

from datetime import datetime
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    IMPLEMENTER = "implementer"
    INTERPRETER = "interpreter"
    TAGGER = "tagger"
    ARCHIVIST = "archivist"


class EventType(str, Enum):
    PLAN = "plan"                   # implementer declares what it's about to try
    CODE = "code"                   # a code cell was written
    OUTPUT = "output"               # a cell executed, producing output
    INTERPRETATION = "interpretation"  # interpreter's reading of output
    TAG = "tag"                     # tagger's semantic tagging
    KNOWLEDGE = "knowledge"         # archivist committed a knowledge entry
    ERROR = "error"                 # something went wrong (kept for audit)


class SemanticTag(str, Enum):
    """The eight-tag vocabulary. Exhaustive. Do not add without updating README."""
    HYPOTHESIS = "hypothesis"
    DATA_CHECK = "data-check"
    METHOD_CHOICE = "method-choice"
    DEBUG = "debug"
    PIVOT = "pivot"
    RESULT = "result"
    PITFALL_DETECTED = "pitfall-detected"
    DECISION = "decision"


class Alternative(BaseModel):
    path: str = Field(..., description="Short description of the alternative path")
    rejected_because: str = Field(..., description="Reason this alternative was not chosen")


class EventContent(BaseModel):
    summary: str = Field(..., max_length=200, description="One-sentence description")
    body: str = Field(..., description="Full content — code, interpretation text, etc.")


class DeliberationEvent(BaseModel):
    event_id: str = Field(..., description="Unique within the experiment, e.g. evt_0001")
    experiment_id: str = Field(..., description="The experiment this event belongs to")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent: AgentRole
    step_number: int = Field(..., ge=0, description="Sequential step in the experiment")
    cell_ref: str | None = Field(None, description="Notebook cell this relates to, if any")
    event_type: EventType

    content: EventContent

    semantic_tags: list[SemanticTag] = Field(default_factory=list)

    alternatives_considered: list[Alternative] = Field(default_factory=list)
    chosen_because: str | None = Field(None, description="Rationale for the chosen path")

    confidence: float = Field(0.5, ge=0.0, le=1.0, description="Agent's confidence in this event")

    evidence: list[str] = Field(
        default_factory=list,
        description="IDs of prior events that support this one"
    )
    supersedes: str | None = Field(
        None,
        description="If this event overrides a previous one, the superseded event_id"
    )

    def to_jsonl(self) -> str:
        """One-line JSON, ready to append to deliberation.jsonl."""
        return self.model_dump_json() + "\n"


class KnowledgeEntry(BaseModel):
    """What the Archivist commits to the persistent knowledge base."""
    knowledge_id: str
    experiment_id: str                 # experiment that produced this
    created_at: datetime = Field(default_factory=datetime.utcnow)
    claim: str = Field(..., max_length=500, description="The thing now known")
    kind: Literal["pattern", "pitfall", "heuristic", "fact"]
    evidence_event_ids: list[str] = Field(..., description="Deliberation events supporting this")
    confidence: float = Field(..., ge=0.0, le=1.0)
    superseded_by: str | None = None   # for when a later experiment contradicts this


class ExperimentState(BaseModel):
    """Top-level state for an experiment. One of these per experiment."""
    experiment_id: str
    user_id: str
    goal: str
    dataset_ref: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: Literal["pending", "running", "complete", "failed", "cancelled"]
    event_count: int = 0
    knowledge_refs: list[str] = Field(default_factory=list)
    notebook_path: str | None = None
    share_url: str | None = None
