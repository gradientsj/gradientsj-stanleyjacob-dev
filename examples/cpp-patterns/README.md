# C++ problem-solving patterns

This package contains the complete implementations used by the C++ pattern
chapters on stanleyjacob.dev. The code is grouped by the state each algorithm
maintains:

- `arrays.hpp`: two pointers, windows, prefix counts, cyclic placement, intervals
- `graphs.hpp`: traversal, topological order, disjoint sets, shortest paths, MST
- `search.hpp`: binary search, heaps, monotonic structures, and tries
- `dp.hpp`: backtracking and the main dynamic-programming state shapes
- `range.hpp`: Fenwick, segment, lazy segment, and sparse tables
- `strings_math.hpp`: KMP, Z, rolling hash, Manacher, modular arithmetic, and sieve
- `greedy_games.hpp`: greedy orderings, inversions, permutation cycles, Nim, Grundy

The implementations favor explicit contracts and half-open ranges. They do not
depend on a test framework, so the whole package builds with a stock C++20
compiler.

## Build and run

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

For memory and undefined-behavior instrumentation:

```bash
cmake -S . -B build-sanitize \
  -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
cmake --build build-sanitize --parallel
ctest --test-dir build-sanitize --output-on-failure
```

The test executable covers normal inputs, duplicates, empty inputs, impossible
answers, disconnected graphs, and boundary-sensitive range queries. It also
compares selected optimized implementations with direct reference versions on
deterministic randomized inputs.
