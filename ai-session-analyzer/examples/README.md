# Demo (synthetic — no real data)

Everything here is fabricated by a deterministic generator so you can see the report and try
the pipeline without touching your own `~/.claude` sessions.

- **`sample-report.html`** — a pre-built, self-contained report. Open it in any browser.
- **`generate-sample-data.mjs`** — generates fake session JSONL under `sample-data/`.
- **`build.mjs`** — rebuilds everything: data → `aggregate` (three cutoff dates, to produce a
  real trend) → `apply-semantic` (sample narratives) → `render`.
- **`sample-semantic-overall.json` / `sample-semantic-project.json`** — examples of the
  `apply-semantic` input format the skill produces.

## Rebuild

```bash
node examples/build.mjs
open examples/sample-report.html   # macOS (use xdg-open on Linux)
```

Nothing from `~/.claude` is read here — the data is entirely synthetic.
