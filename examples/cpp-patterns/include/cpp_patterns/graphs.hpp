#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <limits>
#include <numeric>
#include <optional>
#include <queue>
#include <span>
#include <string>
#include <tuple>
#include <utility>
#include <vector>

namespace cpp_patterns {

struct TreeNode {
    int value{};
    TreeNode* left{};
    TreeNode* right{};
};

inline int max_depth(const TreeNode* node) {
    if (node == nullptr) return 0;
    return 1 + std::max(max_depth(node->left), max_depth(node->right));
}

inline int count_islands(std::vector<std::string> grid) {
    if (grid.empty()) return 0;
    const int rows = static_cast<int>(grid.size());
    const int columns = static_cast<int>(grid.front().size());
    int islands = 0;

    const auto sink = [&](const auto& self, int row, int column) -> void {
        if (row < 0 || row >= rows || column < 0 || column >= columns ||
            grid[static_cast<std::size_t>(row)]
                [static_cast<std::size_t>(column)] != '1') {
            return;
        }
        grid[static_cast<std::size_t>(row)]
            [static_cast<std::size_t>(column)] = '0';
        self(self, row + 1, column);
        self(self, row - 1, column);
        self(self, row, column + 1);
        self(self, row, column - 1);
    };

    for (int row = 0; row < rows; ++row) {
        for (int column = 0; column < columns; ++column) {
            if (grid[static_cast<std::size_t>(row)]
                    [static_cast<std::size_t>(column)] == '1') {
                ++islands;
                sink(sink, row, column);
            }
        }
    }
    return islands;
}

inline int shortest_unweighted(
    std::span<const std::vector<int>> graph,
    int start,
    int goal
) {
    if (start < 0 || goal < 0 ||
        static_cast<std::size_t>(start) >= graph.size() ||
        static_cast<std::size_t>(goal) >= graph.size()) {
        return -1;
    }

    std::queue<int> frontier;
    std::vector<int> distance(graph.size(), -1);
    frontier.push(start);
    distance[static_cast<std::size_t>(start)] = 0;

    while (!frontier.empty()) {
        const int node = frontier.front();
        frontier.pop();
        if (node == goal) return distance[static_cast<std::size_t>(node)];

        for (const int next : graph[static_cast<std::size_t>(node)]) {
            auto& next_distance = distance[static_cast<std::size_t>(next)];
            if (next_distance != -1) continue;
            next_distance = distance[static_cast<std::size_t>(node)] + 1;
            frontier.push(next);
        }
    }
    return -1;
}

inline std::optional<std::vector<int>> topological_order(
    std::size_t vertex_count,
    std::span<const std::pair<int, int>> edges
) {
    std::vector<std::vector<int>> graph(vertex_count);
    std::vector<int> indegree(vertex_count, 0);
    for (const auto& [before, after] : edges) {
        graph[static_cast<std::size_t>(before)].push_back(after);
        ++indegree[static_cast<std::size_t>(after)];
    }

    std::queue<int> ready;
    for (std::size_t vertex = 0; vertex < vertex_count; ++vertex) {
        if (indegree[vertex] == 0) ready.push(static_cast<int>(vertex));
    }

    std::vector<int> order;
    while (!ready.empty()) {
        const int node = ready.front();
        ready.pop();
        order.push_back(node);
        for (const int next : graph[static_cast<std::size_t>(node)]) {
            auto& degree = indegree[static_cast<std::size_t>(next)];
            --degree;
            if (degree == 0) ready.push(next);
        }
    }

    if (order.size() != vertex_count) return std::nullopt;
    return order;
}

class DisjointSet {
public:
    explicit DisjointSet(std::size_t size)
        : parent_(size), component_size_(size, 1) {
        std::iota(parent_.begin(), parent_.end(), std::size_t{0});
    }

    std::size_t find(std::size_t node) {
        while (node != parent_[node]) {
            parent_[node] = parent_[parent_[node]];
            node = parent_[node];
        }
        return node;
    }

