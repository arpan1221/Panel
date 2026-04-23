import * as vscode from "vscode";

const LAST_RUN_KEY = "panel.lastRunId";

type CreateResponse = {
  experiment_id: string;
  status: string;
  run_dir: string;
};

type Health = { status: string; active_runs?: number };

type ListResponse = {
  runs: { experiment_id: string; status: string; event_count: number }[];
};

function cfg<T>(key: string, fallback: T): T {
  const v = vscode.workspace.getConfiguration("panel").get<T>(key);
  return v === undefined ? fallback : v;
}

function backend(): string {
  return cfg<string>("backendUrl", "http://localhost:8100");
}

function web(): string {
  return cfg<string>("webUrl", "http://localhost:3100");
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${backend()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${backend()}${path}`);
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

function defaultDatasetFromWorkspace(): string {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return "examples/titanic/data/train.csv";
  const uri = vscode.window.activeTextEditor?.document.uri;
  if (uri && uri.fsPath.toLowerCase().endsWith(".csv")) {
    // relative to workspace root so it resolves inside the backend container
    const rel = vscode.workspace.asRelativePath(uri, false);
    return rel;
  }
  return "examples/titanic/data/train.csv";
}

async function runExperiment(context: vscode.ExtensionContext) {
  // Health check first — surface a readable error if the backend is down.
  try {
    const h = await getJSON<Health>("/health");
    if (h.status !== "ok") {
      vscode.window.showErrorMessage(
        `Panel backend reachable but unhealthy (${h.status}). Start it with \`docker compose up -d\`.`
      );
      return;
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `Cannot reach Panel backend at ${backend()}: ${e}. Is \`docker compose up\` running?`
    );
    return;
  }

  const goal = await vscode.window.showInputBox({
    prompt: "What do you want to learn? (the Implementer reads this verbatim)",
    placeHolder:
      "Predict survival on Titanic and tell me which features actually matter.",
    ignoreFocusOut: true,
  });
  if (!goal?.trim()) return;

  const defaultDataset = defaultDatasetFromWorkspace();
  const dataset = await vscode.window.showInputBox({
    prompt:
      "Dataset path (relative to the Panel repo — visible inside the backend container)",
    value: defaultDataset,
    ignoreFocusOut: true,
  });
  if (!dataset?.trim()) return;

  const maxStepsStr = await vscode.window.showInputBox({
    prompt: "Max steps",
    value: String(cfg<number>("defaultMaxSteps", 8)),
    ignoreFocusOut: true,
    validateInput: (v) =>
      /^\d+$/.test(v) && +v >= 1 && +v <= 20 ? null : "1–20",
  });
  if (!maxStepsStr) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Panel: spawning the jury…",
      cancellable: false,
    },
    async () => {
      let resp: CreateResponse;
      try {
        resp = await postJSON<CreateResponse>("/experiments", {
          goal,
          dataset,
          max_steps: Number(maxStepsStr),
        });
      } catch (e) {
        vscode.window.showErrorMessage(`Panel: failed to launch — ${e}`);
        return;
      }

      await context.workspaceState.update(LAST_RUN_KEY, resp.experiment_id);

      const url = `${web()}/experiment/${resp.experiment_id}`;
      const pick = await vscode.window.showInformationMessage(
        `Panel run ${resp.experiment_id} started.`,
        "Open live view",
        "Copy ID"
      );
      if (pick === "Open live view") {
        vscode.env.openExternal(vscode.Uri.parse(url));
      } else if (pick === "Copy ID") {
        await vscode.env.clipboard.writeText(resp.experiment_id);
      }
    }
  );
}

async function openDashboard() {
  vscode.env.openExternal(vscode.Uri.parse(web()));
}

async function openLastRun(context: vscode.ExtensionContext) {
  const last = context.workspaceState.get<string>(LAST_RUN_KEY);
  if (!last) {
    vscode.window.showInformationMessage(
      "Panel: no run launched from this workspace yet."
    );
    return;
  }
  vscode.env.openExternal(
    vscode.Uri.parse(`${web()}/experiment/${last}`)
  );
}

async function updateStatusBar(
  item: vscode.StatusBarItem,
  context: vscode.ExtensionContext
) {
  try {
    const health = await getJSON<Health>("/health");
    const list = await getJSON<ListResponse>("/experiments");
    const active = list.runs.filter((r) => r.status === "running").length;
    const last = context.workspaceState.get<string>(LAST_RUN_KEY);
    if (active > 0) {
      item.text = `$(pulse) Panel: ${active} running`;
      item.tooltip = "Click to open the Panel dashboard.";
    } else if (last) {
      item.text = `$(check) Panel: idle (last ${last.slice(0, 10)}…)`;
      item.tooltip = "Click to open the last run.";
    } else if (health.status === "ok") {
      item.text = `$(play-circle) Panel: ready`;
      item.tooltip = "Click to start an experiment.";
    } else {
      item.text = `$(alert) Panel: unhealthy`;
      item.tooltip = "Backend reachable but not healthy.";
    }
    item.color = undefined;
  } catch {
    item.text = `$(circle-slash) Panel: offline`;
    item.tooltip = `Backend unreachable at ${backend()}`;
    item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("panel.runExperiment", () =>
      runExperiment(context)
    ),
    vscode.commands.registerCommand("panel.openDashboard", openDashboard),
    vscode.commands.registerCommand("panel.openLastRun", () =>
      openLastRun(context)
    )
  );

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  status.command = "panel.runExperiment";
  status.show();
  context.subscriptions.push(status);

  const tick = () => void updateStatusBar(status, context);
  tick();
  const interval = setInterval(tick, 8000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate() {
  // nothing to clean up — status bar + commands disposed by VS Code.
}
