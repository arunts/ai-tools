# Generative-art method (self-contained)

Adapted from the `algorithmic-art` skill so this skill needs nothing external. The goal: a
**seeded p5.js sketch** whose process — not a static frame — carries the meaning. Here the
"meaning" is fixed: **the sketch must feel like the drill's algorithm running.**

## The one rule that makes these pages good

> The conceptual seed embedded in the art **= the drill's algorithmic mechanic.**

A sliding-window sketch should *sweep and jump*. A two-pointer sketch should *converge*. A
backtracking sketch should *branch and prune*. Someone who knows the algorithm should feel it;
everyone else should see a crafted generative composition. Pick the motion from
`visual-metaphors.md`, then build it well.

## Non-negotiables (keep from algorithmic-art)

1. **Seeded randomness — reproducibility.** Begin every (re)generation with:
   ```js
   function initSeed(s){ randomSeed(s); noiseSeed(s); }
   ```
   Same seed → identical output, always. The string/array/tree the sketch animates is derived
   from the seed, so prev/next/random reveal genuinely different runs of the same algorithm.

2. **One `params` object.** Per-instance tunables in one place (counts, scales, ratios,
   thresholds, palette). The animation **pace is separate** — a single module-level `STEP_MS`
   (see #3), not a per-instance param.
   ```js
   var STEP_MS = 1000;                       // ms per logical step (~1 step/sec) — the pace knob
   let params = { seed: 12345, cells: 28, /* ... */ };
   ```

3. **Lifecycle + pacing (time-based).** `setup()` seeds, **precomputes the run's steps**, and
   sizes the canvas; `draw()` advances by **elapsed time**, not frame count, so the cadence is
   independent of frame rate. Keep one module-level `STEP_MS` (ms per logical step) and advance
   when accumulated `deltaTime ≥ STEP_MS`; hold on the final step (`HOLD_MS`) then replay.
   **Pace it slow and contemplative — about one logical step per second: `STEP_MS ≈ 1000`.** Run
   `frameRate(60)` for smooth easing between steps (fps only affects smoothness; the
   time-accumulator sets the speed). A viewer must comfortably absorb each step — err slower.
   ```js
   var STEP_MS = 1000;                          // ms per logical step (~1 step/sec)
   // in draw(): acc += Math.min(deltaTime, 50); if (acc >= STEP_MS) { acc -= STEP_MS; ptr++; }
   ```

4. **Craftsmanship.** Controlled, not noisy. Thoughtful palette (taken from the page's theme
   tokens — see below), visual hierarchy, smooth motion, no jitter-for-its-own-sake. It should
   look deliberately made, not random.

5. **Originality.** Build the mechanic from scratch. Do **not** imitate a named living artist's
   style; the reference is the *algorithm*, not another artwork.

## Palette comes from the theme (so the art re-themes)

Do not hardcode hex. Read the active theme's CSS custom properties at runtime:
```js
function tokenColors(){
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return {
    bg:     v('--bg-1'),
    ink:    v('--fg-0'),
    sage:   v('--sage-500'),
    honey:  v('--honey-500'),
    denim:  v('--denim-400'),
    peach:  v('--peach-400'),
    grout:  v('--border-grout-strong'),
  };
}
```
Call it in `setup()` and again whenever the theme toggles, then re-init the sketch. The same
sketch then renders correctly in light and dark because it only ever uses token colors.

## Canvas

- Size to the hero container's width, fixed banner aspect (e.g. `w × w*0.42`). Re-create on
  window resize.
- Tile aesthetic fits PyPayasam: rounded rects (`--radius-tile`), 1px grout strokes, warm fills.

## Checklist before shipping a sketch

- [ ] Seeded; identical for a fixed seed; prev/next/random change it.
- [ ] The **motion clearly maps to the algorithm** (a viewer could narrate the mechanic).
- [ ] **Paced ~1 step/sec** via a time accumulator (`STEP_MS ≈ 1000`, advance on `deltaTime`); a viewer can follow each step without pausing.
- [ ] Colors come only from theme tokens; verified in both light and dark.
- [ ] Reset + seed controls work; no console errors; smooth motion or clean static.
