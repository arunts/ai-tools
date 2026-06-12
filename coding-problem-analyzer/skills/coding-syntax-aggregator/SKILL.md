---
name: coding-syntax-aggregator
description: >-
  Pool the `syntax[]` from one or more `problem-details` records into deduplicated,
  chapter-grouped markdown files — creating categories as needed and quarantining
  special/derivable syntax into a single `extended` chapter. Use when grouping or
  merging the syntax from analyzed problems, or building/updating the syntax reference.
---

# coding-syntax-aggregator — pool `problem-details` syntax into a deduped, chapter-grouped reference

The `problem-details` skill produces per-problem records with `syntax: [ { use, note, chapter } ]`.
This skill reads that `syntax` field across one or more records, pools it into
chapter-grouped files, drops duplicates, and parks "special / derivable" syntax in one
`extended` chapter — so the core chapters hold only the **essential base syntax** worth
memorizing, and the nice-to-have stuff waits in one place for later.

This skill is **syntax-only** (pattern analysis is separate).

## Inputs

1. **`problem-details` record JSON(s)** — one or many records from `problem-details`. Only their
   `syntax[]` is used.
2. **(Optional) existing grouped-syntax chapters** — a directory of markdown chapter
   files from a previous run, to merge into. If none is given, build a fresh set
   (default location: `syntax-chapters/`).

## Steps

1. **Collect** — pull every `syntax` item `{ use, note, chapter }` from the input
   record(s).
2. **Generalize** — rewrite each `use` into a reusable, problem-agnostic form: strip
   problem-specific names (`x in seen` → `key in d`, `best = cur = nums[0]` →
   `best = cur = x`). Keep the one-line note.
3. **Decompose to core** — reduce each `use` to the smallest syntax that carries the
   lesson, built from other core syntax. Ask: *"what is the smallest core syntax I'd need
   to remember, and can I build this from other core syntax?"*
   - **Simplify to minimal form** — strip incidental sub-expressions down to the smallest
     snippet that still teaches the point; replace the rest with a trivial placeholder.
     `a, b = b, a + b` → `a, b = b, a` (the lesson is simultaneous-assignment ordering —
     `a` is read before it is rebound — not the `+`).
   - **Split compositions** — when a `use` composes independent constructs `f(g(x))`,
     break it into atomic entries, each routed to its own `chapter`, and capture each atom
     once. `tuple(sorted(word))` → `sorted(seq)` (chapter `sorting`) **and** `tuple(seq)`
     (chapter `tuples`); `''.join(sorted(word))` → `sorted(seq)` + `''.join(seq)`. Skip
     splitting only when the *composition itself* is the non-obvious idiom worth recalling
     whole.
   - Keep only the resulting atoms; drop any that are trivially basic.
4. **Group** — append each item to its chapter file (keyed by `chapter`), merging with
   what's already there. If a `chapter` has no file yet, create that category **with
   frontmatter** (`id`, `title`, `group`, `order` — see Output format). When merging into
   an existing chapter, **preserve its frontmatter** and only append/dedup entries.
5. **Dedup + quarantine** —
   - Merge exact / near duplicates into a single entry.
   - If a construct is **special** — easily rebuilt from base syntax the reader already
     knows (a convenience or derivable idiom) — do NOT keep it in its topic chapter.
     Move it to the single **`extended`** chapter, grouped only there.
     **Litmus:** *"can I rebuild this from base syntax without memorizing it?"* → yes ⇒ `extended`.
     **Decompose first** (Step 3): quarantine only constructs that are *irreducible* — a
     single derivable convenience or library call that can't be split into smaller core
     syntax (`Counter(s).most_common(k)`, `divmod`, `heapq.nlargest`). Anything
     decomposable should already be core atoms in their chapters, not in `extended`.
     Base syntax that STAYS in its chapter: `enumerate`, `d.get(k, default)`, slicing,
     `x in d`, comprehensions.
6. **Write** the updated chapter files + `extended.md`.

## Output format

