---
name: analyze-sessions
description: Analyze the user's local Claude Code sessions and generate a self-contained HTML report covering productivity, tool usage, activity patterns, per-project comparison, and an AI-calibrated "time saved / What-X-faster" estimate. Use when the user asks to analyze their Claude Code sessions, see session analytics, measure how much the AI sped them up, or generate a session/productivity report.
when_to_use: analyze my sessions, session report, session analytics, how productive was the AI, how much time did the AI save me, WhatXEngineer, productivity report
argument-hint: "[granularity: overall|project|session] [date-range] [project-filter]"
arguments: [granularity, date_range, project]
allowed-tools: Bash(node *) Bash(open *) Bash(xdg-open *) Bash(mkdir *) Read Write AskUserQuestion
---

# Analyze Claude Code Sessions

Generate a local HTML report from the user's Claude Code session data. A bundled
zero-dependency Node script (`stats.mjs`) does all exact counting; **you (the current
Claude Code session) supply the semantic judgment** — the time-saved estimate and the
written narrative. Nothing is sent to any external service.

## Paths

Use these (they come from plugin config, with safe fallbacks):

- DATA  = `${user_config.session_data_path}`  (fallback: `~/.claude/projects`)
- SNAP  = `${user_config.snapshot_dir}`        (fallback: `~/.claude/session-analyzer/snapshots`)
- REPORTS = `${user_config.report_dir}`        (fallback: `~/.claude/session-analyzer/reports`)
- SCRIPT = `${CLAUDE_PLUGIN_ROOT}/stats.mjs`
- TEMPLATE = `${CLAUDE_PLUGIN_ROOT}/report-template.html`

If a `${user_config.*}` value is empty, use the fallback. `stats.mjs` expands `~` itself.

## Step 1 — Determine granularity

If the user passed a granularity argument (`overall`, `project`, or `session`), use it.
Otherwise ask with **AskUserQuestion** (header "Granularity"):
- **Overall** — one report card for everything (fastest; 1 AI estimate).
- **Per-project** — break down each project separately.
- **Per-session** — finest detail, one entry per session (most AI work the first time).

Map the answer to `overall` | `project` | `session`. Also note any date-range or
project-filter the user mentioned.

## Step 2 — Aggregate (deterministic, incremental)

```bash
node "SCRIPT" aggregate --data "DATA" --out-dir "SNAP"
```
Add `--from YYYY-MM-DD --to YYYY-MM-DD` and/or `--project <slug-substring>` if the user
asked to scope it. This parses only new/changed sessions (reusing prior atoms) and writes
a fresh accumulating snapshot. Note the reported counts.

## Step 3 — Find what needs analysis

```bash
node "SCRIPT" semantic-plan --snapshot-dir "SNAP" --granularity <granularity>
```
This prints JSON: `{ baseline, unitsNeeding, units: [...] }`. Each unit has `id`, `label`,
`actualHours`, `metrics`, `baselineManualMinutes`, `baselineBreakdown`, `samplePrompts`,
and `reason` (missing|stale). **Only these units need your judgment** — everything else is
already cached from a previous run. If `unitsNeeding` is 0, skip to Step 5.

If there are many units (e.g. per-session over a large history), it's fine to process them
all; subsequent runs will be cheap because results are cached. If it's a very large batch
(> ~40 units), tell the user it may take a moment, or suggest starting at `project`/`overall`.

## Step 4 — Estimate time saved + write narrative (this is the AI part)

For each unit needing analysis, estimate how long the work would have taken a **competent
human engineer doing it by hand** (not a novice, but without AI assistance).

Method:
- **Anchor on `baselineManualMinutes`** (the deterministic estimate from edits/writes/lines/commands).
- **Adjust the `expected` value within roughly 0.6×–1.8× of the baseline** using signals you
  can see in `metrics` and `samplePrompts`:
  - Higher (slower by hand): novel/greenfield work, algorithms, tricky debugging (high tool-error
    rate or many build/test cycles), unfamiliar domains, research.
  - Lower (faster by hand): boilerplate, repetitive edits, mechanical changes.
- Set `low` = a skeptical/conservative manual estimate, `high` = a generous one. Keep
  `low < expected < high`. **Be honest — do not inflate.** These are *manual* minutes; the
  script computes "time saved" as manual − actual.
- Write a 1–2 sentence `narrative` grounded in the unit's real metrics and prompts.
- Give a short `profile` label (e.g. "Refactor-heavy backend dev", "Multi-project full-stack builder").
  For `overall`, make the profile the headline "WhatXEngineer" characterization.

Write the results to `SNAP/.semantic-input.json` (use the Write tool) in exactly this shape:

```json
{
  "granularity": "<overall|project|session>",
  "units": [
    {
      "id": "<unit id, copied verbatim from semantic-plan>",
      "manualMinutes": { "low": 0, "expected": 0, "high": 0 },
      "profile": "short label",
      "narrative": "1-2 sentences grounded in the metrics.",
      "note": "one line on how you calibrated vs the baseline"
    }
  ]
}
```

## Step 5 — Apply + render

```bash
node "SCRIPT" apply-semantic --snapshot-dir "SNAP" --input "SNAP/.semantic-input.json"
node "SCRIPT" render --snapshot-dir "SNAP" --granularity <granularity> --template "TEMPLATE" --out-dir "REPORTS"
```
(Skip `apply-semantic` if Step 3 found 0 units needing analysis.) `render` prints the
output path.

## Step 6 — Show the user

Tell the user the report path and the headline result (the `×` multiplier and hours saved
from render's output). Offer to open it:
```bash
open "<report path>"      # macOS;  use xdg-open on Linux
```

## Notes
- Re-running later is incremental: unchanged sessions are reused, and only new/changed
  units are re-estimated. Asking for a *coarser* granularity than before reuses cached finer
  results via roll-up; asking *finer* computes only the missing units.
- Everything stays on the local machine. The HTML report is self-contained and opens offline.
