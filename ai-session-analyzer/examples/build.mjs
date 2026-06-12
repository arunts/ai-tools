#!/usr/bin/env node
// Rebuild the committed demo: synthetic data -> aggregate -> sample semantics -> render.
// Run:  node examples/build.mjs
// Produces examples/sample-report.html (self-contained) and the sample-semantic-*.json
// files (which double as examples of the apply-semantic input format).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATS = path.join(DIR, "..", "stats.mjs");
const TEMPLATE = path.join(DIR, "..", "report-template.html");
const DATA = path.join(DIR, "sample-data");
const SNAP = path.join(DIR, ".snap");
const node = process.execPath;
const run = (args) => execFileSync(node, args, { encoding: "utf8" });

// Canned narratives so the demo shows realistic "calibrated by Claude" copy.
const NARR = {
  "-home-dev-webapp": { profile: "Frontend feature dev", narrative: "Frontend work: component extraction, responsive fixes, and a dark-mode toggle, with a tight edit → lint → test loop." },
  "-home-dev-api": { profile: "Backend / API engineer", narrative: "Backend endpoints, query tuning, and resilience work (backoff, async middleware) with frequent test runs." },
  "-home-dev-cli-tool": { profile: "Tooling / DX builder", narrative: "CLI tooling: flags, packaging, and parser hardening, iterating through build and run cycles." },
  "overall": { profile: "Full-stack multi-project builder", narrative: "A full-stack sweep across frontend, API, and CLI tooling — heavy on iterative edit/build/test loops where the AI compressed the most hands-on time." },
};

function writeSemantic(level) {
  const plan = JSON.parse(run([STATS, "semantic-plan", "--snapshot-dir", SNAP, "--granularity", level]));
  const units = plan.units.map((u) => {
    const b = u.baselineManualMinutes;
    const n = NARR[u.id] || { profile: "Engineer", narrative: "Mixed development work." };
    return { id: u.id, manualMinutes: { low: Math.round(b * 0.75), expected: Math.round(b * 1.1), high: Math.round(b * 1.5) }, profile: n.profile, narrative: n.narrative, note: "Sample calibration (~1.1x baseline)." };
  });
  const f = path.join(DIR, `sample-semantic-${level}.json`);
  fs.writeFileSync(f, JSON.stringify({ granularity: level, units }, null, 2) + "\n");
  return f;
}

fs.rmSync(SNAP, { recursive: true, force: true }); // clean build => reproducible
run([path.join(DIR, "generate-sample-data.mjs")]);
// simulate three runs over time (by cutoff date) so the demo shows a real upward trend
run([STATS, "aggregate", "--data", DATA, "--out-dir", SNAP, "--to", "2026-05-25"]);
run([STATS, "aggregate", "--data", DATA, "--out-dir", SNAP, "--to", "2026-06-01"]);
console.log(run([STATS, "aggregate", "--data", DATA, "--out-dir", SNAP]));
run([STATS, "apply-semantic", "--snapshot-dir", SNAP, "--input", writeSemantic("overall")]);
run([STATS, "apply-semantic", "--snapshot-dir", SNAP, "--input", writeSemantic("project")]);
console.log(run([STATS, "render", "--snapshot-dir", SNAP, "--granularity", "project", "--template", TEMPLATE, "--out", path.join(DIR, "sample-report.html")]));
console.log("done -> examples/sample-report.html");
