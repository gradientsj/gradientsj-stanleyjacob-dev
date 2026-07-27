#pragma once

#include <algorithm>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <vector>

namespace cpp_patterns {

class Fenwick {
public:
    explicit Fenwick(std::size_t size) : tree_(size + 1, 0) {}

    void add(std::size_t index, std::int64_t delta) {
        for (++index; index < tree_.size(); index += index & (~index + 1)) {
            tree_[index] += delta;
        }
    }

    std::int64_t prefix(std::size_t end) const {
        std::int64_t sum = 0;
        for (; end > 0; end -= end & (~end + 1)) sum += tree_[end];
        return sum;
    }

    std::int64_t range(std::size_t begin, std::size_t end) const {
        return prefix(end) - prefix(begin);
    }

    std::size_t lower_bound(std::int64_t target) const {
        std::size_t position = 0;
        const std::size_t size = tree_.size() - 1;
        std::size_t step = std::bit_floor(size);
        while (step > 0) {
            const std::size_t next = position + step;
            if (next <= size && tree_[next] < target) {
                position = next;
                target -= tree_[next];
            }
            step >>= 1;
        }
        return position;
    }

private:
    std::vector<std::int64_t> tree_;
};

inline std::vector<int> count_smaller_after(std::span<const int> values) {
    std::vector<int> sorted(values.begin(), values.end());
    std::sort(sorted.begin(), sorted.end());
    sorted.erase(std::unique(sorted.begin(), sorted.end()), sorted.end());

    Fenwick counts(sorted.size());
    std::vector<int> answer(values.size());
    for (std::size_t offset = values.size(); offset > 0; --offset) {
        const std::size_t index = offset - 1;
        const auto rank = static_cast<std::size_t>(
            std::lower_bound(sorted.begin(), sorted.end(), values[index]) -
            sorted.begin()
        );
        answer[index] = static_cast<int>(counts.prefix(rank));
        counts.add(rank, 1);
    }
    return answer;
}

class SumSegmentTree {
public:
    explicit SumSegmentTree(std::span<const std::int64_t> values)
        : size_(values.size()), tree_(2 * values.size(), 0) {
        std::copy(values.begin(), values.end(), tree_.begin() +
                  static_cast<std::ptrdiff_t>(size_));
        for (std::size_t node = size_; node-- > 1;) {
            tree_[node] = tree_[2 * node] + tree_[2 * node + 1];
        }
    }

    void set(std::size_t index, std::int64_t value) {
        index += size_;
        tree_[index] = value;
        while (index > 1) {
            index >>= 1;
            tree_[index] = tree_[2 * index] + tree_[2 * index + 1];
        }
    }

    std::int64_t query(std::size_t begin, std::size_t end) const {
        std::int64_t left_sum = 0;
        std::int64_t right_sum = 0;
        for (begin += size_, end += size_; begin < end;
             begin >>= 1, end >>= 1) {
            if ((begin & 1U) != 0U) left_sum += tree_[begin++];
            if ((end & 1U) != 0U) right_sum = tree_[--end] + right_sum;
        }
        return left_sum + right_sum;
    }

private:
    std::size_t size_;
    std::vector<std::int64_t> tree_;
};

class LazyRangeSum {
public:
    explicit LazyRangeSum(std::size_t size)
        : size_(size), tree_(4 * size, 0), lazy_(4 * size, 0) {}

    void add(std::size_t begin, std::size_t end, std::int64_t value) {
        if (begin < end) add(1, 0, size_, begin, end, value);
    }

    std::int64_t query(std::size_t begin, std::size_t end) {
        return begin < end ? query(1, 0, size_, begin, end) : 0;
    }

private:
    void apply(
        std::size_t node,
        std::size_t left,
        std::size_t right,
        std::int64_t value
    ) {
        tree_[node] += value * static_cast<std::int64_t>(right - left);
        lazy_[node] += value;
    }

    void push(std::size_t node, std::size_t left, std::size_t right) {
        if (lazy_[node] == 0 || right - left == 1) return;
        const std::size_t middle = left + (right - left) / 2;
        apply(2 * node, left, middle, lazy_[node]);
        apply(2 * node + 1, middle, right, lazy_[node]);
        lazy_[node] = 0;
    }

    void add(
        std::size_t node,
        std::size_t left,
        std::size_t right,
        std::size_t query_left,
        std::size_t query_right,
        std::int64_t value
    ) {
        if (query_right <= left || right <= query_left) return;
        if (query_left <= left && right <= query_right) {
            apply(node, left, right, value);
            return;
        }
        push(node, left, right);
        const std::size_t middle = left + (right - left) / 2;
        add(2 * node, left, middle, query_left, query_right, value);
        add(2 * node + 1, middle, right, query_left, query_right, value);
        tree_[node] = tree_[2 * node] + tree_[2 * node + 1];
    }

    std::int64_t query(
        std::size_t node,
        std::size_t left,
        std::size_t right,
        std::size_t query_left,
        std::size_t query_right
    ) {
        if (query_right <= left || right <= query_left) return 0;
        if (query_left <= left && right <= query_right) return tree_[node];
        push(node, left, right);
        const std::size_t middle = left + (right - left) / 2;
        return query(2 * node, left, middle, query_left, query_right) +
               query(2 * node + 1, middle, right, query_left, query_right);
    }

    std::size_t size_;
    std::vector<std::int64_t> tree_;
    std::vector<std::int64_t> lazy_;
};

class SparseMinimum {
public:
    explicit SparseMinimum(std::span<const int> values)
        : logarithm_(values.size() + 1, 0) {
        for (std::size_t i = 2; i < logarithm_.size(); ++i) {
            logarithm_[i] = logarithm_[i / 2] + 1;
        }
        const std::size_t levels =
            values.empty() ? 0 : static_cast<std::size_t>(logarithm_.back() + 1);
        table_.assign(levels, std::vector<int>(values.size()));
        if (values.empty()) return;
        std::copy(values.begin(), values.end(), table_[0].begin());
        for (std::size_t level = 1; level < levels; ++level) {
            const std::size_t length = std::size_t{1} << level;
            const std::size_t half = length >> 1;
            for (std::size_t start = 0; start + length <= values.size(); ++start) {
                table_[level][start] = std::min(
                    table_[level - 1][start],
                    table_[level - 1][start + half]
                );
            }
        }
    }

    int query(std::size_t begin, std::size_t end) const {
        const std::size_t length = end - begin;
        const std::size_t level =
            static_cast<std::size_t>(logarithm_[length]);
        const std::size_t block = std::size_t{1} << level;
        return std::min(table_[level][begin], table_[level][end - block]);
    }

private:
    std::vector<int> logarithm_;
    std::vector<std::vector<int>> table_;
};

}  // namespace cpp_patterns
