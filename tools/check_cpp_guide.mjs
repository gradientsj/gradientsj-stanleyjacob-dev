#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const guide = path.join(root, 'software/cpp/index.html')

function decodeCode(source) {
  return source
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

const html = fs.readFileSync(guide, 'utf8')
const codeBlocks = [...html.matchAll(
  /<pre[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code><\/pre>/g
)].map(match => decodeCode(match[1]))

const markers = [
  'struct VectorCore',
  'struct ArrayLayout',
  'struct DequeLayout',
  'struct ListLink',
  'enum class Color',
  'repair_after_insert',
  'class ChainedHashMapCore',
  'struct GridPointHash',
  'class PriorityQueueCore',
  'auto filtered',
  'auto by_value',
  'release_acquire_example',
  'class BlockingQueue',
]

const selected = markers.map(marker => {
  const source = codeBlocks.find(block => block.includes(marker))
  if (!source) throw new Error(`missing C++ guide block: ${marker}`)
  return source
})

const invariantChecks = String.raw`
#include <cassert>

int main() {
  VectorCore<int> vector;
  vector.grow();
  std::construct_at(vector.finish, 5);
  ++vector.finish;
  vector.grow();
  assert(vector.size() == 1 && *vector.start == 5);

  ArrayLayout<int, 3> array{{1, 2, 3}};
  DynamicSpanLayout<int> span{array.elements, 3};
  assert(span[2] == 3);

  DequeLayout<int, 4> deque;
  deque.blocks.push_back(std::make_unique<int[]>(4));
  deque.blocks[0][2] = 9;
  deque.first_offset = 2;
  deque.element_count = 1;
  assert(deque.at_unchecked(0) == 9);

  ListLink sentinel{};
  sentinel.next = sentinel.previous = &sentinel;
  ListNode<int> list_node{};
  list_node.value = 7;
  link_before(&sentinel, &list_node);
  assert(sentinel.next == &list_node && sentinel.previous == &list_node);
  unlink(&list_node);
  assert(sentinel.next == &sentinel && sentinel.previous == &sentinel);

  using Node = TreeNode<int, int>;
  Node grandparent{nullptr, nullptr, nullptr, Color::black, {10, 1}};
  Node parent{&grandparent, nullptr, nullptr, Color::red, {5, 2}};
  Node child{&parent, nullptr, nullptr, Color::red, {1, 3}};
  grandparent.left = &parent;
  parent.left = &child;
  Node* root = &grandparent;
  repair_after_insert(root, &child);
  assert(root == &parent && root->color == Color::black);

  ChainedHashMapCore<int, int> map;
  assert(map.insert(4, 40));
  assert(!map.insert(4, 99));
  assert(map.find(4) && *map.find(4) == 40);
  for (int i = 0; i < 100; ++i) map.insert(i + 10, i);
  assert(map.find(109) && *map.find(109) == 99);

  GridPointHash hash;
  assert(hash({1, 2}) == hash({1, 2}));

  PriorityQueueCore<int> queue;
  queue.push(3);
  queue.push(8);
  queue.push(5);
  assert(queue.top() == 8);
  queue.pop();
  assert(queue.top() == 5);

  const std::vector<int> expected{9, 16, 25, 36};
  assert(filtered_squares() == expected);
  assert(capture_example() == 10);

  release_acquire_example();
  BlockingQueue<int> blocking;
  blocking.push(12);
  assert(blocking.pop() == 12);
  blocking.shutdown();
  assert(!blocking.pop().has_value());
}
`

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-guide-check-'))
const sourcePath = path.join(temporary, 'container-layouts.cpp')
const binaryPath = path.join(temporary, 'container-layouts')

try {
  fs.writeFileSync(sourcePath, `${selected.join('\n\n')}\n${invariantChecks}`)

  const compiler = process.env.CXX || 'c++'
  const compile = spawnSync(compiler, [
    sourcePath,
    '-std=c++20',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Wpedantic',
    '-Wconversion',
    '-Wshadow',
    '-o',
    binaryPath,
  ], { encoding: 'utf8' })

  if (compile.status !== 0) {
    process.stderr.write(compile.stdout)
    process.stderr.write(compile.stderr)
    process.exit(compile.status ?? 1)
  }
  if (compile.stderr.trim()) process.stderr.write(compile.stderr)

  const run = spawnSync(binaryPath, [], { encoding: 'utf8' })
  if (run.status !== 0) {
    process.stderr.write(run.stdout)
    process.stderr.write(run.stderr)
    process.exit(run.status ?? 1)
  }

  console.log('C++ guide: container, range, capture, and concurrency sketches passed checks')
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