Plain markdown, one file per category. **Each file opens with YAML frontmatter**, then a
`# Title` heading, then the entries:

```
---
id: basics
group: Basic
title: Basics
order: 1
---
# Basics
- `enumerate(nums)` — index + value together in one loop
- `0 <= i < n` — chained comparison; a single in-bounds check
```

Frontmatter fields:
- `id` — category id, lowercase/kebab; also the filename (`basics.md`).
- `title` — display name (`Basics`).
- `group` — a logical bucket for related categories: `Basic`, `Collections`, `OOP`,
  `Numeric`, … Pick the fitting one per category; reuse existing group names across runs.
- `order` — integer; relative display order across all chapters. A new category gets the
  next value after the current max.

Each entry (after the frontmatter + `# Title`) is a **short, self-explanatory statement of
the construct — NOT a runnable example**: no `print(...)`, no full program, no I/O
scaffolding. Just the syntax (optionally a tiny illustrative form) plus a one-line note.
No provenance tags — the core syntax is what matters, not which problem it came from.

`extended.md` holds the quarantined special syntax (the "review later" pile); give it its
own `group: Extended` and a high `order` so it sorts last.

## Worked example

Input — `syntax[]` collected from six `problem-details` records:

| from | use | note | chapter |
|---|---|---|---|
| Two Sum (1) | `enumerate(nums)` | index + value in one loop | basics |
| Two Sum (1) | `x in seen` | dict membership, O(1) | dicts |
| Max Subarray (53) | `best = cur = nums[0]` | seed two names at once | basics |
| Combination Sum (39) | `res.append(path[:])` | snapshot a mutating list | lists |
| Combination Sum (39) | `path.append(x) ... path.pop()` | choose then undo | lists |
| Number of Islands (200) | `0 <= r < rows` | in-bounds check | basics |
| Number of Islands (200) | `grid[r][c] = '0'` | mark visited in place | lists |
| Group Anagrams (49) | `tuple(sorted(word))` | sorted-letters anagram key | tuples |
| Fibonacci (509) | `a, b = b, a + b` | roll two values forward | tuples |

Output files (after generalize + **decompose**):

```
---
id: basics
group: Basic
title: Basics
order: 1
---
# Basics
- `enumerate(nums)` — index + value together in one loop
- `best = cur = x` — chained assignment; seed several names from one value
- `0 <= i < n` — chained comparison; a single in-bounds check
- `a, b = b, a` — simultaneous assignment; whole RHS is read before binding, so values swap with no temp
```
```
---
id: lists
group: Collections
title: Lists
order: 2
---
# Lists
- `lst[:]` — shallow copy / snapshot a list that's still mutating
- `lst.append(x) ... lst.pop()` — use a list as a stack: choose, then undo
- `grid[r][c] = v` — mark a cell visited in place (no separate seen-set)
```
```
---
id: dicts
group: Collections
title: Dicts
order: 3
---
# Dicts
- `key in d` — membership test on dict keys, O(1)
```
```
---
id: tuples
group: Collections
title: Tuples
order: 4
---
# Tuples
- `tuple(seq)` — turn any iterable into a tuple (e.g. a hashable dict key)
```
```
---
id: sorting
group: Stdlib
title: Sorting
order: 5
---
# Sorting
- `sorted(seq)` — return a new sorted list from any iterable
```
```
---
id: extended
group: Extended
title: Extended
order: 99
---
# Extended
(empty — nothing in this batch was irreducible-derivable)
```

Note the three normalizations applied: **generalize** (`x in seen` → `key in d`),
**simplify** (`a, b = b, a + b` → `a, b = b, a` — the incidental `+ b` drops and the atom
re-routes from `tuples` to `basics` as a plain swap), and **split**
(`tuple(sorted(word))` becomes two atoms — `sorted(seq)` in `sorting` and `tuple(seq)` in
`tuples`). Nothing here was irreducible-derivable, so `extended` stays empty; on a later
batch `Counter(s).most_common(k)` would land in `extended.md`, not its topic chapter.
