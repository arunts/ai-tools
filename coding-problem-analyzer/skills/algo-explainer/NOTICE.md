# NOTICE

`algo-explainer` bundles a distilled, adapted copy of the **generative-art method**
(seeded p5.js sketches, parameter exploration, reproducibility, "embed the concept in the
algorithm") from the **`algorithmic-art`** skill, so this skill is fully self-contained and
has **no runtime dependency** on `~/.claude/skills/algorithmic-art/`.

- Adapted guidance lives in `references/generative-art.md` and `templates/sketch.js`.
- The original skill's license is retained verbatim in `LICENSE.txt`.
- The page **template and styling are original** to this skill (PyPayasam design tokens) and
  intentionally replace algorithmic-art's Anthropic-branded `viewer.html`.

Design tokens in `templates/page.html` are condensed from the PyPayasam / "String Hopper"
token system (`src/styles/tokens.css`).
