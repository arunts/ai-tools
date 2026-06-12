# Coding Problem Analyzer

A **Claude Code plugin** that turns coding problems into reusable study material — analysis
only, decoupled from any app or presentation layer. It ships **four skills that chain into a
pipeline**: one *producer* that distills each problem into a compact record, two *aggregators*
that pool many records along different axes, and one *renderer* that turns the practice deck
into illustrated HTML pages.

- **Local & file-based.** Every step reads and writes plain files (JSON + markdown + HTML) in a
  directory you choose — nothing is uploaded, nothing is locked in a database.
- **Incremental.** The aggregators *merge* into their existing output, so you build the record
  set up over time and re-run to fold in new problems.
- **Composable.** The two aggregators are independent — run the syntax reference, the practice
  drills, or both; they read the same record pool.

## The pipeline

```
                                    ┌─► coding-syntax-aggregator ─► syntax-chapters/*.md
 problem-details ─► records/*.json ─┤        (deduped syntax reference)
   (run once per problem)           │
                                    └─► algo-pattern-analyzer ─► pattern-drills/*.md ─► algo-explainer ─► art-pages/*.html
                                            (per-pattern practice deck)                   (themed HTML study pages)
```

`problem-details` is the **source of truth**: each run appends one JSON record to a `records/`
folder. Everything downstream reads that pool — the two aggregators fan out from it, and
`algo-explainer` is a second stage that consumes the practice deck `algo-pattern-analyzer`
produces.

## Run the skills in this order

Invoke a skill by asking in plain language — each one lists its own trigger phrases. The order
that matters is **producer → aggregators → renderer**:

### 1. `problem-details` — one problem → one record  *(run repeatedly)*

Run this once per problem to build up your record pool. Say **"analyze Number of Islands"**,
**"what's the pattern for Maximum Subarray"**, **"break down Combination Sum"**.

- **Reads:** a problem name/id (and optionally your own solution).
- **Writes:** one record — `{ id, name, pattern, algorithm, code, syntax, complexity }` — saved
  to `records/<id>.json`.

> Build up a batch first. The two aggregators below are far more useful over *many* records (they
> dedup and group across problems), so analyze a handful before moving on.

### 2a. `coding-syntax-aggregator` — pool the syntax  *(syntax branch)*

Say **"build the syntax reference from my records"** or **"merge the syntax from these
problems"**.

- **Reads:** the `syntax[]` field across `records/*.json`.
- **Writes:** chapter-grouped markdown (`syntax-chapters/*.md`) — generalized, deduped, with
  derivable convenience syntax quarantined into one `extended` chapter.

### 2b. `algo-pattern-analyzer` — pool the algorithms  *(drills branch)*

Say **"make drills from my records"**, **"extract the algorithms by pattern"**, **"what
algorithm should I practice"**.

- **Reads:** `pattern` / `algorithm` / `code` across `records/*.json` (skips `pattern: null`
  problems, logging them in `_skipped.md`).
- **Writes:** one file per pattern — `pattern-drills/<pattern>.md` — each a reusable **core
  algorithm** plus blind-attemptable **variant drills** grouped by sub-mechanism.

> **2a and 2b are independent** — they read the same pool but produce unrelated outputs. Run
> either, both, or neither. Only **2b is required before step 3.**

### 3. `algo-explainer` — drills → illustrated HTML pages  *(renderer)*

Run **after** `algo-pattern-analyzer`. Say **"make art pages"**, **"turn these drills into
pages"**, **"visualize this drill"**.

- **Reads:** a `pattern-drills/<pattern>.md` file.
- **Writes:** one self-contained HTML page per drill — `art-pages/<pattern>-NN-slug.html` — each
  with a seeded p5.js generative visual that *evokes the algorithm's motion*, the core skeleton,
  the problem, and the pattern's other problems as expandable extras, in a warm theme with a
  dark/light toggle.

## Skills at a glance

| # | Skill | Consumes | Produces |
|---|-------|----------|----------|
| 1 | **problem-details** | a problem (name/id, optional solution) | `records/<id>.json` |
| 2a | **coding-syntax-aggregator** | `records/*.json` → `syntax[]` | `syntax-chapters/*.md` |
| 2b | **algo-pattern-analyzer** | `records/*.json` → `pattern`/`algorithm`/`code` | `pattern-drills/*.md` |
| 3 | **algo-explainer** | `pattern-drills/<pattern>.md` | `art-pages/*.html` |

Directory names above are the defaults — each skill lets you point at a different
records/output directory, and the aggregators merge into an existing one on re-run.

## Install

**Local (dev / personal):**
```bash
claude --plugin-dir /path/to/ai-tools/coding-problem-analyzer   # this plugin's folder
```
Use `/reload-plugins` after edits.

**From the marketplace (published to GitHub):**
```bash
claude plugin marketplace add arunts/ai-tools   # the repo; reads .claude-plugin/marketplace.json
claude plugin install coding-problem-analyzer@arunts-ai-tools
```

> This plugin ships inside the **arunts-ai-tools** marketplace (repo `arunts/ai-tools`), alongside
> other plugins. **Maintaining/publishing yourself?** See the marketplace **[PUBLISHING.md](../PUBLISHING.md)**.

## Layout

```
.claude-plugin/plugin.json            manifest (name, version, description)
skills/
  problem-details/                    1  · problem → record   (+ references/patterns.md)
  coding-syntax-aggregator/           2a · records → syntax-chapters
  algo-pattern-analyzer/              2b · records → pattern-drills   (+ scripts/bucket.py)
  algo-explainer/                     3  · drills → art-pages   (+ templates/, references/)
```
The marketplace manifest (`.claude-plugin/marketplace.json`), `PUBLISHING.md`, and `LICENSE`
live one level up at the **repo root**, since this is one of several plugins in the
`arunts-ai-tools` marketplace.

## License

MIT
