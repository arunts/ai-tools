# arunts-ai-tools

A **Claude Code plugin marketplace** — one repo that hosts several local-first plugins. Each
plugin is self-contained in its own folder; the root `.claude-plugin/marketplace.json` lists them
all. Install whichever ones you want, individually.

## Plugins

| Plugin | What it does | Docs |
|--------|--------------|------|
| **ai-session-analyzer** | Analyze your local Claude Code sessions into a self-contained HTML report — productivity, tool usage, activity patterns, per-project comparison, and a flagship "time saved → What-X-faster" estimate. Fully local, no API key, zero dependencies. | [ai-session-analyzer/](ai-session-analyzer/README.md) |
| **coding-problem-analyzer** | Turn coding problems into study material. Four chained skills: `problem-details` (one problem → a compact record), `coding-syntax-aggregator` (pool syntax into a deduped reference), `algo-pattern-analyzer` (pool algorithms into a per-pattern practice deck), and `algo-explainer` (render each drill as a themed HTML page with a seeded p5.js visual). | [coding-problem-analyzer/](coding-problem-analyzer/README.md) |

## Install

Add the marketplace once (point Claude at this GitHub repo), then install any plugin from it:

```bash
claude plugin marketplace add arunts/ai-tools          # reads .claude-plugin/marketplace.json
claude plugin install ai-session-analyzer@arunts-ai-tools
claude plugin install coding-problem-analyzer@arunts-ai-tools
```

> The **repo slug** (`arunts/ai-tools`) is what you `marketplace add`. The **marketplace name**
> (`arunts-ai-tools`, from `marketplace.json`) is the `@suffix` you install with. They differ on
> purpose.

To develop a single plugin locally without the marketplace, point `--plugin-dir` at its folder:

```bash
claude --plugin-dir /path/to/ai-tools/ai-session-analyzer
```

## Layout

```
ai-tools/                          ← the marketplace "arunts-ai-tools"
├── .claude-plugin/
│   └── marketplace.json           ← lists both plugins (one entry per subfolder)
├── ai-session-analyzer/           ← plugin 1 (its own .claude-plugin/plugin.json + skills/)
├── coding-problem-analyzer/       ← plugin 2 (its own .claude-plugin/plugin.json + skills/)
├── PUBLISHING.md                  ← maintainer guide (publish repo + ship updates)
└── LICENSE
```

Adding another plugin later is just: drop a self-contained plugin folder in, and add one entry to
`plugins[]` in `marketplace.json`.

## Publishing

Maintainer-only — see **[PUBLISHING.md](PUBLISHING.md)**. End users only run the install commands above.

## License

MIT
