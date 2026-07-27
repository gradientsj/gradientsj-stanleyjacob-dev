#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <deque>
#include <functional>
#include <queue>
#include <span>
#include <stdexcept>
#include <string_view>
#include <vector>

namespace cpp_patterns {

inline std::size_t lower_bound_index(
    std::span<const int> values,
    int target
) {
    std::size_t low = 0;
    std::size_t high = values.size();
    while (low < high) {
        const std::size_t middle = low + (high - low) / 2;
        if (values[middle] < target) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
}

inline int ship_within_days(std::span<const int> weights, int days) {
    int low = *std::max_element(weights.begin(), weights.end());
    int high = 0;
    for (const int weight : weights) high += weight;

    const auto feasible = [&](int capacity) {
        int used_days = 1;
        int load = 0;
        for (const int weight : weights) {
            if (load + weight > capacity) {
                ++used_days;
                load = 0;
            }
            load += weight;
        }
        return used_days <= days;
    };

    while (low < high) {
        const int middle = low + (high - low) / 2;
        if (feasible(middle)) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    return low;
}

inline std::vector<int> top_k_largest(
    std::span<const int> values,
    std::size_t count
) {
    std::priority_queue<int, std::vector<int>, std::greater<>> keep;
    for (const int value : values) {
        keep.push(value);
        if (keep.size() > count) keep.pop();
    }

    std::vector<int> answer;
    while (!keep.empty()) {
        answer.push_back(keep.top());
        keep.pop();
    }
    return answer;
}

inline int kth_smallest(std::vector<int> values, std::size_t rank) {
    if (rank >= values.size()) throw std::out_of_range("rank");
    std::size_t left = 0;
    std::size_t right = values.size();

    while (true) {
        const int pivot = values[right - 1];
        std::size_t boundary = left;
        for (std::size_t index = left; index + 1 < right; ++index) {
            if (values[index] < pivot) {
                std::swap(values[index], values[boundary]);
                ++boundary;
            }
        }
        std::swap(values[boundary], values[right - 1]);
        if (boundary == rank) return values[boundary];
        if (rank < boundary) {
            right = boundary;
        } else {
            left = boundary + 1;
        }
    }
}

class RunningMedian {
public:
    void push(int value) {
        if (lower_.empty() || value <= lower_.top()) {
            lower_.push(value);
        } else {
            upper_.push(value);
        }
        rebalance();
    }

    double median() const {
        if (lower_.empty()) throw std::logic_error("median of empty stream");
        if (lower_.size() == upper_.size()) {
            return (static_cast<double>(lower_.top()) + upper_.top()) / 2.0;
        }
        return lower_.top();
    }

private:
    void rebalance() {
        if (lower_.size() > upper_.size() + 1) {
            upper_.push(lower_.top());
            lower_.pop();
        } else if (upper_.size() > lower_.size()) {
            lower_.push(upper_.top());
            upper_.pop();
        }
    }

    std::priority_queue<int> lower_;
    std::priority_queue<int, std::vector<int>, std::greater<>> upper_;
};

inline std::vector<int> daily_temperatures(std::span<const int> temperatures) {
    std::vector<int> wait(temperatures.size(), 0);
    std::vector<std::size_t> decreasing;

    for (std::size_t day = 0; day < temperatures.size(); ++day) {
        while (!decreasing.empty() &&
               temperatures[decreasing.back()] < temperatures[day]) {
            const std::size_t previous = decreasing.back();
            decreasing.pop_back();
            wait[previous] = static_cast<int>(day - previous);
        }
        decreasing.push_back(day);
    }
    return wait;
}

inline std::vector<int> sliding_window_max(
    std::span<const int> values,
    std::size_t width
) {
    if (width == 0 || width > values.size()) return {};
    std::deque<std::size_t> candidates;
    std::vector<int> answer;

    for (std::size_t right = 0; right < values.size(); ++right) {
        while (!candidates.empty() &&
               candidates.front() + width <= right) {
            candidates.pop_front();
        }
        while (!candidates.empty() &&
               values[candidates.back()] <= values[right]) {
            candidates.pop_back();
        }
        candidates.push_back(right);
        if (right + 1 >= width) answer.push_back(values[candidates.front()]);
    }
    return answer;
}

class LowercaseTrie {
public:
    LowercaseTrie() : nodes_(1) {}

    void insert(std::string_view word) {
        std::size_t node = 0;
        for (const char character : word) {
            const std::size_t letter =
                static_cast<std::size_t>(character - 'a');
            int child = nodes_[node].children[letter];
            if (child == -1) {
                child = static_cast<int>(nodes_.size());
                nodes_[node].children[letter] = child;
                nodes_.push_back({});
            }
            node = static_cast<std::size_t>(child);
        }
        nodes_[node].terminal = true;
    }

    bool contains(std::string_view word) const {
        const auto node = walk(word);
        return node != -1 && nodes_[static_cast<std::size_t>(node)].terminal;
    }

    bool has_prefix(std::string_view prefix) const {
        return walk(prefix) != -1;
    }

private:
    struct Node {
        std::array<int, 26> children = [] {
            std::array<int, 26> value{};
            value.fill(-1);
            return value;
        }();
        bool terminal = false;
    };

    int walk(std::string_view text) const {
        std::size_t node = 0;
        for (const char character : text) {
            const auto letter = static_cast<std::size_t>(character - 'a');
            const int child = nodes_[node].children[letter];
            if (child == -1) return -1;
            node = static_cast<std::size_t>(child);
        }
        return static_cast<int>(node);
    }

    std::vector<Node> nodes_;
};

}  // namespace cpp_patterns
