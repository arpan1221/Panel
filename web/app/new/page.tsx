import Link from "next/link";
import NewRunForm from "../NewRunForm";

export default function NewRun() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-300">
          ← Panel
        </Link>
      </nav>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          New experiment
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a preset or type your own goal. The jury will spin up
          immediately and you&apos;ll be taken to the live view.
        </p>
      </header>

      <section className="mt-8 rounded-lg border border-neutral-800 p-5">
        <NewRunForm />
      </section>

      <aside className="mt-8 rounded-lg border border-neutral-900 bg-neutral-950 p-5 text-xs text-neutral-500">
        <div className="font-medium text-neutral-300">
          Tip: writing a good goal
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>State what you want to predict or learn, plus the success signal.</li>
          <li>
            Name the constraints that matter (<em>with cross-validation</em>,{" "}
            <em>handle class imbalance</em>, <em>on the log-price target</em>).
          </li>
          <li>
            The Implementer will read your goal verbatim and plan the first
            step. Concrete goals produce sharper deliberations.
          </li>
        </ul>
      </aside>
    </main>
  );
}
