#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace cpp_patterns {

inline std::optional<std::pair<std::size_t, std::size_t>>
two_sum_sorted(std::span<const int> values, int target) {
    if (values.size() < 2) return std::nullopt;

    std::size_t left = 0;
    std::size_t right = values.size() - 1;
    while (left < right) {
        const auto sum =
            static_cast<std::int64_t>(values[left]) + values[right];
        if (sum == target) return std::pair{left, right};
        if (sum < target) {
            ++left;
        } else {
            --right;
        }
    }
    return std::nullopt;
}

inline std::vector<std::array<int, 3>> three_sum(std::vector<int> values) {
    std::sort(values.begin(), values.end());
    std::vector<std::array<int, 3>> answer;

    for (std::size_t first = 0; first + 2 < values.size(); ++first) {
        if (first > 0 && values[first] == values[first - 1]) continue;
        std::size_t left = first + 1;
        std::size_t right = values.size() - 1;

        while (left < right) {
            const auto sum = static_cast<std::int64_t>(values[first]) +
                             values[left] + values[right];
            if (sum < 0) {
                ++left;
            } else if (sum > 0) {
                --right;
            } else {
                answer.push_back({values[first], values[left], values[right]});
                const int left_value = values[left];
                const int right_value = values[right];
                while (left < right && values[left] == left_value) ++left;
                while (left < right && values[right] == right_value) --right;
            }
        }
    }
    return answer;
}

inline std::size_t longest_unique(std::string_view text) {
    std::array<std::size_t, 256> next_allowed{};
    std::size_t left = 0;
    std::size_t best = 0;

    for (std::size_t right = 0; right < text.size(); ++right) {
        const auto byte = static_cast<unsigned char>(text[right]);
        left = std::max(left, next_allowed[byte]);
        best = std::max(best, right - left + 1);
        next_allowed[byte] = right + 1;
    }
    return best;
}

inline std::int64_t subarray_sum_count(
    std::span<const int> values,
    std::int64_t target
) {
    std::unordered_map<std::int64_t, std::int64_t> frequency{{0, 1}};
    std::int64_t prefix = 0;
    std::int64_t answer = 0;

    for (const int value : values) {
        prefix += value;
        if (const auto it = frequency.find(prefix - target);
            it != frequency.end()) {
            answer += it->second;
        }
        ++frequency[prefix];
    }
    return answer;
}

inline int first_missing_positive(std::vector<int> values) {
    const std::size_t size = values.size();
    std::size_t index = 0;

    while (index < size) {
        const int value = values[index];
        const bool in_range =
            value > 0 && static_cast<std::size_t>(value) <= size;
        if (!in_range) {
            ++index;
            continue;
        }

        const std::size_t destination = static_cast<std::size_t>(value - 1);
        if (values[destination] == value) {
            ++index;
        } else {
            std::swap(values[index], values[destination]);
        }
    }

    for (std::size_t i = 0; i < size; ++i) {
        if (values[i] != static_cast<int>(i + 1)) {
            return static_cast<int>(i + 1);
        }
    }
    if (size >= static_cast<std::size_t>(std::numeric_limits<int>::max())) {
        return std::numeric_limits<int>::max();
    }
    return static_cast<int>(size + 1);
}

using Interval = std::array<int, 2>;

inline std::vector<Interval> merge_intervals(std::vector<Interval> intervals) {
    std::sort(intervals.begin(), intervals.end());
    std::vector<Interval> merged;

    for (const auto interval : intervals) {
        if (merged.empty() || interval[0] > merged.back()[1]) {
            merged.push_back(interval);
        } else {
            merged.back()[1] = std::max(merged.back()[1], interval[1]);
        }
    }
    return merged;
}

struct ListNode {
    int value{};
    ListNode* next{};
};

inline ListNode* cycle_start(ListNode* head) {
    ListNode* slow = head;
    ListNode* fast = head;

    do {
        if (fast == nullptr || fast->next == nullptr) return nullptr;
        slow = slow->next;
        fast = fast->next->next;
    } while (slow != fast);

    slow = head;
    while (slow != fast) {
        slow = slow->next;
        fast = fast->next;
    }
    return slow;
}

inline std::vector<std::vector<std::string>>
group_anagrams(std::span<const std::string> words) {
    std::unordered_map<std::string, std::vector<std::string>> groups;
    for (const auto& word : words) {
        std::string key = word;
        std::sort(key.begin(), key.end());
        groups[key].push_back(word);
    }

    std::vector<std::vector<std::string>> answer;
    answer.reserve(groups.size());
    for (auto& [key, group] : groups) {
        static_cast<void>(key);
        std::sort(group.begin(), group.end());
        answer.push_back(std::move(group));
    }
    std::sort(answer.begin(), answer.end());
    return answer;
}

}  // namespace cpp_patterns
