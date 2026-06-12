---
name: algo-pattern-analyzer
description: >-
  Turn `problem-details` records into a per-pattern practice deck. For each algorithmic
  pattern, distill one reusable **core algorithm** to drill, then group the problems that use
  it by sub-mechanism — each a blind-attemptable problem statement, terse algorithm steps, and
  a generalized Python solution. Use whenever the user wants to practice or drill algorithm
  patterns, turn analyzed problems into reusable practice problems, build a pattern
  cheat-sheet of core algorithm + variations, group their solutions by pattern, or asks "what
  algorithm should I practice", "make drills from my records", "extract the algorithms by
  pattern". Consumes the JSON records from `problem-details` (uses `pattern`, `code`,
  `algorithm`).
---

# algo-pattern-analyzer — records → a per-pattern practice deck

`problem-details` produces one record per problem: `{ id, name, pattern, algorithm, code,
syntax, complexity }`. This skill is the **algorithm-axis counterpart of
`coding-syntax-aggregator`**: where that pools the `syntax[]` across records, this one pools the
**algorithm itself** — bucketing records by `pattern`, distilling the reusable core, and
turning each problem into a *drill*.

Each pattern file has two layers:

1. **Core algorithm** — the one reusable skeleton a learner should be able to reproduce from
   memory. This is the thing you actually *practice*; every variant is this filled in.
2. **Variants, grouped by sub-mechanism** — the distinct ways the core specializes (e.g. a
   sliding window is *variable-size* or *fixed-size*; two pointers *converge* or run
   *slow/fast*). Each variant is a drill:
   - a **problem statement** you can read and attempt *blind* — no problem name, no technique
     spoiler, just the task and its cost target;
   - terse **algorithm steps** capturing what is specific to *this* problem beyond the core;
   - the **Python solution**.

The point is active recall: read the prompt, reproduce the core, then see what each variant
adds. So the headings stay honest prompts, the core stays minimal enough to memorize, and the
steps capture only the per-problem cleverness.

This skill is **algorithm-only**. Syntax extraction is `coding-syntax-aggregator`'s job; this
deliberately drops the `syntax[]` field.

## Inputs

1. **`problem-details` record JSON(s)** — one or many. Default: every `*.json` in the
   records directory (e.g. `records/`). Reads `pattern` (bucket key), `algorithm` (raw
   material for the problem statement + steps), and `code` (becomes the solution).
2. **(Optional) an existing drills directory** to merge into (default `pattern-drills/`).

## Steps

1. **Bucket by `pattern`.** Group records under their `pattern`. Records with `pattern: null`
   have no technique to drill (by `problem-details`'s litmus, `null` means "follows from
   intuition") — **skip them**, but list them in `_skipped.md` so the omission is visible,
   never silent. Also exclude any pattern in `bucket.py`'s `SKIP_PATTERNS` (default:
   `dynamic-programming`, which the author solves as backtracking + memoization) — record
   these under a separate "Skipped by preference" section in `_skipped.md`. The deterministic
   sort is tedious over hundreds of files; run `scripts/bucket.py <records-dir>` to get the
   `pattern → [records]` grouping (plus both skip lists), then spend your effort on the
   writing below.
2. **Normalize the pattern label** toward the canonical vocabulary in
   `../problem-details/references/patterns.md` (e.g. `fast-slow-pointers` →
   `fast-slow-cycle`). Keep the umbrella labels the records actually use — the goal is one
   obvious file per pattern, not taxonomic purity.
3. **Distill the Core algorithm.** This section is the heart of the file — make the pattern
   *understandable*, not merely present. Include, in order:
   - an **Intuition block** of four one-liners: **Reach for it when** (the cues in a problem
     that should make a solver pick this pattern), **Invariant** (what is always true as it
     runs), **Why it works** (the one-sentence argument / the cost it buys), **Mental model**
     (a sticky metaphor);
   - the reusable **skeleton** — a short commented Python template, with placeholders
     (`INVALID(window)`, `choices(state)`) where the specifics vary;
   - a **worked trace** — the core run on ONE small concrete input: a markdown **table** for
     iterative patterns (columns = the state that changes each step), or an indented
     **call-trace** code block for recursive ones. **Verify the trace by actually running the
     code** on that input (a quick script) — a wrong trace is worse than none.
   Keep each piece tight; the core is what the learner practices and must hold in their head.
