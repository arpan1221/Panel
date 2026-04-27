import { notFound } from "next/navigation";
import { getExperiment } from "@/lib/backend";
import LiveStream from "./LiveStream";

export const dynamic = "force-dynamic";

export default async function ExperimentPage({
  params,
}: {
  params: { id: string };
}) {
  let data;
  try {
    data = await getExperiment(params.id);
  } catch {
    notFound();
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <LiveStream
          experimentId={data.experiment_id}
          initialStatus={data.status}
          initialEvents={data.events}
          initialKnowledge={data.knowledge}
          goal={data.meta?.goal ?? null}
          dataset={data.meta?.dataset ?? null}
          maxSteps={data.meta?.max_steps ?? null}
          startedAt={data.meta?.created_at ?? null}
        />
      </div>
    </main>
  );
}
