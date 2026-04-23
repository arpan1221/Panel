export const SERVER_BACKEND =
  process.env.PANEL_BACKEND ?? "http://backend:8000";

export const BROWSER_BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_BROWSER ?? "http://localhost:8100";

export type RunSummary = {
  experiment_id: string;
  event_count: number;
  status: "running" | "complete" | "failed" | "unknown";
};

export type DeliberationEvent = {
  event_id: string;
  experiment_id: string;
  timestamp: string;
  agent: "implementer" | "interpreter" | "tagger" | "archivist";
  step_number: number;
  cell_ref: string | null;
  event_type:
    | "plan"
    | "code"
    | "output"
    | "interpretation"
    | "tag"
    | "knowledge"
    | "error";
  content: { summary: string; body: string };
  semantic_tags: string[];
  alternatives_considered: { path: string; rejected_because: string }[];
  chosen_because: string | null;
  confidence: number;
  evidence: string[];
  supersedes: string | null;
};

export type KnowledgeEntry = {
  knowledge_id: string;
  experiment_id: string;
  created_at: string;
  claim: string;
  kind: "pattern" | "pitfall" | "heuristic" | "fact";
  evidence_event_ids: string[];
  confidence: number;
};

export type ExperimentFull = {
  experiment_id: string;
  status: RunSummary["status"];
  event_count: number;
  events: DeliberationEvent[];
  knowledge: KnowledgeEntry[];
};

export async function listExperiments(): Promise<{
  runs: RunSummary[];
  count: number;
}> {
  const res = await fetch(`${SERVER_BACKEND}/experiments`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}

export async function getExperiment(id: string): Promise<ExperimentFull> {
  const res = await fetch(`${SERVER_BACKEND}/experiments/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`get failed: ${res.status}`);
  return res.json();
}
