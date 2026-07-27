#include "cpp_patterns/arrays.hpp"
#include "cpp_patterns/dp.hpp"
#include "cpp_patterns/graphs.hpp"
#include "cpp_patterns/greedy_games.hpp"
#include "cpp_patterns/range.hpp"
#include "cpp_patterns/search.hpp"
#include "cpp_patterns/strings_math.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <random>
#include <span>
#include <string>
#include <utility>
#include <vector>

namespace {

void require(bool condition, const char* message) {
    if (!condition) {
        std::cerr << "FAIL: " << message << '\n';
        std::exit(1);
    }
}

std::int64_t direct_subarray_count(
    std::span<const int> values,
    std::int64_t target
) {
    std::int64_t answer = 0;
    for (std::size_t begin = 0; begin < values.size(); ++begin) {
        std::int64_t sum = 0;
        for (std::size_t end = begin; end < values.size(); ++end) {
            sum += values[end];
            if (sum == target) ++answer;
        }
    }
    return answer;
}

std::vector<int> direct_count_smaller(std::span<const int> values) {
    std::vector<int> answer(values.size(), 0);
    for (std::size_t i = 0; i < values.size(); ++i) {
        for (std::size_t j = i + 1; j < values.size(); ++j) {
            if (values[j] < values[i]) ++answer[i];
        }
    }
    return answer;
}

void test_arrays() {
    using namespace cpp_patterns;
    const std::vector sorted{2, 7, 11, 15};
    require(two_sum_sorted(sorted, 9) == std::pair<std::size_t, std::size_t>{0, 1},
            "two pointers");
    require(!two_sum_sorted(sorted, 8), "two pointers absence");
    require(three_sum({-1, 0, 1, 2, -1, -4}) ==
                std::vector<std::array<int, 3>>{{-1, -1, 2}, {-1, 0, 1}},
            "three sum duplicate handling");
    require(longest_unique("abba") == 2, "sliding window");
    require(subarray_sum_count(std::array{1, 1, 1}, 2) == 2, "prefix counts");
    require(first_missing_positive({3, 4, -1, 1}) == 2, "cyclic placement");
    require(merge_intervals({{1, 3}, {2, 6}, {8, 10}}) ==
                std::vector<Interval>{{1, 6}, {8, 10}},
            "interval merge");

    ListNode first{1}, second{2}, third{3};
    first.next = &second;
    second.next = &third;
    third.next = &second;
    require(cycle_start(&first) == &second, "Floyd cycle start");
    third.next = nullptr;
    require(cycle_start(&first) == nullptr, "acyclic list");

    const std::vector<std::string> words{"eat", "tea", "tan", "ate", "nat", "bat"};
    require(group_anagrams(words).size() == 3, "anagram grouping");
}

void test_graphs() {
    using namespace cpp_patterns;
    TreeNode left{2}, right{3}, root{1, &left, &right};
    require(max_depth(&root) == 2, "tree depth");
    require(count_islands({"110", "010", "001"}) == 2, "island DFS");

    const std::vector<std::vector<int>> graph{{1, 2}, {3}, {3}, {}};
    require(shortest_unweighted(graph, 0, 3) == 2, "BFS shortest path");
    const std::vector<std::pair<int, int>> dag_edges{{0, 1}, {0, 2}, {1, 3}, {2, 3}};
    const auto order = topological_order(4, dag_edges);
    require(order && order->front() == 0 && order->back() == 3, "topological order");
    const std::vector<std::pair<int, int>> cycle{{0, 1}, {1, 0}};
    require(!topological_order(2, cycle), "topological cycle");

    DisjointSet sets(4);
    require(sets.unite(0, 1) && sets.unite(2, 3) && sets.unite(1, 2),
            "disjoint set unions");
    require(sets.find(0) == sets.find(3) && !sets.unite(0, 3),
            "disjoint set connectivity");

    const std::vector<std::vector<WeightedEdge>> weighted{
        {{1, 4}, {2, 1}}, {{3, 1}}, {{1, 2}, {3, 5}}, {}
    };
    require(dijkstra(weighted, 0)[3] == 4, "Dijkstra stale-entry handling");
    const std::vector<DirectedEdge> directed{
        {0, 1, 4}, {0, 2, 5}, {1, 2, -2}, {2, 3, 3}
    };
    const auto bellman = bellman_ford(4, directed, 0);
    require(bellman && (*bellman)[3] == 5, "Bellman-Ford negative edge");
    const std::vector<DirectedEdge> negative_cycle{
        {0, 1, 1}, {1, 2, -2}, {2, 1, -2}
    };
    require(!bellman_ford(3, negative_cycle, 0),
            "Bellman-Ford negative cycle");

    constexpr auto inf = std::numeric_limits<std::int64_t>::max() / 4;
    const auto all_pairs = floyd_warshall({
        {0, 3, inf}, {inf, 0, 2}, {1, inf, 0}
    });
    require(all_pairs[0][2] == 5 && all_pairs[2][1] == 4,
            "Floyd-Warshall all pairs");
    require(kruskal(4, {{1, 0, 1}, {2, 1, 2}, {3, 2, 3}, {10, 0, 3}}) == 6,
            "Kruskal MST");

    BridgeFinder bridges(4);
    bridges.add_edge(0, 1);
    bridges.add_edge(1, 2);
    bridges.add_edge(2, 0);
    bridges.add_edge(2, 3);
    require(bridges.find() == std::vector<int>{3}, "bridge low-link");
}

void test_search() {
    using namespace cpp_patterns;
    const std::vector values{1, 2, 2, 4};
    require(lower_bound_index(values, 2) == 1, "lower bound");
    require(lower_bound_index(values, 5) == values.size(), "lower bound end");
    require(ship_within_days(std::array{1, 2, 3, 1, 1}, 4) == 3,
            "binary search on answer");
    require(top_k_largest(std::array{3, 2, 1, 5, 6, 4}, 2) ==
                std::vector<int>{5, 6},
            "top-k heap");
    require(kth_smallest({7, 2, 5, 3, 1}, 2) == 3, "quickselect rank");

    RunningMedian median;
    median.push(1);
    median.push(2);
    require(median.median() == 1.5, "even running median");
    median.push(8);
    require(median.median() == 2.0, "odd running median");
    require(daily_temperatures(std::array{73, 74, 75, 71, 69, 72, 76, 73}) ==
                std::vector<int>({1, 1, 4, 2, 1, 1, 0, 0}),
            "monotonic stack");
    require(sliding_window_max(std::array{1, 3, -1, -3, 5, 3, 6, 7}, 3) ==
                std::vector<int>({3, 3, 5, 5, 6, 7}),
            "monotonic deque");

    LowercaseTrie trie;
    trie.insert("apple");
    require(trie.contains("apple") && !trie.contains("app") &&
                trie.has_prefix("app"),
            "array-backed trie");
}

void test_dp() {
    using namespace cpp_patterns;
    require(permutations(std::array{1, 2, 3}).size() == 6, "permutations");
    require(subsets(std::array{1, 2, 3}).size() == 8, "subsets");
    require(house_robber(std::array{2, 7, 9, 3, 1}) == 12, "linear DP");
    require(coin_change(std::array{1, 2, 5}, 11) == 3, "unbounded knapsack");
    require(coin_change(std::array{2}, 3) == -1, "unreachable coin change");
    require(can_partition_equal(std::array{1, 5, 11, 5}), "zero-one knapsack");
    require(longest_common_subsequence("abcde", "ace") == 3, "LCS");
    require(edit_distance("horse", "ros") == 3, "edit distance");
    require(lis_length(std::array{10, 9, 2, 5, 3, 7, 101, 18}) == 4,
            "LIS tails");
    require(burst_balloons(std::array{3, 1, 5, 8}) == 167, "interval DP");
    require(minimum_assignment_cost({{9, 2, 7}, {6, 4, 3}, {5, 8, 1}}) == 9,
            "assignment bitmask DP");
}

void test_ranges() {
    using namespace cpp_patterns;
    Fenwick bit(6);
    for (std::size_t i = 0; i < 6; ++i) bit.add(i, static_cast<std::int64_t>(i + 1));
    require(bit.prefix(3) == 6 && bit.range(2, 5) == 12, "Fenwick sums");
    require(bit.lower_bound(7) == 3, "Fenwick order statistic");
    require(count_smaller_after(std::array{5, 2, 6, 1}) ==
                std::vector<int>({2, 1, 1, 0}),
            "coordinate compression and Fenwick");

    const std::array<std::int64_t, 5> sums{2, 1, 3, 4, 5};
    SumSegmentTree segment(sums);
    require(segment.query(1, 4) == 8, "iterative segment query");
    segment.set(2, 10);
    require(segment.query(1, 4) == 15, "iterative segment update");

    LazyRangeSum lazy(5);
    lazy.add(1, 4, 3);
    lazy.add(2, 5, 2);
    require(lazy.query(0, 5) == 15 && lazy.query(2, 3) == 5,
            "lazy range add and range sum");
    SparseMinimum sparse{std::array{7, 2, 3, 0, 5, 10, 3, 12, 18}};
    require(sparse.query(0, 4) == 0 && sparse.query(4, 7) == 3,
            "sparse table");
}

void test_strings_math() {
    using namespace cpp_patterns;
    require(prefix_function("ababaca") == std::vector<std::size_t>({0, 0, 1, 2, 3, 0, 1}),
            "KMP prefix function");
    require(find_all_kmp("aba", "ababa") == std::vector<std::size_t>({0, 2}),
            "KMP search");
    require(z_function("aaaaa") == std::vector<std::size_t>({5, 4, 3, 2, 1}),
            "Z function");
    DoubleRollingHash hash("abcabc");
    require(hash.slice(0, 3) == hash.slice(3, 6), "double rolling hash");
    const std::string palindrome = longest_palindrome("babad");
    require(palindrome == "bab" || palindrome == "aba", "Manacher");
    require(longest_palindrome("cbbd") == "bb", "Manacher even center");
    require(longest_palindrome("^#$$#^") == "^#$$#^",
            "Manacher arbitrary characters");
    require(longest_palindrome("").empty(), "Manacher empty input");
    require(modular_power(2, 10, 1'000'000'007) == 1024, "modular power");
    CombinationsModPrime combinations(10, 1'000'000'007);
    require(combinations.choose(10, 3) == 120, "combinations modulo prime");
    require(smallest_prime_factors(10)[10] == 2, "smallest prime factor sieve");
    require(single_number(std::array{4, 1, 2, 1, 2}) == 4, "XOR single number");
}

void test_greedy_games() {
    using namespace cpp_patterns;
    require(erase_overlapping({{1, 2}, {2, 3}, {3, 4}, {1, 3}}) == 1,
            "interval scheduling");
    require(schedule_course_count({{100, 200}, {200, 1300}, {1000, 1250}, {2000, 3200}}) == 3,
            "deadline scheduling with regret heap");
    require(largest_concatenated_number(std::array{3, 30, 34, 5, 9}) == "9534330",
            "concatenation comparator");
    require(inversion_count({2, 4, 1, 3, 5}) == 3, "merge-count inversions");
    require(minimum_arbitrary_swaps(std::array{4, 3, 1, 2}) == 3,
            "permutation cycles");
    require(nim_first_player_wins(std::array{1, 2, 4}), "Nim xor");
    require(!nim_first_player_wins(std::array{1, 2, 3}), "Nim losing state");
    require(subtraction_grundy(5, std::array{1, 2, 3}) ==
                std::vector<int>({0, 1, 2, 3, 0, 1}),
            "Sprague-Grundy mex");
}

void randomized_differential_tests() {
    using namespace cpp_patterns;
    std::mt19937 generator(0xC0FFEEU);
    std::uniform_int_distribution<int> length_distribution(0, 18);
    std::uniform_int_distribution<int> value_distribution(-8, 8);
    std::uniform_int_distribution<int> target_distribution(-12, 12);

    for (int trial = 0; trial < 2'000; ++trial) {
        const int length = length_distribution(generator);
        std::vector<int> values(static_cast<std::size_t>(length));
        for (int& value : values) value = value_distribution(generator);
        const int target = target_distribution(generator);
        require(
            subarray_sum_count(values, target) ==
                direct_subarray_count(values, target),
            "randomized prefix-count differential"
        );
        require(
            count_smaller_after(values) == direct_count_smaller(values),
            "randomized Fenwick differential"
        );
    }
}

}  // namespace

int main() {
    test_arrays();
    test_graphs();
    test_search();
    test_dp();
    test_ranges();
    test_strings_math();
    test_greedy_games();
    randomized_differential_tests();
    std::cout << "cpp_patterns_test: all fixed cases and 4,000 differential checks passed\n";
}
