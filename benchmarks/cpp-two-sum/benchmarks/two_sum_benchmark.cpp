#include "two_sum.hpp"

#include <benchmark/benchmark.h>

#include <cstddef>
#include <cstdint>
#include <limits>
#include <vector>

namespace {

struct Input {
  std::vector<int> values;
  int target;
};

Input make_last_pair_input(std::size_t size) {
  Input input;
  input.values.reserve(size);
  for (std::size_t index = 0; index < size; ++index) {
    input.values.push_back(static_cast<int>(index));
  }
  input.target = static_cast<int>(size * 2U - 3U);
  return input;
}

Input make_miss_input(std::size_t size) {
  Input input;
  input.values.reserve(size);
  for (std::size_t index = 0; index < size; ++index) {
    input.values.push_back(static_cast<int>(index));
  }
  input.target = -1;
  return input;
}

template <typename Solver, typename Factory>
void run(benchmark::State& state, Solver solver, Factory factory) {
  const auto size = static_cast<std::size_t>(state.range(0));
  const Input input = factory(size);
  benchmark::DoNotOptimize(input.values.data());

  for (auto _ : state) {
    auto result = solver(input.values, input.target);
    benchmark::DoNotOptimize(result);
  }

  state.SetItemsProcessed(
      static_cast<std::int64_t>(state.iterations()) * state.range(0));
  state.SetComplexityN(state.range(0));
}

void scan_last_pair(benchmark::State& state) {
  run(state, cpp_measurement::two_sum_scan, make_last_pair_input);
}

void hash_last_pair(benchmark::State& state) {
  run(state, cpp_measurement::two_sum_hash, make_last_pair_input);
}

void scan_miss(benchmark::State& state) {
  run(state, cpp_measurement::two_sum_scan, make_miss_input);
}

void hash_miss(benchmark::State& state) {
  run(state, cpp_measurement::two_sum_hash, make_miss_input);
}

constexpr int kSmallestSize = 16;
constexpr int kLargestSize = 16'384;

BENCHMARK(scan_last_pair)
    ->RangeMultiplier(4)
    ->Range(kSmallestSize, kLargestSize)
    ->Complexity(benchmark::oNSquared);
BENCHMARK(hash_last_pair)
    ->RangeMultiplier(4)
    ->Range(kSmallestSize, kLargestSize)
    ->Complexity(benchmark::oN);
BENCHMARK(scan_miss)
    ->RangeMultiplier(4)
    ->Range(kSmallestSize, kLargestSize)
    ->Complexity(benchmark::oNSquared);
BENCHMARK(hash_miss)
    ->RangeMultiplier(4)
    ->Range(kSmallestSize, kLargestSize)
    ->Complexity(benchmark::oN);

}  // namespace
