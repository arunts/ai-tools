#!/usr/bin/env node
// AI Session Analyzer — deterministic engine (zero dependencies, Node built-ins only).
//
// Modes:
//   aggregate     Parse Claude Code session JSONL into per-session "atoms" + write a snapshot.
//   semantic-plan Given a snapshot + granularity, print the units that need LLM analysis
//                 (missing or stale), each with rolled-up metrics, sample prompts and a
//                 deterministic time baseline for the model to calibrate around.
//   render        Roll atoms up to a granularity, merge the semantic cache, and inject the
//                 result into report-template.html to produce a self-contained HTML report.
//
// The script never calls an LLM. The semantic layer is produced by the Claude Code session
// driving the skill, and written back into the snapshot's `semantic` cache.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import readline from "node:readline";

// ----------------------------------------------------------------------------- constants

const SCHEMA_VERSION = 1;
const IDLE_CAP_MS = 5 * 60 * 1000;     // gaps longer than this don't count toward active time
const SAMPLE_PROMPTS = 3;              // human prompts captured per session for LLM context
const PROMPT_MAX = 280;               // truncation for a sampled prompt
const FILES_CAP = 200;                // max distinct file paths stored per session

// Deterministic manual-time baseline (minutes). The LLM calibrates low/expected/high around this.
const BASELINE = {
  perWriteMin: 1.5, perWriteLine10: 2.5,   // authoring a new file
  perEditMin: 1.5, perEditLine10: 2.0,     // understanding + changing existing code
  bash: { test: 4, build: 2, git: 1, install: 1.5, other: 1.0 }, // per command, by class
  perReadMin: 0.5, readCapMin: 30,         // navigation/comprehension (partly discounted)
  overheadPct: 0.10,                       // integration / context-switching overhead
};

// ----------------------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) { args[key] = true; }
      else { args[key] = next; i++; }
    } else { args._.push(a); }
  }
  return args;
}

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

// filesystem-safe timestamp incl. ms: 2026-06-08T10-22-33-123 (ms avoids same-second collisions)
const tsStamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);

// newest snapshot in a directory (via index.json, falling back to filename sort)
function resolveLatest(dir) {
  if (!dir) return null;
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
    if (idx.length) return path.join(dir, idx[idx.length - 1].file);
  } catch { /* no index */ }
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("snap-") && f.endsWith(".json")).sort();
    if (files.length) return path.join(dir, files[files.length - 1]);
  } catch { /* no dir */ }
  return null;
}

// resolve a snapshot path from --snapshot <file> or --snapshot-dir <dir> (latest)
function resolveSnapshotPath(args) {
  if (args.snapshot) return expandHome(args.snapshot);
  if (args["snapshot-dir"]) {
    const p = resolveLatest(expandHome(args["snapshot-dir"]));
    if (!p) throw new Error("no snapshot found in " + args["snapshot-dir"]);
    return p;
  }
  throw new Error("need --snapshot <file> or --snapshot-dir <dir>");
}

// ----------------------------------------------------------------------------- helpers

const countLines = (s) => (typeof s === "string" && s.length ? s.split("\n").length : 0);

function classifyBash(cmd) {
  const c = (cmd || "").toLowerCase();
  if (/\b(test|pytest|jest|vitest|rspec|phpunit|go test|cargo test)\b/.test(c)) return "test";
  if (/\b(build|make|tsc|webpack|rollup|esbuild|vite build|cargo build|go build|gradle|mvn)\b/.test(c)) return "build";
  if (/(^|\s)(npm i|npm install|yarn add|pnpm add|pip install|brew install|cargo add|go get)\b/.test(c)) return "install";
  if (/(^|\s)git\b/.test(c)) return "git";
  return "other";
}

function fingerprint(stat) { return `${stat.size}-${Math.round(stat.mtimeMs)}`; }

