#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <numeric>
#include <queue>
#include <span>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace cpp_patterns {

inline int erase_overlapping(std::vector<std::pair<int, int>> intervals) {
    std::sort(intervals.begin(), intervals.end(), [](const auto& left, const auto& right) {
        return left.second < right.second;
    });
    int removed = 0;
    int previous_end = 0;
    bool have_previous = false;
    for (const auto& [start, end] : intervals) {
        if (have_previous && start < previous_end) {
            ++removed;
        } else {
            have_previous = true;
            previous_end = end;
        }
    }
    return removed;
}

inline int schedule_course_count(std::vector<std::pair<int, int>> courses) {
    std::sort(courses.begin(), courses.end(), [](const auto& left, const auto& right) {
        return left.second < right.second;
    });
    std::priority_queue<int> durations;
    int elapsed = 0;
    for (const auto& [duration, deadline] : courses) {
        elapsed += duration;
        durations.push(duration);
        if (elapsed > deadline) {
            elapsed -= durations.top();
            durations.pop();
        }
    }
    return static_cast<int>(durations.size());
}

inline std::string largest_concatenated_number(std::span<const int> values) {
    std::vector<std::string> parts;
    parts.reserve(values.size());
    for (const int value : values) parts.push_back(std::to_string(value));
    std::sort(parts.begin(), parts.end(), [](const auto& left, const auto& right) {
        return left + right > right + left;
    });
    if (parts.empty() || parts.front() == "0") return "0";
    return std::accumulate(parts.begin(), parts.end(), std::string{});
}

inline std::int64_t inversion_count(std::vector<int> values) {
    std::vector<int> scratch(values.size());
    const auto count = [&](
        const auto& self,
        std::size_t begin,
        std::size_t end
    ) -> std::int64_t {
        if (end - begin < 2) return 0;
        const std::size_t middle = begin + (end - begin) / 2;
        std::int64_t answer =
            self(self, begin, middle) + self(self, middle, end);
        std::size_t left = begin;
        std::size_t right = middle;
        std::size_t output = begin;
        while (left < middle || right < end) {
            if (right == end ||
                (left < middle && values[left] <= values[right])) {
                scratch[output++] = values[left++];
            } else {
                scratch[output++] = values[right++];
                answer += static_cast<std::int64_t>(middle - left);
            }
        }
        std::copy(
            scratch.begin() + static_cast<std::ptrdiff_t>(begin),
            scratch.begin() + static_cast<std::ptrdiff_t>(end),
            values.begin() + static_cast<std::ptrdiff_t>(begin)
        );
        return answer;
    };
    return count(count, 0, values.size());
}

inline int minimum_arbitrary_swaps(std::span<const int> distinct_values) {
    const std::size_t size = distinct_values.size();
    std::vector<std::pair<int, std::size_t>> ordered(size);
    for (std::size_t index = 0; index < size; ++index) {
        ordered[index] = {distinct_values[index], index};
    }
    std::sort(ordered.begin(), ordered.end());

    std::vector<bool> visited(size, false);
    int swaps = 0;
    for (std::size_t start = 0; start < size; ++start) {
        if (visited[start] || ordered[start].second == start) continue;
        std::size_t length = 0;
        for (std::size_t node = start; !visited[node];
             node = ordered[node].second) {
            visited[node] = true;
            ++length;
        }
        swaps += static_cast<int>(length - 1);
    }
    return swaps;
}

inline bool nim_first_player_wins(std::span<const int> piles) {
    int combined = 0;
    for (const int pile : piles) combined ^= pile;
    return combined != 0;
}

inline std::vector<int> subtraction_grundy(
    std::size_t maximum,
    std::span<const int> moves
) {
    std::vector<int> grundy(maximum + 1, 0);
    for (std::size_t state = 1; state <= maximum; ++state) {
        std::unordered_set<int> reachable;
        for (const int move : moves) {
            if (move >= 0 && static_cast<std::size_t>(move) <= state) {
                reachable.insert(grundy[state - static_cast<std::size_t>(move)]);
            }
        }
        int mex = 0;
        while (reachable.contains(mex)) ++mex;
        grundy[state] = mex;
    }
    return grundy;
}

}  // namespace cpp_patterns
