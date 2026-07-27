# Baseline scan and hash-map measurement

This package measures two correct implementations of Two Sum:

- `two_sum_scan` checks each pair in index order.
- `two_sum_hash` stores the first index for each value in an
  `std::unordered_map`.

The correctness executable compares both implementations across six fixed
cases and 5,000 deterministic randomized cases. A result is checked by its
indices and sum because inputs with repeated values may have several valid
pairs.

## Build and test

Google Benchmark 1.9.5 is fetched at configure time. Use a release build for
measurements.

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
```

Run the differential tests under AddressSanitizer and
UndefinedBehaviorSanitizer:

```bash
cmake -S . -B build-sanitizers -G Ninja \
  -DCMAKE_BUILD_TYPE=Debug \
  -DCPP_TWO_SUM_BUILD_BENCHMARKS=OFF \
  -DCMAKE_CXX_FLAGS="-O1 -g -fno-omit-frame-pointer -fsanitize=address,undefined"
cmake --build build-sanitizers
ctest --test-dir build-sanitizers --output-on-failure
```

Run repeated, randomly interleaved measurements and retain the raw JSON:

```bash
./build/two_sum_benchmark \
  --benchmark_min_warmup_time=0.1 \
  --benchmark_min_time=0.2s \
  --benchmark_repetitions=9 \
  --benchmark_enable_random_interleaving=true \
  --benchmark_report_aggregates_only=true \
  --benchmark_out=results/latest.json \
  --benchmark_out_format=json

python3 scripts/summarize.py results/latest.json results/latest.csv
```

Each input contains the integers `[0, n)`. The `last_pair` target has one
solution at the final two indices, so both implementations process the full
input. The `miss` target is negative and has no solution. These cases make the
amount of work stable across repetitions.

`benchmark::DoNotOptimize` keeps the result observable. Input construction
happens before the timed loop. The hash-map timing includes allocation,
hashing, collision checks, and destruction because all are part of the
implementation's per-call cost.

## Hardware counters with Linux perf

Run the supplied script on a Linux host where `perf_event_open` is permitted:

```bash
PERF_REPETITIONS=7 PERF_INPUT_SIZE=4096 \
  ./scripts/run_perf.sh build/two_sum_benchmark results/perf
```

The two processes are measured separately. The files report cycles,
instructions, branches, branch misses, cache references, and cache misses.
Pinning the process to one physical core and fixing the CPU frequency improves
run-to-run stability when the machine permits those controls:

```bash
taskset -c 2 ./scripts/run_perf.sh build/two_sum_benchmark results/perf
```

Google Benchmark supplies repeated timing statistics. `perf stat` explains
some of the hardware cost behind those timings. Perfetto Track Events are
better suited to longer phase and thread timelines; trace instrumentation
would materially perturb these short functions.

## Reading the result

The pair scan performs no allocation and can be faster for very small arrays.
Its number of comparisons grows quadratically for the selected inputs. The
hash-map implementation performs allocations and irregular memory accesses,
then reaches a crossover where its linear growth dominates. Treat the
crossover as a property of the recorded compiler, standard library, CPU, and
input distribution.

References:

- [Google Benchmark user guide](https://google.github.io/benchmark/user_guide.html)
- [Perfetto Track Events](https://perfetto.dev/docs/instrumentation/track-events)
- [libstdc++ hashtable source](https://gcc.gnu.org/onlinedocs/libstdc++/latest-doxygen/a17921_source.html)