// content signature of a unit = hash of its member sessions' fingerprints.
// A cached semantic entry is stale iff this signature changes.
function unitSig(fingerprints, sessionIds) {
  const parts = sessionIds.slice().sort().map((sid) => sid + ":" + (fingerprints[sid] || "?"));
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function unitMembers(snap, level, id) {
  if (level === "overall") return Object.keys(snap.sessions);
  if (level === "project") return Object.values(snap.sessions).filter((s) => s.project === id).map((s) => s.sid);
  return [id];
}

function emptyAtomMetrics() {
  return {
    activeMs: 0, humanPrompts: 0, assistantMsgs: 0,
    tokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    models: {}, tools: {}, toolErrors: {}, toolResults: 0, toolErrorsTotal: 0,
    edits: 0, writes: 0, reads: 0, bashCount: 0,
    bashClasses: { test: 0, build: 0, git: 0, install: 0, other: 0 },
    linesWritten: 0, linesEditedNew: 0, linesEditedOld: 0,
    filesTouched: [], heat: {},
  };
}

const projectNameFromCwd = (cwd, slug) => {
  if (cwd) return path.basename(cwd);
  if (slug) return slug.replace(/^-/, "").split("-").pop();
  return "unknown";
};

// ----------------------------------------------------------------------------- parse one session

async function parseSession(file, projectSlug) {
  const atom = {
    sid: path.basename(file, ".jsonl"),
    project: projectSlug,
    projectName: null, projectPath: null,
    file, slug: null, version: null, gitBranch: null,
    firstTs: null, lastTs: null,
    samplePrompts: [],
    ...emptyAtomMetrics(),
  };
  const filesSet = new Set();
  const toolUseName = new Map(); // tool_use_id -> tool name (for error attribution)
  const tsList = [];

  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }

    if (o.timestamp) { const t = Date.parse(o.timestamp); if (!Number.isNaN(t)) tsList.push(t); }
    if (o.cwd && !atom.projectPath) atom.projectPath = o.cwd;
    if (o.slug) atom.slug = o.slug;
    if (o.version) atom.version = o.version;
    if (o.gitBranch) atom.gitBranch = o.gitBranch;

    if (o.type === "assistant" && o.message) {
      atom.assistantMsgs++;
      const u = o.message.usage;
      if (u) {
        atom.tokens.input += u.input_tokens || 0;
        atom.tokens.output += u.output_tokens || 0;
        atom.tokens.cacheCreate += u.cache_creation_input_tokens || 0;
        atom.tokens.cacheRead += u.cache_read_input_tokens || 0;
      }
      if (o.message.model) atom.models[o.message.model] = (atom.models[o.message.model] || 0) + 1;
      if (o.timestamp) {
        const d = new Date(o.timestamp);
        if (!Number.isNaN(d.getTime())) {
          const key = `${d.getDay()}_${d.getHours()}`;
          atom.heat[key] = (atom.heat[key] || 0) + 1;
        }
      }
      const content = o.message.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b.type !== "tool_use") continue;
          const name = b.name || "unknown";
          atom.tools[name] = (atom.tools[name] || 0) + 1;
          if (b.id) toolUseName.set(b.id, name);
          const inp = b.input || {};
          if (name === "Edit") {
            atom.edits++;
            atom.linesEditedNew += countLines(inp.new_string);
            atom.linesEditedOld += countLines(inp.old_string);
            if (inp.file_path) filesSet.add(inp.file_path);
          } else if (name === "Write") {
            atom.writes++;
            atom.linesWritten += countLines(inp.content);
            if (inp.file_path) filesSet.add(inp.file_path);
          } else if (name === "Read") {
            atom.reads++;
          } else if (name === "Bash") {
            atom.bashCount++;
            atom.bashClasses[classifyBash(inp.command)]++;
          }
        }
      }
    } else if (o.type === "user" && o.message) {
      const content = o.message.content;
      if (typeof content === "string") {
        atom.humanPrompts++;
        if (atom.samplePrompts.length < SAMPLE_PROMPTS && content.trim())
          atom.samplePrompts.push(content.slice(0, PROMPT_MAX));
      } else if (Array.isArray(content)) {
        let hasText = false;
        for (const b of content) {
          if (b.type === "text" && b.text) {
            hasText = true;
            if (atom.samplePrompts.length < SAMPLE_PROMPTS && b.text.trim())
              atom.samplePrompts.push(b.text.slice(0, PROMPT_MAX));
          } else if (b.type === "tool_result") {
            atom.toolResults++;
            if (b.is_error) {
              atom.toolErrorsTotal++;
              const nm = toolUseName.get(b.tool_use_id) || "unknown";
              atom.toolErrors[nm] = (atom.toolErrors[nm] || 0) + 1;
            }
          }
        }
        if (hasText) atom.humanPrompts++;
      }
    }
  }

  // duration: idle-capped sum of gaps
  tsList.sort((a, b) => a - b);
  let active = 0;
  for (let i = 1; i < tsList.length; i++) active += Math.min(tsList[i] - tsList[i - 1], IDLE_CAP_MS);
  atom.activeMs = active;
  atom.firstTs = tsList.length ? new Date(tsList[0]).toISOString() : null;
  atom.lastTs = tsList.length ? new Date(tsList[tsList.length - 1]).toISOString() : null;
  atom.filesTouched = [...filesSet].slice(0, FILES_CAP);
  atom.distinctFiles = filesSet.size;
  atom.projectName = projectNameFromCwd(atom.projectPath, projectSlug);
  return atom;
}