    bool unite(std::size_t left, std::size_t right) {
        left = find(left);
        right = find(right);
        if (left == right) return false;
        if (component_size_[left] < component_size_[right]) {
            std::swap(left, right);
        }
        parent_[right] = left;
        component_size_[left] += component_size_[right];
        return true;
    }

private:
    std::vector<std::size_t> parent_;
    std::vector<std::size_t> component_size_;
};

using WeightedEdge = std::pair<int, int>;

inline std::vector<std::int64_t> dijkstra(
    std::span<const std::vector<WeightedEdge>> graph,
    int source
) {
    constexpr std::int64_t infinity =
        std::numeric_limits<std::int64_t>::max();
    using QueueEntry = std::pair<std::int64_t, int>;

    std::vector<std::int64_t> distance(graph.size(), infinity);
    std::priority_queue<
        QueueEntry,
        std::vector<QueueEntry>,
        std::greater<>
    > frontier;
    distance[static_cast<std::size_t>(source)] = 0;
    frontier.push({0, source});

    while (!frontier.empty()) {
        const auto [known_distance, node] = frontier.top();
        frontier.pop();
        if (known_distance != distance[static_cast<std::size_t>(node)]) {
            continue;
        }

        for (const auto& [next, weight] :
             graph[static_cast<std::size_t>(node)]) {
            const auto candidate = known_distance + weight;
            auto& best = distance[static_cast<std::size_t>(next)];
            if (candidate < best) {
                best = candidate;
                frontier.push({candidate, next});
            }
        }
    }
    return distance;
}

struct MstEdge {
    int weight;
    std::size_t from;
    std::size_t to;
};

struct DirectedEdge {
    int from;
    int to;
    int weight;
};

inline std::optional<std::vector<std::int64_t>> bellman_ford(
    std::size_t vertex_count,
    std::span<const DirectedEdge> edges,
    int source
) {
    constexpr std::int64_t infinity =
        std::numeric_limits<std::int64_t>::max() / 4;
    std::vector<std::int64_t> distance(vertex_count, infinity);
    distance[static_cast<std::size_t>(source)] = 0;

    for (std::size_t pass = 1; pass < vertex_count; ++pass) {
        bool changed = false;
        for (const auto& edge : edges) {
            const auto from = static_cast<std::size_t>(edge.from);
            const auto to = static_cast<std::size_t>(edge.to);
            if (distance[from] != infinity &&
                distance[from] + edge.weight < distance[to]) {
                distance[to] = distance[from] + edge.weight;
                changed = true;
            }
        }
        if (!changed) break;
    }

    for (const auto& edge : edges) {
        const auto from = static_cast<std::size_t>(edge.from);
        const auto to = static_cast<std::size_t>(edge.to);
        if (distance[from] != infinity &&
            distance[from] + edge.weight < distance[to]) {
            return std::nullopt;
        }
    }
    return distance;
}

inline std::vector<std::vector<std::int64_t>> floyd_warshall(
    std::vector<std::vector<std::int64_t>> distance
) {
    constexpr std::int64_t infinity =
        std::numeric_limits<std::int64_t>::max() / 4;
    const std::size_t size = distance.size();
    for (std::size_t through = 0; through < size; ++through) {
        for (std::size_t from = 0; from < size; ++from) {
            if (distance[from][through] == infinity) continue;
            for (std::size_t to = 0; to < size; ++to) {
                if (distance[through][to] == infinity) continue;
                distance[from][to] = std::min(
                    distance[from][to],
                    distance[from][through] + distance[through][to]
                );
            }
        }
    }
    return distance;
}

inline std::optional<std::int64_t> kruskal(
    std::size_t vertex_count,
    std::vector<MstEdge> edges
) {
    std::sort(edges.begin(), edges.end(), [](const auto& left, const auto& right) {
        return left.weight < right.weight;
    });

    DisjointSet components(vertex_count);
    std::size_t used = 0;
    std::int64_t total = 0;
    for (const auto edge : edges) {
        if (!components.unite(edge.from, edge.to)) continue;
        total += edge.weight;
        ++used;
        if (used + 1 == vertex_count) break;
    }
    if (vertex_count > 0 && used + 1 != vertex_count) return std::nullopt;
    return total;
}

class BridgeFinder {
public:
    explicit BridgeFinder(std::size_t vertex_count)
        : graph_(vertex_count), entered_(vertex_count, -1),
          low_(vertex_count, -1) {}

    void add_edge(int left, int right) {
        const int edge_id = edge_count_++;
        graph_[static_cast<std::size_t>(left)].push_back({right, edge_id});
        graph_[static_cast<std::size_t>(right)].push_back({left, edge_id});
    }

    std::vector<int> find() {
        for (std::size_t vertex = 0; vertex < graph_.size(); ++vertex) {
            if (entered_[vertex] == -1) dfs(static_cast<int>(vertex), -1);
        }
        std::sort(bridges_.begin(), bridges_.end());
        return bridges_;
    }

private:
    void dfs(int node, int parent_edge) {
        const auto index = static_cast<std::size_t>(node);
        entered_[index] = low_[index] = timer_++;
        for (const auto& [next, edge_id] : graph_[index]) {
            if (edge_id == parent_edge) continue;
            const auto next_index = static_cast<std::size_t>(next);
            if (entered_[next_index] != -1) {
                low_[index] = std::min(low_[index], entered_[next_index]);
                continue;
            }
            dfs(next, edge_id);
            low_[index] = std::min(low_[index], low_[next_index]);
            if (low_[next_index] > entered_[index]) bridges_.push_back(edge_id);
        }
    }

    std::vector<std::vector<std::pair<int, int>>> graph_;
    std::vector<int> entered_;
    std::vector<int> low_;
    std::vector<int> bridges_;
    int edge_count_ = 0;
    int timer_ = 0;
};

}  // namespace cpp_patterns
