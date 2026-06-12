#!/usr/bin/env python3
"""Bucket problem-details records by `pattern`.

Reads every *.json record in a directory and groups them by their (normalized) `pattern`,
so the model can spend its effort writing drills instead of hand-sorting hundreds of files.

Usage:
    python bucket.py <records-dir> [--json]

Default output is a human-scannable summary (pattern, count, record ids). With --json it
prints {pattern: [{id, name, file}], ...} plus a "_skipped" list for pattern == null.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

# Normalize toward the canonical names in ../problem-details/references/patterns.md.
# Only obvious aliases are mapped; umbrella labels the records actually use are kept as-is
# (e.g. dynamic-programming stays one bucket rather than being split into DP sub-families).
ALIASES = {
    "fast-slow-pointers": "fast-slow-cycle",
    "fast-slow": "fast-slow-cycle",
}

# Patterns intentionally excluded from the deck — not null, but skipped by preference.
# `dynamic-programming`: the author solves these as backtracking + memoization, so DP is not
# drilled as its own pattern. Edit this set to change what's excluded.
SKIP_PATTERNS = {"dynamic-programming"}


def normalize(pattern):
    if pattern is None:
        return None
    p = str(pattern).strip().lower()
    return ALIASES.get(p, p)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("records_dir", help="directory of problem-details *.json records")
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = ap.parse_args()

    root = Path(args.records_dir)
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")

    buckets = defaultdict(list)
    skipped = []          # pattern == null (no technique to drill)
    skipped_pref = []     # in SKIP_PATTERNS (excluded by preference)
    errors = []

    for f in sorted(root.glob("*.json"), key=lambda p: p.stem):
        try:
            rec = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError) as e:
            errors.append(f"{f.name}: {e}")
            continue
        entry = {"id": rec.get("id"), "name": rec.get("name"), "file": str(f)}
        pat = normalize(rec.get("pattern"))
        if pat is None:
            skipped.append(entry)
        elif pat in SKIP_PATTERNS:
            skipped_pref.append(entry)
        else:
            buckets[pat].append(entry)

    if args.json:
        out = {pat: buckets[pat] for pat in sorted(buckets)}
        out["_skipped"] = skipped
        out["_skipped_preference"] = skipped_pref
        if errors:
            out["_errors"] = errors
        print(json.dumps(out, indent=2))
        return

    total = sum(len(v) for v in buckets.values())
    print(f"{total} records in {len(buckets)} patterns  "
          f"(+{len(skipped)} null, +{len(skipped_pref)} skipped by preference)\n")
    for pat in sorted(buckets, key=lambda p: (-len(buckets[p]), p)):
        ids = ", ".join(str(e["id"]) for e in buckets[pat])
        print(f"  {pat:22} {len(buckets[pat]):3}  [{ids}]")
    print(f"\n  {'_skipped (null)':22} {len(skipped):3}")
    if skipped_pref:
        names = ", ".join(sorted(SKIP_PATTERNS))
        print(f"  {'_skipped (preference)':22} {len(skipped_pref):3}  [{names}]")
    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f"  {e}")


if __name__ == "__main__":
    main()
