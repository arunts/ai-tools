#!/usr/bin/env node
// Generate synthetic Claude Code session JSONL for demoing AI Session Analyzer.
// Deterministic (seeded) so the committed sample is reproducible. Contains NO real data.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "sample-data");

// seeded RNG (mulberry32) — fixed seed => reproducible output
let _s = 0x9e3779b9;
const rnd = () => { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const id = (p) => { let s = p; for (let i = 0; i < 12; i++) s += Math.floor(rnd() * 16).toString(16); return s; };

const PROJECTS = [
  { slug: "-home-dev-webapp", cwd: "/home/dev/webapp", name: "webapp", kind: "frontend",
    prompts: ["add a dark mode toggle to the settings page", "the navbar overlaps the hero on mobile, fix it", "extract the table into a reusable component", "write tests for the cart reducer"] },
  { slug: "-home-dev-api", cwd: "/home/dev/api", name: "api", kind: "backend",
    prompts: ["add a /users/:id/orders endpoint with pagination", "this query is slow, add an index and explain it", "handle the 429 from the payment provider with backoff", "migrate the auth middleware to async"] },
  { slug: "-home-dev-cli-tool", cwd: "/home/dev/cli-tool", name: "cli-tool", kind: "tooling",
    prompts: ["add a --json flag to the report command", "package this as a single binary", "the parser chokes on empty lines, make it tolerant", "add a progress bar for long runs"] },
];
const MODELS = ["claude-opus-4-8", "claude-sonnet-4-8"];
const FILES = {
  frontend: ["src/App.tsx", "src/Nav.tsx", "src/cart.ts", "src/theme.css"],
  backend: ["app/users.py", "app/db.py", "app/auth.py", "tests/test_users.py"],
  tooling: ["src/cli.mjs", "src/parse.mjs", "src/report.mjs", "README.md"],
};
const BASH = {
  frontend: ["npm test", "npm run build", "git status", "npm run lint"],
  backend: ["pytest -q", "ruff check .", "git diff", "alembic upgrade head"],
  tooling: ["node cli.mjs --help", "npm run build", "git commit -am wip", "./run.sh"],
};
const TOOLSEQ = {
  frontend: ["Edit", "Write", "Read", "Bash", "Edit", "Edit"],
  backend: ["Edit", "Bash", "Read", "Write", "Bash", "Edit"],
  tooling: ["Edit", "Write", "Bash", "Read", "Bash", "Edit"],
};

const base = (p, ts, sid) => ({ timestamp: ts.toISOString(), sessionId: sid, cwd: p.cwd, gitBranch: "main", version: "2.1.168", userType: "external", slug: `sample-${p.name}-session` });

fs.rmSync(OUT, { recursive: true, force: true });
const START = new Date("2026-05-18T00:00:00Z").getTime(); // fixed base date (deterministic)
let total = 0;

for (const p of PROJECTS) {
  const dir = path.join(OUT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  for (let s = 0; s < ri(2, 4); s++) {
    const sid = id("");
    const hour = pick([9, 10, 11, 13, 14, 15, 16, 20, 21]);
    let t = new Date(START + ri(0, 20) * 86400000 + hour * 3600000 + ri(0, 50) * 60000);
    const lines = [{ ...base(p, t, sid), type: "user", message: { role: "user", content: pick(p.prompts) } }];
    for (let k = 0, turns = ri(8, 26); k < turns; k++) {
      t = new Date(t.getTime() + ri(10, 120) * 1000); // AI works fast: seconds between turns
      const content = [];
      const doTool = rnd() < 0.8;
      let toolId = null, toolName = null;
      if (doTool) {
        toolName = pick(TOOLSEQ[p.kind]);
        toolId = id("toolu_");
        const inp = {};
        if (toolName === "Edit") { inp.file_path = pick(FILES[p.kind]); inp.old_string = Array(ri(2, 8)).fill("old").join("\n"); inp.new_string = Array(ri(3, 18)).fill("new").join("\n"); }
        else if (toolName === "Write") { inp.file_path = pick(FILES[p.kind]); inp.content = Array(ri(10, 80)).fill("line").join("\n"); }
        else if (toolName === "Bash") { inp.command = pick(BASH[p.kind]); inp.description = "run"; }
        else if (toolName === "Read") { inp.file_path = pick(FILES[p.kind]); }
        content.push({ type: "thinking", thinking: "", signature: "x" });
        content.push({ type: "tool_use", id: toolId, name: toolName, input: inp });
      } else {
        content.push({ type: "text", text: "Done — here's a summary of the change." });
      }
      lines.push({ ...base(p, t, sid), type: "assistant", message: { role: "assistant", model: pick(MODELS), content,
        usage: { input_tokens: ri(800, 4000), output_tokens: ri(200, 1500), cache_creation_input_tokens: ri(0, 3000), cache_read_input_tokens: ri(5000, 90000) } } });
      if (doTool) {
        t = new Date(t.getTime() + ri(0, 20) * 1000);
        const isErr = rnd() < 0.08;
        lines.push({ ...base(p, t, sid), type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, is_error: isErr, content: isErr ? "Error: command failed" : "ok" }] } });
      }
      if (rnd() < 0.15) { t = new Date(t.getTime() + ri(20, 90) * 1000); lines.push({ ...base(p, t, sid), type: "user", message: { role: "user", content: pick(p.prompts) } }); }
    }
    fs.writeFileSync(path.join(dir, sid + ".jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    total++;
  }
}
console.log(`generated ${total} synthetic sessions across ${PROJECTS.length} projects in ${OUT}`);
