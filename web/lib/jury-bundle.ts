import { DeliberationEvent } from "@/lib/backend";

export type StepBundle = {
  step: number;
  plan: DeliberationEvent | null;
  code: DeliberationEvent | null;
  output: DeliberationEvent | null;
  interpretation: DeliberationEvent | null;
  tag: DeliberationEvent | null;
  knowledge: DeliberationEvent | null;
  error: DeliberationEvent | null;
  allTags: string[];
};

export function bundleEvents(events: DeliberationEvent[]): StepBundle[] {
  const byStep = new Map<number, StepBundle>();
  for (const e of events) {
    let b = byStep.get(e.step_number);
    if (!b) {
      b = {
        step: e.step_number,
        plan: null,
        code: null,
        output: null,
        interpretation: null,
        tag: null,
        knowledge: null,
        error: null,
        allTags: [],
      };
      byStep.set(e.step_number, b);
    }
    const slot = e.event_type as keyof StepBundle;
    if (slot in b && !b[slot]) {
      (b as unknown as Record<string, DeliberationEvent>)[slot] = e;
    }
    for (const t of e.semantic_tags) {
      if (!b.allTags.includes(t)) b.allTags.push(t);
    }
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}
