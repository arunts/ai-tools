# Pattern vocabulary — a named technique, or `null`

`pattern` names a reusable algorithmic technique a solver would *recognize and study* —
not every micro-trick. If the solution falls straight out of basic iteration, hashing,
or a simple scan with no named technique, `pattern` is **`null`** (e.g. Two Sum).

**Litmus:** *"would I have to KNOW this technique, or does it follow from intuition?"*
Know-it-required → name it. Intuitive → `null`.

Use these canonical names (kebab-case) so records stay groupable.

## Named techniques

**Arrays / strings**
- `two-pointer` — converging or fast/slow, when the movement rule is the trick
- `sliding-window` — fixed or variable size
- `prefix-sum`
- `monotonic-stack` · `monotonic-deque`
- `binary-search` — on an index, or on the answer

**Graph / tree**
- `bfs` · `dfs`
- `backtracking`
- `topological-sort`
- `union-find`
- `trie`
- `dijkstra`
- `tree-traversal` — pre/in/post/level, when the traversal itself is the point

**Dynamic programming**
- `kadane`
- `linear-dp` · `grid-dp`
- `knapsack-01` · `knapsack-unbounded`
- `interval-dp` · `subsequence-dp` · `bitmask-dp` · `dp-on-tree`

**Heap**
- `top-k-heap` · `k-way-merge` · `two-heaps`

**Linked list**
- `fast-slow-cycle` · `pointer-reversal`

**Other**
- `greedy` — when a specific exchange/sort insight is the technique
- `bit-manipulation` — when XOR / mask tricks are the technique

## Not patterns → `null`

Basic array/string iteration, hashing / frequency counting, simple membership lookups,
direct formula or math. These are just "the algorithm" — captured in the `algorithm`
field — with `pattern: null`.
