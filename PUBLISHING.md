# Publishing & maintaining — for the author

> **This file is for you (the maintainer), not your users.** People who install a plugin only run
> the two commands in the root README's *Install* section. Everything here is how *you* host the
> marketplace on GitHub and ship updates.

## The model in one paragraph

A **marketplace** is just a Git repo containing `.claude-plugin/marketplace.json`, which lists one
or more **plugins**. Each plugin is a self-contained folder with its own
`.claude-plugin/plugin.json` and `skills/` (and optionally `commands/`, `agents/`, `hooks/`).
**Publishing = pushing this repo to GitHub.** A user's entire experience is:

```bash
claude plugin marketplace add arunts/ai-tools                 # point Claude at this repo
claude plugin install ai-session-analyzer@arunts-ai-tools     # install a plugin from it
claude plugin install coding-problem-analyzer@arunts-ai-tools # ...and/or another
```

They never run any of the commands below.

## Naming recap

- **Repo slug** = `arunts/ai-tools` — what users `marketplace add`.
- **Marketplace name** = `arunts-ai-tools` (`.claude-plugin/marketplace.json` → `name`) — the
  `@suffix` users install with.
- **Plugin names** = `ai-session-analyzer`, `coding-problem-analyzer`
  (each plugin's `.claude-plugin/plugin.json` → `name`).
- Users install as `<plugin>@arunts-ai-tools`.

## Validate before every push

```bash
claude plugin validate . --strict    # checks the marketplace + every plugin manifest
```

This repo is already on GitHub (`origin` → `github.com/arunts/ai-tools`), so day-to-day you only
commit and push.

## Shipping an update to a plugin

Bump the version in **both** the plugin manifest and its marketplace entry, add a changelog line,
then commit & push:

```
# ai-session-analyzer 0.1.0 -> 0.2.0:
#   ai-session-analyzer/.claude-plugin/plugin.json   -> "version": "0.2.0"
#   .claude-plugin/marketplace.json                  -> the ai-session-analyzer entry: "version": "0.2.0"
#   ai-session-analyzer/CHANGELOG.md                 -> new section
```

```bash
node ai-session-analyzer/examples/build.mjs   # refresh the demo if that report changed
git commit -am "ai-session-analyzer 0.2.0"
git push

# optional: cut a validated release tag (creates ai-session-analyzer--v0.2.0)
claude plugin tag .
git push --tags
```

Users pick it up with:

```bash
claude plugin marketplace update arunts-ai-tools           # refresh the listing
claude plugin update ai-session-analyzer@arunts-ai-tools   # restart to apply
```

The same flow applies to `coding-problem-analyzer` (its version lives in
`coding-problem-analyzer/.claude-plugin/plugin.json` and the matching marketplace entry).

## Adding a third plugin later

1. Drop a self-contained plugin folder at the repo root: `my-plugin/.claude-plugin/plugin.json`
   plus `my-plugin/skills/...` (and any `commands/`, `agents/`, `hooks/`).
2. Add one entry to `plugins[]` in `.claude-plugin/marketplace.json` with
   `"source": "./my-plugin"`.
3. `claude plugin validate . --strict`, then commit & push.

Do **not** add a second `marketplace.json` inside the plugin folder — the repo has exactly one
marketplace manifest, at the root.

## Handy maintainer commands

| Command | Purpose |
|---|---|
| `claude plugin validate . --strict` | Validate the marketplace + all plugins before every push. |
| `claude plugin tag .` | Create a `name--vX.Y.Z` git tag, verifying the manifests agree. |
| `claude plugin marketplace update [name]` | Refresh marketplace metadata locally. |
| `claude plugin list` / `claude plugin details <name>` | Inspect installed plugins / component inventory. |
