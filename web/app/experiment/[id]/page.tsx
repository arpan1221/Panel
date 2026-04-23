import Link from "next/link";
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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-300">
          ← Panel
        </Link>
      </nav>
      <h1 className="mt-2 font-mono text-2xl text-neutral-100">
        {data.experiment_id}
      </h1>

      <div className="mt-6">
        <LiveStream
          experimentId={data.experiment_id}
          initialStatus={data.status}
          initialEvents={data.events}
          initialKnowledge={data.knowledge}
        />
      </div>
    </main>
  );
}
