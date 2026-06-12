# Visual metaphors — pattern → motion

Pick the sketch's motion from the drill's pattern. The art should let a viewer *narrate the
algorithm*. These are starting points, not templates — build the specific drill's mechanic.

| pattern | what the sketch shows |
|---|---|
| `sliding-window` | a translucent band over a row of cells; right edge advances each step, left edge **jumps** forward when the window breaks its rule; a marker trails the best window so far |
| `two-pointer` | two markers starting at opposite ends, **converging**; the gap between them is the live state; they meet at the answer |
| `fast-slow-cycle` | two dots on a looping track at 1× and 2× speed; the fast laps and **collides** with the slow inside the loop |
| `binary-search` | an interval repeatedly **halved**; the discarded half dims; the probe lands on the midpoint each step |
| `backtracking` | a tree **growing depth-first**, dead branches **pruned** (fading) on a failed constraint, the live path glowing back to the root |
| `dfs` | a single path **plunging deep** then unwinding; visited nodes stay lit |
| `bfs` | concentric **rings expanding** outward from a source, one frontier per step |
| `topological-sort` | nodes **lifting off** only once their prerequisites have cleared; a settling layered order |
| `monotonic-stack` | bars **pushed** onto a stack; a taller incoming bar **pops** everything it dominates (toppling) |
| `union-find` | scattered points **merging into clusters**; representative links snap to roots (path compression) |
| `kadane` | a running **ridgeline**; it resets to the baseline whenever the sum dips below zero; the peak is marked |
| `prefix-sum` | bars accumulating into a **cumulative staircase**; a range query lights the difference of two heights |
| `heap` | a triangle of nodes **sifting**; an inserted value bubbles up / the root sinks down to restore order |
| `trie` | a **letter-tree growing**; shared prefixes share a trunk; a complete word lights a terminal |
| `greedy` | a sequence of **locally-best picks** snapping into place, each committed and never revisited |
| `bit-manipulation` | a row of **bits flipping** under masks/XOR; paired bits cancel to reveal the lone survivor |
| `matrix-traversal` | a path **spiraling / sweeping** a grid, cells consumed in the traversal order |

If a drill's mechanic isn't listed, derive the motion from its `**Steps:**` — animate the
state those steps mutate.
