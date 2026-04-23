# Panel — VS Code extension

Launch four-agent experiments in [Panel](https://github.com/arpan1221/Panel) without leaving your editor.

## Commands

- `Panel: Run Experiment` — prompts for goal, dataset path, max steps; POSTs to the backend; opens the live dashboard in your browser.
- `Panel: Open Dashboard` — opens `http://localhost:3100`.
- `Panel: Open Last Run` — opens the experiment launched most recently from this workspace.

## Status bar

The right-side status bar shows the backend state:

- `▶ Panel: ready` — backend up, no active runs
- `● Panel: N running` — N jury runs live; click to open the dashboard
- `✓ Panel: idle (last …)` — last run from this workspace; click to open it
- `⊘ Panel: offline` — backend unreachable

## Settings

- `panel.backendUrl` (default `http://localhost:8100`)
- `panel.webUrl` (default `http://localhost:3100`)
- `panel.defaultMaxSteps` (default `8`)

## Install locally

The extension isn't on the marketplace yet — use it in dev mode:

```bash
cd extension
npm install
npm run compile
```

Then open the `extension/` folder in VS Code and press **F5** to launch an Extension Development Host with Panel loaded.

To package a `.vsix`:

```bash
npx vsce package
```
