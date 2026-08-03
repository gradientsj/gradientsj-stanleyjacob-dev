#include "two_sum.hpp"

#include <algorithm>
#include <array>
#include <cstdint>
#include <iostream>
#include <limits>
#include <random>
#include <stdexcept>
#include <span>
#include <vector>

namespace {

using cpp_measurement::Result;

void require(bool condition, const char* message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

bool valid_result(std::span<const int> values, int target,
                  const Result& result) {
  if (!result) {
    return false;
  }
  const auto [left, right] = *result;
  if (left >= values.size() || right >= values.size() || left == right) {
    return false;
  }
  const auto sum = static_cast<std::int64_t>(values[left]) +
                   static_cast<std::int64_t>(values[right]);
  return sum == static_cast<std::int64_t>(target);
}

void compare_implementations(std::span<const int> values, int target) {
  const auto scan = cpp_measurement::two_sum_scan(values, target);
  const auto hash = cpp_measurement::two_sum_hash(values, target);

  require(scan.has_value() == hash.has_value(),
          "implementations disagree about result presence");
  if (scan) {
    require(valid_result(values, target, scan), "scan returned invalid indices");
    require(valid_result(values, target, hash), "hash returned invalid indices");
  }
}

void fixed_cases() {
  compare_implementations(std::array{2, 7, 11, 15}, 9);
  compare_implementations(std::array{3, 3}, 6);
  compare_implementations(std::array{-8, 1, 4, 12}, 4);
  compare_implementations(std::array{1, 2, 3}, 100);
  compare_implementations(std::array<int, 0>{}, 0);
  compare_implementations(
      std::array{std::numeric_limits<int>::min(),
                 std::numeric_limits<int>::max(), 0, -1},
      -1);
}

void randomized_differential_cases() {
  std::mt19937 generator(0xC0FFEEU);
  std::uniform_int_distribution<int> size_distribution(0, 80);
  std::uniform_int_distribution<int> value_distribution(-250, 250);
  std::uniform_int_distribution<int> target_distribution(-500, 500);

  for (int trial = 0; trial < 5'000; ++trial) {
    const auto size = static_cast<std::size_t>(size_distribution(generator));
    std::vector<int> values(size);
    std::generate(values.begin(), values.end(),
                  [&] { return value_distribution(generator); });
    compare_implementations(values, target_distribution(generator));
  }
}

}  // namespace

int main() {
  fixed_cases();
  randomized_differential_cases();
  std::cout << "two_sum_test: 5,006 differential cases passed\n";
}
