import { DeliberationEvent } from "@/lib/backend";

export type StepBundle = {
  step: number;
  plan: DeliberationEvent | null;
  code: DeliberationEvent | null;
  output: DeliberationEvent | null;
  interpretation: DeliberationEvent | null;
  tag: DeliberationEvent | null;
  knowledge: DeliberationEvent | null;
  knowledge_retrieval: DeliberationEvent | null;
  error: DeliberationEvent | null;
  allTags: string[];
};

export function bundleEvents(events: DeliberationEvent[]): StepBundle[] {
  const byStep = new Map<number, StepBundle>();
  for (const e of events) {
    const step = typeof e.step_number === "number" ? e.step_number : 0;
    let b = byStep.get(step);
    if (!b) {
      b = {
        step,
        plan: null,
        code: null,
        output: null,
        interpretation: null,
        tag: null,
        knowledge: null,
        knowledge_retrieval: null,
        error: null,
        allTags: [],
      };
      byStep.set(step, b);
    }
    const slot = e.event_type as keyof StepBundle;
    if (slot in b && !b[slot]) {
      (b as unknown as Record<string, DeliberationEvent>)[slot] = e;
    }
    for (const t of e.semantic_tags ?? []) {
      if (!b.allTags.includes(t)) b.allTags.push(t);
    }
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}