// ----------------------------------------------------------------------------- aggregate

async function cmdAggregate(args) {
  const dataDir = expandHome(args.data) || path.join(os.homedir(), ".claude", "projects");
  // output: explicit --out <file>, or auto-named snap-<ts>.json inside --out-dir
  const outDir = args["out-dir"] ? expandHome(args["out-dir"]) : null;
  let out = args.out ? expandHome(args.out) : null;
  if (!out && outDir) out = path.join(outDir, `snap-${tsStamp()}.json`);
  if (!out) throw new Error("aggregate requires --out-dir <dir> or --out <file>");
  const dir = path.dirname(out);
  // reuse: explicit --since <file>, else latest in --since-dir, else latest in output dir
  let since = args.since ? expandHome(args.since) : null;
  if (!since) since = resolveLatest(args["since-dir"] ? expandHome(args["since-dir"]) : dir);
  const filterProject = args.project || null;
  const from = args.from ? Date.parse(args.from) : null;
  const to = args.to ? Date.parse(args.to) : null;

  // load previous snapshot (for reuse + carrying semantic cache forward)
  let prev = null;
  if (since && fs.existsSync(since)) {
    try { prev = JSON.parse(await fsp.readFile(since, "utf8")); } catch { prev = null; }
  }
  const prevSessions = prev?.sessions || {};
  const prevFp = prev?.coverage?.sessionFingerprints || {};

  // enumerate project dirs -> session files (top-level *.jsonl only)
  const projects = (await fsp.readdir(dataDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !filterProject || name.includes(filterProject));

  const sessions = {};
  const fingerprints = {};
  const changed = [];
  let reused = 0, parsed = 0;

  for (const slug of projects) {
    const dir = path.join(dataDir, slug);
    let entries;
    try { entries = await fsp.readdir(dir); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = path.join(dir, f);
      let st;
      try { st = await fsp.stat(fp); } catch { continue; }
      if (!st.isFile()) continue;
      const sid = path.basename(f, ".jsonl");
      const fpKey = fingerprint(st);
      fingerprints[sid] = fpKey;

      if (prevFp[sid] === fpKey && prevSessions[sid]) {
        sessions[sid] = prevSessions[sid]; // unchanged -> reuse atom
        reused++;
      } else {
        sessions[sid] = await parseSession(fp, slug);
        changed.push(sid);
        parsed++;
      }
    }
  }

  // date filter (by session start)
  if (from || to) {
    for (const sid of Object.keys(sessions)) {
      const t = sessions[sid].firstTs ? Date.parse(sessions[sid].firstTs) : null;
      if (t === null) continue;
      if ((from && t < from) || (to && t > to)) delete sessions[sid];
    }
  }

  const snapshot = {
    schema: SCHEMA_VERSION,
    tool: "ai-session-analyzer",
    generatedAt: new Date().toISOString(),
    dataDir,
    filters: { from: args.from || null, to: args.to || null, project: filterProject },
    coverage: {
      sessionFingerprints: fingerprints,
      changed,                          // new or modified since --since
      semanticCached: prev?.coverage?.semanticCached || { overall: false, project: [], session: [] },
    },
    sessions,
    semantic: prev?.semantic || { overall: null, project: {}, session: {} },
  };

  await fsp.mkdir(path.dirname(out), { recursive: true });
  await fsp.writeFile(out, JSON.stringify(snapshot));

  // maintain an index.json next to the snapshot
  const indexPath = path.join(path.dirname(out), "index.json");
  let index = [];
  if (fs.existsSync(indexPath)) { try { index = JSON.parse(await fsp.readFile(indexPath, "utf8")); } catch { index = []; } }
  const ov = rollup(sessions, "overall")[0];
  index.push({
    file: path.basename(out), generatedAt: snapshot.generatedAt,
    sessions: Object.keys(sessions).length, filters: snapshot.filters,
    summary: ov ? { activeHours: ov.activeHours, edits: ov.edits, writes: ov.writes, tokens: ov.tokens.input + ov.tokens.output, sessions: ov.sessionsCount } : null,
  });
  await fsp.writeFile(indexPath, JSON.stringify(index, null, 2));

  console.log(JSON.stringify({
    ok: true, out, indexPath,
    sessions: Object.keys(sessions).length, projects: new Set(Object.values(sessions).map((s) => s.project)).size,
    parsed, reused, changed: changed.length,
  }, null, 2));
}

// ----------------------------------------------------------------------------- rollup

function mergeInto(target, s) {
  target.activeMs += s.activeMs; target.humanPrompts += s.humanPrompts; target.assistantMsgs += s.assistantMsgs;
  for (const k of ["input", "output", "cacheCreate", "cacheRead"]) target.tokens[k] += s.tokens[k] || 0;
  target.edits += s.edits; target.writes += s.writes; target.reads += s.reads; target.bashCount += s.bashCount;
  target.toolResults += s.toolResults; target.toolErrorsTotal += s.toolErrorsTotal;
  target.linesWritten += s.linesWritten; target.linesEditedNew += s.linesEditedNew; target.linesEditedOld += s.linesEditedOld;
  for (const [k, v] of Object.entries(s.tools)) target.tools[k] = (target.tools[k] || 0) + v;
  for (const [k, v] of Object.entries(s.toolErrors)) target.toolErrors[k] = (target.toolErrors[k] || 0) + v;
  for (const [k, v] of Object.entries(s.models)) target.models[k] = (target.models[k] || 0) + v;
  for (const k of Object.keys(target.bashClasses)) target.bashClasses[k] += s.bashClasses[k] || 0;
  for (const [k, v] of Object.entries(s.heat)) target.heat[k] = (target.heat[k] || 0) + v;
  for (const f of s.filesTouched || []) target._files.add(f);
  if (s.firstTs && (!target.firstTs || s.firstTs < target.firstTs)) target.firstTs = s.firstTs;
  if (s.lastTs && (!target.lastTs || s.lastTs > target.lastTs)) target.lastTs = s.lastTs;
  target.sessionsCount++;
}

function newUnit(id, label, level) {
  return { id, label, level, firstTs: null, lastTs: null, sessionIds: [], sessionsCount: 0, _files: new Set(), ...emptyAtomMetrics() };
}

function finalizeUnit(u) {
  u.distinctFiles = u._files.size; delete u._files; delete u.filesTouched;
  u.activeHours = +(u.activeMs / 3600000).toFixed(2);
  u.baseline = baseline(u);
  return u;
}

function rollup(sessions, level) {
  const units = new Map();
  for (const s of Object.values(sessions)) {
    let id, label;
    if (level === "overall") { id = "overall"; label = "All sessions"; }
    else if (level === "project") { id = s.project; label = s.projectName || s.project; }
    else { id = s.sid; label = (s.slug ? s.slug.replace(/-/g, " ") : s.sid.slice(0, 8)); }
    if (!units.has(id)) units.set(id, newUnit(id, label, level));
    const u = units.get(id);
    u.sessionIds.push(s.sid);
    mergeInto(u, s);
  }
  return [...units.values()].map(finalizeUnit);
}

// ----------------------------------------------------------------------------- time baseline

function baseline(m) {
  const writeMin = m.writes * BASELINE.perWriteMin + (m.linesWritten / 10) * BASELINE.perWriteLine10;
  const editMin = m.edits * BASELINE.perEditMin + ((m.linesEditedNew + m.linesEditedOld) / 10) * BASELINE.perEditLine10;
  let bashMin = 0;
  for (const [cls, n] of Object.entries(m.bashClasses)) bashMin += n * (BASELINE.bash[cls] || 1);
  const readMin = Math.min(m.reads * BASELINE.perReadMin, BASELINE.readCapMin);
  const subtotal = writeMin + editMin + bashMin + readMin;
  const overhead = subtotal * BASELINE.overheadPct;
  const minutes = subtotal + overhead;
  return {
    minutes: +minutes.toFixed(1),
    breakdown: {
      write: +writeMin.toFixed(1), edit: +editMin.toFixed(1),
      bash: +bashMin.toFixed(1), read: +readMin.toFixed(1), overhead: +overhead.toFixed(1),
    },
  };
}

// ----------------------------------------------------------------------------- semantic-plan

async function cmdSemanticPlan(args) {
  const snap = JSON.parse(await fsp.readFile(resolveSnapshotPath(args), "utf8"));
  const level = normalizeLevel(args.granularity);
  const fps = snap.coverage?.sessionFingerprints || {};
  const cache = snap.semantic || { overall: null, project: {}, session: {} };
  const units = rollup(snap.sessions, level);

  const need = [];
  for (const u of units) {
    const cached = level === "overall" ? cache.overall : (cache[level] || {})[u.id];
    const sig = unitSig(fps, u.sessionIds);
    if (cached && cached.sig === sig) continue;   // fresh: content unchanged since computed
    const reasonStale = !!cached;                  // cached but signature differs
    // gather sample prompts from member sessions (capped)
    const prompts = [];
    for (const sid of u.sessionIds) {
      for (const p of snap.sessions[sid].samplePrompts || []) {
        if (prompts.length < 8) prompts.push(p);
      }
    }
    need.push({
      id: u.id, label: u.label, level,
      sessions: u.sessionsCount,
      actualHours: u.activeHours,
      metrics: {
        edits: u.edits, writes: u.writes, reads: u.reads, bash: u.bashCount,
        bashClasses: u.bashClasses, distinctFiles: u.distinctFiles,
        linesWritten: u.linesWritten, linesEditedNew: u.linesEditedNew, linesEditedOld: u.linesEditedOld,
        tokens: u.tokens,
      },
      baselineManualMinutes: u.baseline.minutes,
      baselineBreakdown: u.baseline.breakdown,
      samplePrompts: prompts,
      reason: reasonStale ? "stale" : "missing",
    });
  }
  console.log(JSON.stringify({ granularity: level, baseline: BASELINE, unitsNeeding: need.length, units: need }, null, 2));
}

// ----------------------------------------------------------------------------- apply-semantic

// Merge Claude-produced semantic results back into a snapshot's cache.
// Input file shape: { granularity, units: [ { id, manualMinutes:{low,expected,high}, note, narrative, profile } ] }
async function cmdApplySemantic(args) {
  const snapPath = resolveSnapshotPath(args);
  const snap = JSON.parse(await fsp.readFile(snapPath, "utf8"));
  const input = JSON.parse(await fsp.readFile(expandHome(args.input), "utf8"));
  const level = normalizeLevel(input.granularity);
  snap.semantic = snap.semantic || { overall: null, project: {}, session: {} };
  snap.coverage = snap.coverage || {};
  snap.coverage.semanticCached = snap.coverage.semanticCached || { overall: false, project: [], session: [] };
  const fps = snap.coverage?.sessionFingerprints || {};
  let applied = 0;
  for (const u of input.units || []) {
    if (!u.manualMinutes) continue;
    const entry = {
      manualMinutes: u.manualMinutes,
      note: u.note || null, narrative: u.narrative || null, profile: u.profile || null,
      sig: unitSig(fps, unitMembers(snap, level, u.id)),
      computedAt: new Date().toISOString(),
    };
    if (level === "overall") {
      snap.semantic.overall = entry;
      snap.coverage.semanticCached.overall = true;
    } else {
      snap.semantic[level][u.id] = entry;
      if (!snap.coverage.semanticCached[level].includes(u.id)) snap.coverage.semanticCached[level].push(u.id);
    }
    applied++;
  }
  await fsp.writeFile(snapPath, JSON.stringify(snap));
  console.log(JSON.stringify({ ok: true, applied, granularity: level, snapshot: snapPath }, null, 2));
}

// ----------------------------------------------------------------------------- render

function normalizeLevel(g) {
  const v = (g || "overall").toLowerCase();
  if (v.startsWith("sess") || v === "per-session") return "session";
  if (v.startsWith("proj") || v === "per-project") return "project";
  return "overall";
}

function timeSavedFor(u, semanticEntry) {
  const actualMin = u.activeMs / 60000;
  if (semanticEntry && semanticEntry.manualMinutes) {
    const mm = semanticEntry.manualMinutes; // {low, expected, high}
    return {
      source: "llm",
      actualMin: +actualMin.toFixed(1),
      manualMin: mm,
      savedMin: { low: +(mm.low - actualMin).toFixed(1), expected: +(mm.expected - actualMin).toFixed(1), high: +(mm.high - actualMin).toFixed(1) },
      multiplier: actualMin > 0 ? +(mm.expected / actualMin).toFixed(1) : null,
      note: semanticEntry.note || null,
    };
  }
  // heuristic fallback (no LLM calibration yet)
  const exp = u.baseline.minutes;
  return {
    source: "heuristic",
    actualMin: +actualMin.toFixed(1),
    manualMin: { low: +(exp * 0.7).toFixed(1), expected: +exp.toFixed(1), high: +(exp * 1.5).toFixed(1) },
    savedMin: { low: +(exp * 0.7 - actualMin).toFixed(1), expected: +(exp - actualMin).toFixed(1), high: +(exp * 1.5 - actualMin).toFixed(1) },
    multiplier: actualMin > 0 ? +(exp / actualMin).toFixed(1) : null,
    note: "Heuristic baseline only — run the skill to calibrate with Claude.",
  };
}

function attachSemantic(u, cache) {
  const entry = u.level === "overall" ? cache.overall : (cache[u.level] || {})[u.id];
  return {
    id: u.id, label: u.label, level: u.level,
    sessionsCount: u.sessionsCount, activeHours: u.activeHours,
    firstTs: u.firstTs, lastTs: u.lastTs,
    edits: u.edits, writes: u.writes, reads: u.reads, bash: u.bashCount,
    bashClasses: u.bashClasses, distinctFiles: u.distinctFiles,
    humanPrompts: u.humanPrompts, assistantMsgs: u.assistantMsgs,
    tokens: u.tokens, tools: u.tools, toolErrors: u.toolErrors,
    toolResults: u.toolResults, toolErrorsTotal: u.toolErrorsTotal,
    linesWritten: u.linesWritten, linesEditedNew: u.linesEditedNew, linesEditedOld: u.linesEditedOld,
    heat: u.heat, baseline: u.baseline,
    narrative: entry?.narrative || null,
    profile: entry?.profile || null,
    timeSaved: timeSavedFor(u, entry),
  };
}

function sessionsOverTime(sessions) {
  const byDate = {};
  for (const s of Object.values(sessions)) {
    if (!s.firstTs) continue;
    const d = s.firstTs.slice(0, 10);
    if (!byDate[d]) byDate[d] = { date: d, sessions: 0, tokens: 0, activeHours: 0 };
    byDate[d].sessions++;
    byDate[d].tokens += (s.tokens.input + s.tokens.output);
    byDate[d].activeHours += s.activeMs / 3600000;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({ ...x, activeHours: +x.activeHours.toFixed(2) }));
}

async function loadTrends(indexPath) {
  if (!fs.existsSync(indexPath)) return [];
  let index;
  try { index = JSON.parse(await fsp.readFile(indexPath, "utf8")); } catch { return []; }
  return index.filter((e) => e.summary)
    .map((e) => ({ generatedAt: e.generatedAt, ...e.summary }))
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
}

async function cmdRender(args) {
  const snapPath = resolveSnapshotPath(args);
  const snap = JSON.parse(await fsp.readFile(snapPath, "utf8"));
  const level = normalizeLevel(args.granularity);
  const templatePath = expandHome(args.template) || path.join(path.dirname(new URL(import.meta.url).pathname), "report-template.html");
  let out = args.out ? expandHome(args.out) : null;
  if (!out && args["out-dir"]) out = path.join(expandHome(args["out-dir"]), `report-${level}-${tsStamp()}.html`);
  if (!out) throw new Error("render requires --out <file> or --out-dir <dir>");

  const cache = snap.semantic || { overall: null, project: {}, session: {} };
  const hero = attachSemantic(rollup(snap.sessions, "overall")[0], cache);
  const units = rollup(snap.sessions, level).map((u) => attachSemantic(u, cache))
    .sort((a, b) => b.activeHours - a.activeHours);
  const projects = rollup(snap.sessions, "project").map((u) => attachSemantic(u, cache))
    .sort((a, b) => b.activeHours - a.activeHours);

  const data = {
    meta: {
      generatedAt: snap.generatedAt, renderedAt: new Date().toISOString(),
      granularity: level, filters: snap.filters, dataDir: snap.dataDir,
      sessionCount: Object.keys(snap.sessions).length,
      projectCount: projects.length,
    },
    baseline: BASELINE,
    hero, units, projects,
    timeline: sessionsOverTime(snap.sessions),
    trends: await loadTrends(path.join(path.dirname(snapPath), "index.json")),
  };

  let template;
  try { template = await fsp.readFile(templatePath, "utf8"); }
  catch { throw new Error(`template not found: ${templatePath}`); }
  const json = JSON.stringify(data).replace(/</g, "\\u003c"); // safe to embed in <script>
  if (!template.includes("__DATA__")) throw new Error("template missing __DATA__ placeholder");
  const html = template.replace("__DATA__", json);

  await fsp.mkdir(path.dirname(out), { recursive: true });
  await fsp.writeFile(out, html);
  console.log(JSON.stringify({ ok: true, out, granularity: level, units: units.length, hero: { activeHours: hero.activeHours, timeSaved: hero.timeSaved } }, null, 2));
}

// ----------------------------------------------------------------------------- main

async function main() {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  const args = parseArgs(argv.slice(1));
  try {
    if (mode === "aggregate") await cmdAggregate(args);
    else if (mode === "semantic-plan") await cmdSemanticPlan(args);
    else if (mode === "apply-semantic") await cmdApplySemantic(args);
    else if (mode === "render") await cmdRender(args);
    else {
      console.error("Usage: node stats.mjs <aggregate|semantic-plan|apply-semantic|render> [--flags]");
      process.exit(2);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
}

main();
