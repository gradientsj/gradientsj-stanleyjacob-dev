# Recorded result

Recorded on 2026-07-27 with GCC 11.4, libstdc++, Google Benchmark 1.9.5,
Release optimization, and CPU frequency scaling disabled. The host exposed 52
virtual CPUs at 2.0 GHz. The benchmark process reported a load average of 2.18
at startup, so the result describes this host and run.

Command:

```bash
./build/two_sum_benchmark \
  --benchmark_min_warmup_time=0.1 \
  --benchmark_min_time=0.2s \
  --benchmark_repetitions=9 \
  --benchmark_enable_random_interleaving=true \
  --benchmark_report_aggregates_only=true \
  --benchmark_out=results/latest.json \
  --benchmark_out_format=json
```

Median CPU time for the `last_pair` input:

| Elements | Pair scan | Hash map | Lower median |
|---:|---:|---:|---:|
| 16 | 0.081 µs | 0.401 µs | Pair scan, 5.0× |
| 64 | 1.025 µs | 1.884 µs | Pair scan, 1.84× |
| 256 | 15.205 µs | 10.156 µs | Hash map, 1.50× |
| 1,024 | 194.711 µs | 39.077 µs | Hash map, 4.98× |
| 4,096 | 2.917 ms | 0.153 ms | Hash map, 19.12× |
| 16,384 | 45.930 ms | 0.607 ms | Hash map, 75.61× |

`latest.json` is the complete Google Benchmark output. `latest.csv` contains
the median CPU times for both the `last_pair` and `miss` input families.

Linux hardware counters were blocked on the recorded host because
`kernel.perf_event_paranoid` was 4. `scripts/run_perf.sh` is ready to collect
cycles, instructions, branches, branch misses, cache references, and cache
misses on a host with `perf_event_open` permission.
