/* ============================================================================
 * sketch.js — reference shape for a drill's generative sketch (p5 INSTANCE mode).
 * Adapted from algorithmic-art's generator_template.js (see ../LICENSE.txt).
 * Instance mode is required because a page hosts several arts (hero + each
 * expandable sibling). This is STRUCTURE, not a recipe — build the real mechanic.
 *
 * PACING — time-based, one knob. STEP_MS = milliseconds per logical step (NOT
 * frames). ~1000ms ≈ one step per second: slow and legible. Advance by elapsed
 * deltaTime so the cadence is independent of frame rate; run frameRate(60) for
 * smooth easing between steps. Raise STEP_MS to slow every art down.
 *
 * Contract the page (templates/page.html) expects:
 *   makeArt(containerSel, seed, mode)  -> builds a p5 instance in that element,
 *     calls regArt(containerSel, inst), and exposes on the instance:
 *       inst.reseedTo(seed)  -> reset state for a seed and (re)start
 *       inst.refreshTheme()  -> re-read token colors and repaint (on theme toggle)
 *       inst.curSeed()       -> current seed
 *   Then init the hero:  makeArt('#art-canvas', SEED, 'MAIN_MODE');
 * ========================================================================== */

// One pace knob shared by every art on the page (a code constant, NOT a UI control).
var STEP_MS = 1000;            // ms per logical step (~1 step/sec) — raise to slow down
var HOLD_MS = STEP_MS * 6;     // pause on the final frame before the run replays

function makeArt(sel, seed, mode) {
  var inst = new p5(function (p) {
    var PAL = {}, S = null, host = null;
    var params = { seed: seed, mode: mode /* + your tunables: counts, scales, ratios */ };
    var ptr = 0, acc = 0, hold = 0;        // ptr = current step; acc/hold accumulate elapsed ms

    // palette from the page's CSS custom properties (so art re-themes)
    function tok() {
      var cs = getComputedStyle(document.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
      return { bg: v('--bg-1'), ink: v('--fg-0'), mute: v('--fg-2'), grout: v('--border-grout-strong'),
               sage: v('--sage-500'), honey: v('--honey-500'), denim: v('--denim-400'), peach: v('--peach-400') };
    }

    function build(sd) {            // derive the subject AND precompute the run's steps FROM the seed
      p.randomSeed(sd); p.noiseSeed(sd);
      ptr = 0; acc = 0; hold = 0;
      return { steps: [/* one entry per logical step */], speed: 1 /* optional per-mode multiplier on STEP_MS */ };
    }

    p.setup = function () {
      host = document.querySelector(sel);
      var w = (host && host.clientWidth) || 600;
      p.createCanvas(w, Math.round(w * 0.40)).parent(host);
      PAL = tok(); p.frameRate(60); S = build(params.seed);   // 60fps = smooth; the time-accumulator sets the pace
    };
    p.windowResized = function () { if (!host || !host.clientWidth) return; p.resizeCanvas(host.clientWidth, Math.round(host.clientWidth * 0.40)); };
    p.draw = function () {
      p.background(PAL.bg);
      // time-based cadence: advance one logical step every STEP_MS ms (slow & legible)
      var spms = STEP_MS * (S.speed || 1);              // per-mode multiplier scales the one knob
      var dt = Math.min(p.deltaTime || 16, 50);         // elapsed ms since last frame (clamped)
      var atEnd = (ptr >= S.steps.length - 1);
      if (atEnd) { hold += dt; if (hold > HOLD_MS) { S = build(params.seed); return; } }
      else { acc += dt; if (acc >= spms) { acc -= spms; ptr++; } }
      var prog = Math.min(acc / spms, 1);               // 0..1 within the step — ease the render between steps
      // ... render S.steps[ptr] with rounded tiles + grout strokes, easing by prog, using PAL.* only ...
    };

    p.reseedTo = function (s) { params.seed = s; S = build(s); p.loop(); };
    p.refreshTheme = function () { PAL = tok(); p.redraw(); };
    p.curSeed = function () { return params.seed; };
  });
  regArt(sel, inst);
  return inst;
}
