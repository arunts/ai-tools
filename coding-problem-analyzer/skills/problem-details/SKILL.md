---
name: problem-details
description: >-
  Analyze a single coding problem into a compact study record — the Python
  solution, the algorithm in plain prose, the named pattern it uses (or none), and
  only the noteworthy Python syntax. Use when the user wants to understand a problem's pattern +
  syntax without coding it, or says "analyze <problem>", "what's the pattern for
  <problem>", "break down <problem>".
---

# problem-details — one coding problem → study record

Turn a coding problem into a compact record you can learn from: the **code** (the Python
solution), the **algorithm** (plain prose), the **pattern** it uses (or `null`), and only
the **syntax** worth remembering. The point is to absorb the underlying pattern + Python
without grinding every problem.

## Input

A coding problem — a name and/or id (e.g. "Number of Islands"). The user may
paste their own solution; if they don't, recall a minimal correct one from knowledge.

## Flow

1. **Solution first.** Recall (or take from the user) a minimal, idiomatic Python
   solution. Keep it to the algorithmic core — no edge-case noise.
2. **Derive the record** from that solution, following the rules below.
3. **Output** the record as JSON. (Optionally save each record to its own file, e.g.
   `records/<id>.json`, if you're collecting them — the location is the caller's choice.)

## The record

```
id, name
pattern    : "<named technique>" | null
algorithm  : prose explanation
code       : "python solution — the source the record is derived from"
syntax     : [ { use, note, chapter } ]
complexity : "time ... / space ..."
```

## Rules — follow exactly

1. **`pattern` = the named heavyweight technique, or `null`.** Use a controlled name
   (`bfs`, `dfs`, `backtracking`, `topological-sort`, `kadane`, a DP family,
   `monotonic-stack`, `union-find`, `binary-search`, `two-pointer`, …) when the
   problem genuinely uses one. Use `null` when the solution is just basic iteration /
   hashing with no special technique (e.g. Two Sum). See `references/patterns.md`.
   Litmus: *would a solver have to KNOW the technique, or does it follow from
   intuition?* Know-it → name it. Intuitive → `null`.
2. **`algorithm` = plain-English PROSE.** Describe the approach in flowing sentences.
   NOT pseudocode — no inline code expressions like `cur = max(n, cur + n)`, no
   `Why:` labels. **Length scales with difficulty:** an intuitive approach is one
   line; a non-obvious one (Kadane, DP, clever graph trick) gets a few sentences
   covering the idea AND why it works.
3. **`code` = the Python solution.** The minimal, idiomatic solution from Flow step 1 —
   the algorithmic core the rest of the record is derived from. Store as a string of real
   Python (`\n`-separated lines). Keep it tight: no edge-case guards, no comments, no I/O
   scaffolding — the same code you'd read the `algorithm` and `syntax` off of.
4. **`syntax` = signal only.** List ONLY the peculiar / worth-remembering Python
   constructs, each as `{ use, note, chapter }`. DROP basic syntax — for-loops,
   assignment, arithmetic, return, plain indexing. `syntax: []` is a valid, honest
   answer when nothing is notable. `chapter` is a stable, lowercase syntax-category
   label (`basics`, `lists`, `dicts`, `sets`, `strings`, `heapq`, `deque`, …) — the
   `coding-syntax-aggregator` skill buckets entries by it.
5. **No `difficulty`, no `confidence`, no `kernel`.** Just the six fields above.

## Few-shot exemplars

```json
// intuitive → pattern null, one-line algorithm, two syntax items
{ "id": 1, "name": "Two Sum",
  "pattern": null,
  "algorithm": "Is the complement (target - n) already in the seen-map?",
  "code": "def twoSum(self, nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i",
  "syntax": [
    { "use": "enumerate(nums)", "note": "index + value in one loop", "chapter": "basics" },
    { "use": "x in seen", "note": "membership test on dict keys, O(1)", "chapter": "dicts" }
  ],
  "complexity": "time O(n) / space O(n)" }
```
```json
// needs-study → prose algorithm with the 'why', syntax trimmed to one notable item
{ "id": 53, "name": "Maximum Subarray",
  "pattern": "kadane",
  "algorithm": "Scan left to right keeping a running sum of the current stretch. At each number, either keep extending that stretch or start over from this number — whichever gives the bigger sum. If the running sum ever drops below zero it can only weigh down whatever comes next, so you abandon it and start fresh. The answer is the largest running sum you saw anywhere along the way.",
  "code": "def maxSubArray(self, nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best",
  "syntax": [
    { "use": "best = cur = nums[0]", "note": "chained assignment — seed both from one value", "chapter": "basics" }
  ],
  "complexity": "time O(n) / space O(1)" }
```
```json
// named pattern → prose algorithm, syntax = the two notable backtracking idioms
{ "id": 39, "name": "Combination Sum",
  "pattern": "backtracking",
  "algorithm": "Build a running list of picks and explore depth-first. At each step try each candidate from the current position onward, add it, and recurse on the smaller remaining target; when you return, remove it and try the next. Recursing from the same position (not the next) is what lets a number be reused, and only ever moving forward stops the same combination appearing in a different order. Keep a list whenever the remaining target reaches exactly zero.",
  "code": "def combinationSum(self, candidates, target):\n    res = []\n    def bt(start, path, remain):\n        if remain == 0:\n            res.append(path[:])\n            return\n        for i in range(start, len(candidates)):\n            if candidates[i] <= remain:\n                path.append(candidates[i])\n                bt(i, path, remain - candidates[i])\n                path.pop()\n    bt(0, [], target)\n    return res",
  "syntax": [
    { "use": "res.append(path[:])", "note": "snapshot the path — it keeps mutating, store a copy", "chapter": "lists" },
    { "use": "path.append(x) ... path.pop()", "note": "make a choice, then undo it on the way back", "chapter": "lists" }
  ],
  "complexity": "time ~O(N^(T/min)) / space O(T/min)" }
```

What the exemplars demonstrate:
- **Two Sum** — intuitive → `pattern: null`, one-line `algorithm`, only the 2 notable syntax bits.
- **Maximum Subarray** — `kadane` is non-obvious → fuller prose covering the idea + the why; syntax trimmed to the single notable item.
- **Combination Sum** — `backtracking` → prose explains the recurse/undo and the start-index trick; syntax = the two backtracking idioms only (the snapshot copy and the choose/undo).
