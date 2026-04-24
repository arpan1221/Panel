"""Cross-experiment knowledge retrieval — TF-IDF + cosine, no extra API.

Reads every `runs/<id>/knowledge.jsonl` on disk, builds a tiny TF-IDF index,
and returns the top-K most relevant entries for a given query (typically the
new experiment's goal + dataset description).

Why TF-IDF and not embeddings: zero new dependency, zero new API key, fast
enough for thousands of entries. We can graduate to Voyage/OpenAI embeddings
in a follow-up without changing the public surface of this module.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from shared.schema import KnowledgeEntry


@dataclass
class RetrievedEntry:
    entry: KnowledgeEntry
    score: float
    source_run_id: str

    def to_compact_dict(self) -> dict:
        return {
            "knowledge_id": self.entry.knowledge_id,
            "kind": self.entry.kind,
            "claim": self.entry.claim,
            "confidence": self.entry.confidence,
            "source_experiment_id": self.entry.experiment_id,
            "source_run_id": self.source_run_id,
            "score": round(self.score, 4),
        }


def _load_meta(run_dir: Path) -> dict:
    meta_path = run_dir / "meta.json"
    if not meta_path.exists():
        return {}
    try:
        return json.loads(meta_path.read_text())
    except json.JSONDecodeError:
        return {}


def _is_run_complete(run_dir: Path) -> bool:
    """Heuristic: a run is "complete enough to learn from" if it has a
    deliberation.jsonl with at least one event AND a knowledge.jsonl
    that's been written. We don't gate on the subprocess exit code
    because the run tracker is in-memory and lost on backend restart."""
    delib = run_dir / "deliberation.jsonl"
    kb = run_dir / "knowledge.jsonl"
    if not (delib.exists() and kb.exists()):
        return False
    try:
        return any(line.strip() for line in delib.read_text().splitlines())
    except OSError:
        return False


def load_all_knowledge(
    runs_root: Path, exclude_run_id: str | None = None
) -> list[tuple[KnowledgeEntry, str]]:
    """Walk runs/, return [(entry, run_id), …] across every COMPLETE run."""
    out: list[tuple[KnowledgeEntry, str]] = []
    if not runs_root.exists():
        return out
    for entry_dir in sorted(runs_root.iterdir()):
        if not entry_dir.is_dir():
            continue
        if exclude_run_id and entry_dir.name == exclude_run_id:
            continue
        if not _is_run_complete(entry_dir):
            continue
        kb_path = entry_dir / "knowledge.jsonl"
        for line in kb_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                ke = KnowledgeEntry.model_validate_json(line)
            except (ValueError, TypeError):
                continue
            out.append((ke, entry_dir.name))
    return out


_word_re = re.compile(r"[A-Za-z][A-Za-z0-9_]+")


def _tokenize(text: str) -> list[str]:
    return [w.lower() for w in _word_re.findall(text)]


def _doc_text(entry: KnowledgeEntry) -> str:
    """What gets indexed for retrieval. Heavier weight on claim + kind."""
    return f"{entry.claim} {entry.claim} {entry.kind} {entry.kind}"


def retrieve(
    query: str,
    runs_root: Path,
    *,
    exclude_run_id: str | None = None,
    top_k: int = 3,
    min_score: float = 0.05,
) -> list[RetrievedEntry]:
    """Return the top_k entries most similar to `query`.

    `query` is typically `f"{goal}\n\n{dataset_description}"`. Returns at most
    top_k results above min_score; empty list if the KB is empty or nothing
    crosses the floor."""
    pairs = load_all_knowledge(runs_root, exclude_run_id=exclude_run_id)
    if not pairs:
        return []

    docs = [_doc_text(e) for e, _ in pairs]
    try:
        vec = TfidfVectorizer(
            tokenizer=_tokenize,
            lowercase=False,
            token_pattern=None,
            min_df=1,
            stop_words=None,
        )
        doc_mat = vec.fit_transform(docs + [query])
    except ValueError:
        # vocabulary is empty, query had no tokens overlapping anything indexed
        return []
    sims = cosine_similarity(doc_mat[-1], doc_mat[:-1]).ravel()
    ranked = sorted(
        (
            RetrievedEntry(entry=pairs[i][0], score=float(sims[i]), source_run_id=pairs[i][1])
            for i in range(len(pairs))
        ),
        key=lambda r: r.score,
        reverse=True,
    )
    return [r for r in ranked[:top_k] if r.score >= min_score]


def format_for_prompt(retrieved: Iterable[RetrievedEntry]) -> str:
    """Compact, dollar-cheap rendering of retrieved entries for the
    Implementer's prompt."""
    items = list(retrieved)
    if not items:
        return "(no prior knowledge found in your knowledge base)"
    lines = [
        f"The Archivist has surfaced {len(items)} prior knowledge entries from past experiments. "
        f"Treat these as priors — apply them where they fit, ignore where they don't.",
        "",
    ]
    for r in items:
        lines.append(
            f"- [{r.entry.kind}] {r.entry.claim} "
            f"(source: {r.source_run_id}, conf {r.entry.confidence:.2f}, similarity {r.score:.2f})"
        )
    return "\n".join(lines)
