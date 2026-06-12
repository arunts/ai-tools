---
name: algo-explainer
description: >-
  Turn `algo-pattern-analyzer` output into self-contained HTML study pages — one per drill —
  each with a bespoke, seeded p5.js generative visual that evokes the drill's algorithmic
  mechanic, styled with the PyPayasam design tokens and a dark/light toggle. Use when the user
  wants visual/illustrated drill pages, an art page for an algorithm, to render drills as
  web pages, or says "make art pages", "visualize this drill", "turn drills into pages".
  Self-contained: bundles its own generative-art method (no dependency on `algorithmic-art`).
---

# algo-explainer — drill → themed generative-art study page

`algo-pattern-analyzer` emits one markdown file per pattern: a **Core algorithm** block then
grouped `### drills` (problem statement · `**Steps:**` · Python). This skill renders **one
HTML page per drill** — a generative-art hero whose motion *feels like the algorithm*, the
**core skeleton**, the focused **Problem**, and the pattern's **other problems as expandable
sections, each with its own art** — in a warm PyPayasam theme with a dark/light toggle.

Everything needed ships with this skill — see `references/` and `templates/`. It does **not**
read or require the external `algorithmic-art` skill at runtime.

## Inputs

1. A `algo-pattern-analyzer` `<pattern>.md` (or a single drill pasted in). Use the
   **Core algorithm** skeleton (the intuition cards and trace are intentionally dropped — the art
   carries the intuition) and each `### drill` (heading = statement, `**Steps:**` line, fenced
   Python, cost target).
2. (Optional) an output directory — default `art-pages/` (a sibling of the drills).

## Flow

1. **Parse** the pattern file into the core skeleton + a list of drills. Pick one drill as the
   page's **primary** (its focus); the rest become expandable extras.
2. **Fill** `templates/page.html` (copy it; replace every `{{PLACEHOLDER}}`):
   - `{{PATTERN_NAME}}`, `{{DRILL_TITLE}}` (primary statement), `{{COMPLEXITY}}` / `{{COMPLEXITY_SHORT}}`.
   - **Core algorithm** — only `{{CORE_NOTE}}` + `{{CORE_SKELETON}}` (raw Python). No intuition
     cards, no trace; the art carries the intuition.
   - **Problem** (primary drill) — `{{DRILL_STATEMENT}}`, `{{DRILL_STEPS}}`, `{{DRILL_CODE}}`.
   - **More problems** → `{{MORE_PROBLEMS}}`: one `<details class="more">` per OTHER drill, each with
     its OWN art (a `<div id="art-N">` + `data-mode` / `data-seed`) plus statement, steps, code.
     Siblings **lazy-init on first expand** (so the canvas sizes correctly).
   - `{{ART_CAPTION}}`, `{{SEED}}`, and the hero's `{{MAIN_MODE}}`.
   - `{{SKETCH_FACTORY}}` → `makeArt(sel, seed, mode)` for this pattern's mechanic (instance mode),
     then call `makeArt('#art-canvas', {{SEED}}, '{{MAIN_MODE}}')`.
   Put raw Python inside `<code class="py">…</code>` — the highlighter applies the PyPayasam
   `--syntax-*` colors. Do not hand-wrap tokens.
3. **Write** to `art-pages/<pattern>-<NN>-<slug>.html` (`NN` = 2-digit index; `slug` from the primary
   statement). Self-contained (opens in any browser). One page per drill — each focuses a different
   primary and links the rest as expandable extras.

## Sketch — the bespoke generative visual (the point of this skill)

Read `references/generative-art.md` (the bundled method) and `references/visual-metaphors.md`
(pattern → motion). The rules:

- **The motion must evoke the drill's mechanic** — a viewer should be able to narrate the
  algorithm from the animation (sliding-window sweeps & jumps; two-pointer converges; backtracking
  branches & prunes; …).
- **Pace it slow & legible** — about one logical step per second via a time accumulator
  (`STEP_MS ≈ 1000`ms; advance on `deltaTime`, `frameRate(60)` for smoothness). See
  `references/generative-art.md`.
- **Seeded & reproducible**: `randomSeed(seed); noiseSeed(seed);`. The animated subject (string /
  array / tree) is derived from the seed, so prev/next/random show new runs of the same algorithm.
- **Palette from theme tokens only** — never hardcode hex. Read `--sage-500`, `--honey-500`, etc.
  via `getComputedStyle`; re-read on theme toggle so the art recolors. Multiple arts per page ⇒
  **p5 instance mode**: `templates/sketch.js` shows the shape — a `makeArt(sel, seed, mode)` factory
  whose instance exposes `reseedTo(seed)` / `refreshTheme()`; the harness in `page.html` registers it
  (`regArt`) and drives theme refresh, lazy init, and seed controls.
- **Craft, not noise**: controlled, legible, tile aesthetic (rounded rects, grout strokes). Original
  — never imitate a named living artist.

## Theming

The template already carries the PyPayasam tokens (`:root` light + `:root[data-theme="dark"]`),
the `.theme-btn` toggle (persists to `localStorage`, defaults to `prefers-color-scheme`), and the
syntax-highlight tokens. You only supply content + the sketch.

## Output

`art-pages/<pattern>-<NN>-<slug>.html`, one per drill. Self-contained (p5.js from CDN; everything
else inline). Re-runnable; a fixed seed is deterministic.
