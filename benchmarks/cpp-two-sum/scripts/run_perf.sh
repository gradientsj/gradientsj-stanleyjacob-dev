#!/usr/bin/env bash
set -euo pipefail

benchmark_binary=${1:-build/two_sum_benchmark}
output_dir=${2:-results/perf}
repetitions=${PERF_REPETITIONS:-7}
input_size=${PERF_INPUT_SIZE:-4096}

mkdir -p "$output_dir"

events=(
  task-clock
  cycles
  instructions
  branches
  branch-misses
  cache-references
  cache-misses
)

for implementation in scan hash; do
  output_file="$output_dir/${implementation}-${input_size}.txt"
  perf stat \
    --repeat "$repetitions" \
    --event "$(IFS=,; echo "${events[*]}")" \
    --output "$output_file" \
    "$benchmark_binary" \
      --benchmark_filter="^${implementation}_last_pair/${input_size}$" \
      --benchmark_min_time=1s \
      --benchmark_repetitions=1
  printf 'wrote %s\n' "$output_file"
done
