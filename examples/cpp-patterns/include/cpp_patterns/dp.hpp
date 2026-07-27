#pragma once

#include <algorithm>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <vector>

namespace cpp_patterns {

inline std::vector<std::vector<int>> permutations(std::span<const int> values) {
    std::vector<std::vector<int>> answer;
    std::vector<int> path;
    std::vector<bool> used(values.size(), false);

    const auto search = [&](const auto& self) -> void {
        if (path.size() == values.size()) {
            answer.push_back(path);
            return;
        }
        for (std::size_t index = 0; index < values.size(); ++index) {
            if (used[index]) continue;
            used[index] = true;
            path.push_back(values[index]);
            self(self);
            path.pop_back();
            used[index] = false;
        }
    };
    search(search);
    return answer;
}

inline std::vector<std::vector<int>> subsets(std::span<const int> values) {
    std::vector<std::vector<int>> answer;
    std::vector<int> path;

    const auto search = [&](const auto& self, std::size_t next) -> void {
        answer.push_back(path);
        for (std::size_t index = next; index < values.size(); ++index) {
            path.push_back(values[index]);
            self(self, index + 1);
            path.pop_back();
        }
    };
    search(search, 0);
    return answer;
}

inline int house_robber(std::span<const int> values) {
    int two_back = 0;
    int one_back = 0;
    for (const int value : values) {
        const int current = std::max(one_back, two_back + value);
        two_back = one_back;
        one_back = current;
    }
    return one_back;
}

inline int coin_change(std::span<const int> coins, int amount) {
    const int unreachable = amount + 1;
    std::vector<int> best(static_cast<std::size_t>(amount + 1), unreachable);
    best[0] = 0;

    for (int total = 1; total <= amount; ++total) {
        for (const int coin : coins) {
            if (coin <= total) {
                best[static_cast<std::size_t>(total)] = std::min(
                    best[static_cast<std::size_t>(total)],
                    best[static_cast<std::size_t>(total - coin)] + 1
                );
            }
        }
    }
    const int answer = best[static_cast<std::size_t>(amount)];
    return answer == unreachable ? -1 : answer;
}

inline bool can_partition_equal(std::span<const int> values) {
    int total = 0;
    for (const int value : values) total += value;
    if (total % 2 != 0) return false;

    const int target = total / 2;
    std::vector<bool> reachable(static_cast<std::size_t>(target + 1), false);
    reachable[0] = true;
    for (const int value : values) {
        for (int sum = target; sum >= value; --sum) {
            reachable[static_cast<std::size_t>(sum)] =
                reachable[static_cast<std::size_t>(sum)] ||
                reachable[static_cast<std::size_t>(sum - value)];
        }
    }
    return reachable[static_cast<std::size_t>(target)];
}

inline int longest_common_subsequence(std::string_view left, std::string_view right) {
    std::vector<int> previous(right.size() + 1, 0);
    std::vector<int> current(right.size() + 1, 0);

    for (const char left_character : left) {
        for (std::size_t column = 1; column <= right.size(); ++column) {
            if (left_character == right[column - 1]) {
                current[column] = previous[column - 1] + 1;
            } else {
                current[column] = std::max(previous[column], current[column - 1]);
            }
        }
        std::swap(previous, current);
        std::fill(current.begin(), current.end(), 0);
    }
    return previous.back();
}

inline int edit_distance(std::string_view source, std::string_view target) {
    std::vector<int> previous(target.size() + 1);
    for (std::size_t column = 0; column <= target.size(); ++column) {
        previous[column] = static_cast<int>(column);
    }

    for (std::size_t row = 1; row <= source.size(); ++row) {
        std::vector<int> current(target.size() + 1);
        current[0] = static_cast<int>(row);
        for (std::size_t column = 1; column <= target.size(); ++column) {
            const int replacement =
                previous[column - 1] +
                (source[row - 1] == target[column - 1] ? 0 : 1);
            current[column] = std::min({
                previous[column] + 1,
                current[column - 1] + 1,
                replacement,
            });
        }
        previous = std::move(current);
    }
    return previous.back();
}

inline int lis_length(std::span<const int> values) {
    std::vector<int> tails;
    for (const int value : values) {
        const auto position =
            std::lower_bound(tails.begin(), tails.end(), value);
        if (position == tails.end()) {
            tails.push_back(value);
        } else {
            *position = value;
        }
    }
    return static_cast<int>(tails.size());
}

inline int burst_balloons(std::span<const int> values) {
    std::vector<int> padded{1};
    padded.insert(padded.end(), values.begin(), values.end());
    padded.push_back(1);
    const std::size_t size = padded.size();
    std::vector<std::vector<int>> best(size, std::vector<int>(size, 0));

    for (std::size_t width = 2; width < size; ++width) {
        for (std::size_t left = 0; left + width < size; ++left) {
            const std::size_t right = left + width;
            for (std::size_t last = left + 1; last < right; ++last) {
                best[left][right] = std::max(
                    best[left][right],
                    best[left][last] + best[last][right] +
                        padded[left] * padded[last] * padded[right]
                );
            }
        }
    }
    return best[0][size - 1];
}

inline std::int64_t minimum_assignment_cost(
    const std::vector<std::vector<int>>& cost
) {
    const std::size_t size = cost.size();
    if (size >= std::numeric_limits<std::size_t>::digits) {
        throw std::length_error("too many assignment states");
    }
    const std::size_t state_count = std::size_t{1} << size;
    constexpr std::int64_t infinity =
        std::numeric_limits<std::int64_t>::max() / 4;
    std::vector<std::int64_t> best(state_count, infinity);
    best[0] = 0;

    for (std::size_t mask = 0; mask < state_count; ++mask) {
        const std::size_t worker = std::popcount(mask);
        if (worker == size) continue;
        for (std::size_t job = 0; job < size; ++job) {
            const std::size_t job_bit = std::size_t{1} << job;
            if ((mask & job_bit) != 0) continue;
            const std::size_t next = mask | job_bit;
            best[next] = std::min(
                best[next],
                best[mask] + cost[worker][job]
            );
        }
    }
    return best.back();
}

}  // namespace cpp_patterns
