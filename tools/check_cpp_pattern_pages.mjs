#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const patternRoot = path.join(root, 'software/cpp/patterns')
const pages = [
  '',
  'arrays-sequences',
  'trees-graphs',
  'search-selection',
  'recursion-dp',
  'range-queries',
  'strings-math',
  'greedy-bit-games',
]

const expectedSections = new Map([
  ['arrays-sequences', ['two-pointers', 'sliding-window', 'prefix-state', 'hashing', 'cyclic-placement', 'intervals', 'fast-slow']],
  ['trees-graphs', ['dfs', 'bfs', 'topological', 'dsu', 'dijkstra', 'other-shortest-paths', 'mst', 'low-link']],
  ['search-selection', ['binary-search', 'answer-search', 'heaps', 'running-median', 'quickselect', 'monotonic-stack', 'monotonic-deque', 'trie']],
  ['recursion-dp', ['backtracking', 'dp-workflow', 'linear-dp', 'knapsack', 'sequence-dp', 'lis', 'interval-dp', 'bitmask-dp']],
  ['range-queries', ['compression', 'fenwick', 'fenwick-search', 'sweep-count', 'segment-tree', 'lazy', 'dp-accelerator', 'sparse-table']],
  ['strings-math', ['kmp', 'z-function', 'rolling-hash', 'manacher', 'bit-techniques', 'modular', 'sieve', 'combinations']],
  ['greedy-bit-games', ['greedy-proof', 'interval-scheduling', 'deadline-heap', 'sort-comparators', 'inversions', 'permutation-cycles', 'nim', 'grundy']],
])

const errors = []
let codeBlocks = 0
let chapterSections = 0

for (const slug of pages) {
  const file = path.join(patternRoot, slug, 'index.html')
  if (!fs.existsSync(file)) {
    errors.push(`missing page: ${path.relative(root, file)}`)
    continue
  }
  const html = fs.readFileSync(file, 'utf8')
  const label = slug || 'overview'
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
  const idSet = new Set(ids)
  if (ids.length !== idSet.size) errors.push(`${label}: duplicate id`)
  if (!/<link rel="canonical" href="https:\/\/www\.stanleyjacob\.dev\/software\/cpp\/patterns/.test(html)) {
    errors.push(`${label}: missing canonical URL`)
  }
  if (!/<nav class="cpp-series-nav"/.test(html)) {
    errors.push(`${label}: missing series navigation`)
  }
  const seriesLinks = (html.match(/<a href="\/software\/cpp(?:\/patterns[^"]*)?"/g) || []).length
  if (seriesLinks < 9) errors.push(`${label}: incomplete chapter navigation`)
  if (/\binterviews?\b/i.test(html)) errors.push(`${label}: contains forbidden framing`)
  if (/language-(python|javascript|typescript|rust|java)\b/.test(html)) {
    errors.push(`${label}: contains a non-C++ code block`)
  }
  for (const href of html.matchAll(/href="#([^"]+)"/g)) {
    if (!idSet.has(href[1])) errors.push(`${label}: unresolved local anchor #${href[1]}`)
  }
  codeBlocks += (html.match(/<pre\b/g) || []).length

  for (const section of expectedSections.get(slug) || []) {
    chapterSections += 1
    if (!idSet.has(section)) errors.push(`${label}: missing section #${section}`)
  }
}

const sourceMarkers = new Map([
  ['arrays.hpp', ['two_sum_sorted', 'subarray_sum_count', 'first_missing_positive', 'merge_intervals']],
  ['graphs.hpp', ['count_islands', 'topological_order', 'class DisjointSet', 'dijkstra', 'bellman_ford', 'floyd_warshall', 'kruskal']],
  ['search.hpp', ['lower_bound_index', 'ship_within_days', 'kth_smallest', 'class RunningMedian', 'sliding_window_max', 'class LowercaseTrie']],
  ['dp.hpp', ['permutations', 'coin_change', 'can_partition_equal', 'longest_common_subsequence', 'lis_length', 'burst_balloons', 'minimum_assignment_cost']],
  ['range.hpp', ['class Fenwick', 'count_smaller_after', 'class SumSegmentTree', 'class LazyRangeSum', 'class SparseMinimum']],
  ['strings_math.hpp', ['prefix_function', 'z_function', 'class DoubleRollingHash', 'longest_palindrome', 'modular_power', 'class CombinationsModPrime']],
  ['greedy_games.hpp', ['erase_overlapping', 'schedule_course_count', 'inversion_count', 'nim_first_player_wins', 'subtraction_grundy']],
])

for (const [name, markers] of sourceMarkers) {
  const file = path.join(root, 'examples/cpp-patterns/include/cpp_patterns', name)
  const source = fs.readFileSync(file, 'utf8')
  for (const marker of markers) {
    if (!source.includes(marker)) errors.push(`${name}: missing source marker ${marker}`)
  }
}

if (codeBlocks < 45) errors.push(`expected at least 45 C++ examples, found ${codeBlocks}`)
if (chapterSections < 50) errors.push(`expected at least 50 pattern sections, found ${chapterSections}`)

for (const error of errors) console.error(error)
if (errors.length) process.exit(1)
console.log(
  `C++ pattern pages: ${pages.length} pages, ${chapterSections} required sections, ${codeBlocks} code blocks`
)
