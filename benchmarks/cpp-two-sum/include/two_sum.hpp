#pragma once

#include <cstddef>
#include <cstdint>
#include <limits>
#include <optional>
#include <span>
#include <unordered_map>
#include <utility>

namespace cpp_measurement {

using IndexPair = std::pair<std::size_t, std::size_t>;
using Result = std::optional<IndexPair>;

inline Result two_sum_scan(std::span<const int> values, int target) {
  const auto wide_target = static_cast<std::int64_t>(target);
  for (std::size_t left = 0; left < values.size(); ++left) {
    for (std::size_t right = left + 1; right < values.size(); ++right) {
      const auto sum = static_cast<std::int64_t>(values[left]) +
                       static_cast<std::int64_t>(values[right]);
      if (sum == wide_target) {
        return IndexPair{left, right};
      }
    }
  }
  return std::nullopt;
}

inline Result two_sum_hash(std::span<const int> values, int target) {
  std::unordered_map<int, std::size_t> first_index;
  first_index.reserve(values.size());
  first_index.max_load_factor(0.75F);

  const auto wide_target = static_cast<std::int64_t>(target);
  for (std::size_t index = 0; index < values.size(); ++index) {
    const auto complement =
        wide_target - static_cast<std::int64_t>(values[index]);

    if (complement >= std::numeric_limits<int>::min() &&
        complement <= std::numeric_limits<int>::max()) {
      const auto found = first_index.find(static_cast<int>(complement));
      if (found != first_index.end()) {
        return IndexPair{found->second, index};
      }
    }

    first_index.try_emplace(values[index], index);
  }
  return std::nullopt;
}

}  // namespace cpp_measurement