4. **Group the variants by sub-mechanism.** Sort the bucket's records into the few distinct
   ways the core specializes, each a `##` section (e.g. binary search → *on an index* vs *on
   a rotated array*; backtracking → *pick-from-a-list* vs *arrange-each-once* vs
   *grid/in-place*). This is the structure that makes a pattern's family legible. If a
   pattern really has only one mechanism, a single group (or none) is fine — don't force it.
   When the problems in a group share a setup, state it **once** as a one-line italic note
   right under the `##` header (e.g. *"The array was sorted, then rotated at an unknown
   pivot."*) so the individual headings can drop it.
5. **Write each drill** (a `###` under its group):
   - **Problem statement heading** — restate the record's task as a concise prompt a solver
     could attempt cold. **Strip every source-problem name/number** and any problem-specific flavor;
     **don't leak the technique** (state *what* to compute, never *how*); **state the cost
     target** when it's part of the challenge (e.g. "O(log n)"). **Be concise — lean on
     context:** the pattern and the group note already establish the shared setup
     (binary-search ⇒ sorted input; a "rotated array" group ⇒ the rotation), so don't repeat
     it in every heading. Keep each heading to only what is unique to that problem — it keeps
     cognitive load low while reading down a section.
   - **Steps** — one tight `**Steps:**` line (or a few) capturing what is specific to *this*
     problem on top of the core: the state it tracks, its invalid-test, the non-obvious
     insight (e.g. "window never shrinks, so the final width is the answer"). Not a
     re-narration of the core.
   - **Solution** — the record's `code`, generalized: drop the `class Solution` / `def
     name(self, …)` wrapper, use neutral conventional names (`nums`, `target`, `dfs`, `lo`,
     `hi`), keep it minimal and complete, and add an inline `#` comment only on the one line a
     learner most often gets wrong.
6. **Dedup.** Many records collapse to the same drill once generalized — merge true
   duplicates. Keep genuinely distinct sub-problems (covering a pattern's *variations* is the
   value, so don't over-merge).
7. **Emit one file per pattern** at `<drills-dir>/<pattern>.md` (default `pattern-drills/`, a
   sibling of the records). On a re-run, **merge**: add new drills, drop duplicates, preserve
   order. Also (re)write `<drills-dir>/_skipped.md`.

## Output format

One markdown file per pattern, with this structure (everything visible — no collapsing):

```
# Pattern Name

## Core algorithm
**Reach for it when:** <cues in a problem that signal this pattern>
**Invariant:** <what's always true as it runs>
**Why it works:** <one-sentence argument / cost it buys>
**Mental model:** <sticky metaphor>

<optional 1–2 line "in code" note>
​```python
<commented skeleton with placeholders>
​```
**Trace** — <one small concrete input>:

<a markdown table whose columns are the changing state per step — OR, for recursive
patterns, an indented ```text call-trace block>

## <Sub-mechanism group A>
*<one-line shared setup, only if the group shares one>*

### <problem statement — only what's unique to it; cost target>
**Steps:** <what's specific to this problem beyond the core>
​```python
<generalized solution>
​```

### <next problem statement>
**Steps:** …
​```python
…
​```

## <Sub-mechanism group B>
…
```

`_skipped.md` is a flat list of the `null`-pattern problems left out, so nothing is silently
dropped:

```
# Skipped (pattern: null — intuitive, no technique to drill)
- 1 Two Sum
- 146 LRU Cache
```

**Optional hide-the-answer variant:** if the user wants solutions hidden until they choose to
look (strict self-test), wrap each `**Steps:**`+code in a `<details><summary>…</summary>`
block (renders collapsed on GitHub / markdown preview). Default is everything visible.

## Worked example

The `sliding-window` bucket → `pattern-drills/sliding-window.md`. One core skeleton, then
variants split into *variable-size* and *fixed-size* groups. Note the core is the thing you
drill; each variant's `**Steps:**` captures only what it adds (the char-replacement insight,
the fixed-window slide), and headings never say "sliding window".

````markdown
# Sliding Window

## Core algorithm
**Reach for it when:** a contiguous substring/subarray asking for longest/shortest/count under a constraint that loosens as you shrink and tightens as you grow.
**Invariant:** after the inner `while`, the window `[left, right]` is always valid — so each `right` records the best window ending there.
**Why it works:** `left` only moves forward, so each element enters and leaves the window once → O(n), not O(n²).
**Mental model:** a caterpillar — the head (`right`) reaches forward, the tail (`left`) catches up only when it must.

Three beats: **expand** `right`, **shrink** `left` while the window breaks its rule,
**record**. Every variant fills in `window`, the invalid-test, and the record step.
```python
def sliding_window(seq):
    left = 0
    best = 0
    window = {}                       # running state: counts / sum / distinct ...
    for right in range(len(seq)):
        # include seq[right] in `window`
        while INVALID(window):        # window broke its constraint
            # remove seq[left] from `window`
            left += 1
        best = max(best, right - left + 1)
    return best
```
**Trace** — longest substring with no repeat in `"abcabcbb"`:

| right | s[right] | left | window | best |
|---:|:---:|---:|:---|---:|
| 0 | a | 0 | `a` | 1 |
| 3 | a | 1 | `bca` | 3 |
| 6 | b | 5 | `cb` | 3 |

## Variable-size window
*Over a string `s`; return the length of the longest valid window.*

### No repeated character. O(n).
**Steps:** State = last index each char was seen. When the new char was seen at an index
`>= left`, jump `left` past it (no crawl). Maximize width.
```python
def longest_unique(s):
    last = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in last and last[ch] >= left:
            left = last[ch] + 1
        last[ch] = right
        best = max(best, right - left + 1)
    return best
```

### After replacing up to `k` characters, all one character. O(n).
**Steps:** Track counts + `max_freq` (most common char in the window). Valid while
`width - max_freq <= k`. On invalid, slide left *once* — the window never shrinks, so the
final width is the answer.
```python
def char_replacement(s, k):
    count = {}
    max_freq = left = 0
    for right, c in enumerate(s):
        count[c] = count.get(c, 0) + 1
        max_freq = max(max_freq, count[c])
        if (right - left + 1) - max_freq > k:
            count[s[left]] -= 1
            left += 1
    return len(s) - left
```

## Fixed-size window

### Start indices of every anagram of `p` in `s`. O(n).
**Steps:** Window is *fixed* at `len(p)` — no while-shrink. Slide one char at a time keeping a
count map; record a hit when the window's counts equal `p`'s.
```python
def find_anagrams(s, p):
    from collections import Counter
    need, window, res = Counter(p), Counter(), []
    for i, c in enumerate(s):
        window[c] += 1
        if i >= len(p):
            left = s[i - len(p)]
            window[left] -= 1
            if window[left] == 0:
                del window[left]
        if window == need:
            res.append(i - len(p) + 1)
    return res
```
````

What the example demonstrates:
- **Core vs variants** — the skeleton is drilled once; variants are it specialized.
- **Sub-mechanism groups** — variable-size and fixed-size windows are separated so the family
  is legible.
- **Steps capture only the delta** — the per-problem insight, not a re-narration of the core.
- **Concise, context-leaning headings** — the group note carries the shared setup (a string
  `s`, "longest length"), so each heading states only what's unique to it.
- **Blind headings, neutral code** — no problem names/numbers, conventional names, one comment
  on the line that trips people up.
