"""Generate the /algorithms section of stanleyjacob.dev.

Reads from the local interview-prep repo (C:/Users/stanl/algorithms):
  - leetcode_150/neetcode_250_checklist.md   -> problem lists per topic
  - python/graph_traversal/*.py              -> Python snippets
  - cpp/tests/graph_traversal_tests.cpp      -> C++ snippets
  - rust/src/graph_traversal.rs              -> Rust snippets
  - typescript/src/graphTraversal.ts         -> TypeScript snippets
  - golang/neetcode/<topic>/<topic>.go       -> Go snippets
  - swift/neetcode/<topic>.swift             -> Swift snippets

Writes:
  - algorithms/index.html                    (18 NeetCode topics, all 250 problems)
  - algorithms/graph-traversal/index.html    (12 BFS/DFS variants, 6-language tabs)

Re-run after changing the checklist or any implementation:
  python tools/generate_algorithms.py
"""

import html
import json
import pathlib
import re

SITE = pathlib.Path(__file__).resolve().parents[1]
ALGO = pathlib.Path(r"C:/Users/stanl/algorithms")

CHECKLIST = ALGO / "leetcode_150" / "neetcode_250_checklist.md"
PY_BFS = ALGO / "python" / "graph_traversal" / "bfs_variants.py"
PY_DFS = ALGO / "python" / "graph_traversal" / "dfs_variants.py"
CPP = ALGO / "cpp" / "tests" / "graph_traversal_tests.cpp"
RS = ALGO / "rust" / "src" / "graph_traversal.rs"
TS = ALGO / "typescript" / "src" / "graphTraversal.ts"

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E"
    "%3Crect width='100' height='100' rx='24' fill='%231d1d1f'/%3E%3Ctext x='50' y='70' "
    "font-size='52' font-weight='600' text-anchor='middle' "
    "font-family='-apple-system,Helvetica,Arial,sans-serif' fill='%23ffffff'%3Esj%3C/text%3E%3C/svg%3E"
)

NAV = """    <nav class="top">
      <div class="inner">
        <div class="brand"><a href="/">Stanley Jacob</a></div>
        <div class="links">
          <a href="/ai">AI</a>
          <a href="/robotics">Robotics</a>
          <a href="/software">Software</a>
          <a href="/algorithms" class="active">Algorithms</a>
          <a href="/systems">Systems</a>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </nav>"""

FOOTER = """    <footer class="site">
      <div class="inner">
        <span>© <span id="yr">2026</span> Stanley Jacob</span>
        <span>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
          &nbsp;·&nbsp; <a href="mailto:stanleyjacobai@gmail.com">stanleyjacobai@gmail.com</a>
        </span>
      </div>
    </footer>
    <script>
      document.getElementById("yr").textContent = new Date().getFullYear();
    </script>"""


# --------------------------------------------------------------- checklist

def parse_checklist():
    """Return [(topic, [(name, lc, difficulty, hook), ...]), ...] in file order."""
    topics = []
    current = None
    item = re.compile(r"^- \[.\] \*\*(.+?)\*\* \(LC (\d+), (Easy|Medium|Hard)\) — (.*)$")
    for line in CHECKLIST.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (.+?) \(\d+\)$", line)
        if m:
            current = (m.group(1), [])
            topics.append(current)
            continue
        m = item.match(line)
        if m and current:
            current[1].append((m.group(1), int(m.group(2)), m.group(3), m.group(4).strip()))
    return topics


def lc_slug(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9 \-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    return s


# topic id, description, related deep-dive links
TOPIC_META = {
    "Arrays & Hashing": (
        "arrays-hashing",
        "The foundation everything else builds on. Most optimal solutions here "
        "replace a rescan with something remembered: a hash set, a frequency "
        "table, a prefix sum, or a canonical key that makes equal things look equal.",
        [("Big-O and complexity analysis", "/software/algorithms/big-o"),
         ("Sorting: merge sort and quicksort", "/software/algorithms/sorting")],
    ),
    "Two Pointers": (
        "two-pointers",
        "When the input is sorted or mirrored, two indexes that only move toward "
        "each other can replace a full pass over every pair, cutting quadratic "
        "work to linear.",
        [("Two pointers and sliding window", "/software/algorithms/two-pointers-sliding-window")],
    ),
    "Sliding Window": (
        "sliding-window",
        "A window over the array grows on the right and shrinks on the left while "
        "its state updates incrementally, so every substring question stops "
        "costing a fresh scan.",
        [("Two pointers and sliding window", "/software/algorithms/two-pointers-sliding-window")],
    ),
    "Stack": (
        "stack",
        "A stack remembers exactly the prefix that is still unresolved. The "
        "monotonic variants answer next-greater and span questions in one pass "
        "by popping everything the current element settles.",
        [],
    ),
    "Binary Search": (
        "binary-search",
        "Anything with a monotonic yes/no boundary can be searched, including "
        "answer spaces that are not arrays at all: eating speeds, ship "
        "capacities, and largest-sum limits.",
        [("Binary search", "/software/algorithms/binary-search")],
    ),
    "Linked List": (
        "linked-list",
        "Pointer rewiring under constraints: dummy heads remove edge cases, "
        "fast and slow pointers find middles and cycles, and the two cache "
        "designs are the classic structure-composition interviews.",
        [],
    ),
    "Trees": (
        "trees",
        "Nearly every tree problem is one recursion shape: return a fact about "
        "each subtree once, combine the children's answers, and keep a separate "
        "best when the answer is not the return value.",
        [("Depth-first search (DFS)", "/software/algorithms/dfs"),
         ("Breadth-first search (BFS)", "/software/algorithms/bfs")],
    ),
    "Heap / Priority Queue": (
        "heap",
        "A heap keeps only what matters: the top k of a stream, the next event "
        "by time, or the boundary between the lower and upper half of the data.",
        [("Heaps and priority queues", "/software/algorithms/heaps")],
    ),
    "Backtracking": (
        "backtracking",
        "One template generates the whole topic: choose, recurse, undo. The "
        "problems differ only in what a choice is, what prunes a branch, and "
        "when to record a result.",
        [("Backtracking", "/software/algorithms/backtracking")],
    ),
    "Tries": (
        "tries",
        "A prefix tree turns whole-word lookups into per-character walks, which "
        "is what makes searching a grid for hundreds of words at once tractable.",
        [("Tries (prefix trees)", "/software/algorithms/tries")],
    ),
    "Graphs": (
        "graphs",
        "BFS for distances, DFS for structure, indegrees for ordering, and "
        "union-find for connectivity. The twelve canonical traversal variants "
        "are written out in six languages on the graph traversal page.",
        [("Graph traversal in six languages", "/algorithms/graph-traversal"),
         ("Breadth-first search (BFS)", "/software/algorithms/bfs"),
         ("Depth-first search (DFS)", "/software/algorithms/dfs"),
         ("Graph theory: topological sort and cycles", "/software/algorithms/graph-theory"),
         ("Union-Find (disjoint sets)", "/software/algorithms/union-find")],
    ),
    "Advanced Graphs": (
        "advanced-graphs",
        "Weighted edges change the rules: Dijkstra and its max-edge variants, "
        "minimum spanning trees, Bellman-Ford under a stop budget, and Eulerian "
        "paths.",
        [("Dijkstra's shortest path", "/software/algorithms/dijkstra"),
         ("Union-Find (disjoint sets)", "/software/algorithms/union-find")],
    ),
    "1-D Dynamic Programming": (
        "dp-1d",
        "Name the subproblem in one sentence, write the transition, and fill "
        "states in dependency order. These are the linear-state problems where "
        "that habit gets built.",
        [("Dynamic programming", "/software/algorithms/dynamic-programming")],
    ),
    "2-D Dynamic Programming": (
        "dp-2d",
        "Two indexes of state: prefix pairs for string alignment, intervals for "
        "games and balloons, and grids where the path itself is the state.",
        [("Dynamic programming", "/software/algorithms/dynamic-programming")],
    ),
    "Greedy": (
        "greedy",
        "A greedy solution stands on an exchange argument: the locally best "
        "choice never blocks a globally best one. Each problem here teaches a "
        "distinct invariant worth saying out loud before coding.",
        [("Greedy algorithms", "/software/algorithms/greedy")],
    ),
    "Intervals": (
        "intervals",
        "Sort by the boundary that controls conflicts, then sweep once. Sorting "
        "by end time solves scheduling; sorting by start time solves merging.",
        [("Greedy algorithms", "/software/algorithms/greedy")],
    ),
    "Math & Geometry": (
        "math-geometry",
        "Simulation problems where the win is finding the exact numeric "
        "invariant: matrix layers, carries, modular identities, and "
        "exponentiation by squaring.",
        [],
    ),
    "Bit Manipulation": (
        "bit-manipulation",
        "A small toolbox that shows up everywhere: XOR cancellation, clearing "
        "the lowest set bit, and building answers bit by bit from the top.",
        [],
    ),
}


# internal "Variant" references in the checklist hooks become links into the
# graph-traversal walkthrough on the site
VARIANT_ANCHORS = {
    ("BFS", "1"): "level-order", ("BFS", "2"): "grid-bfs", ("BFS", "3"): "multi-source",
    ("BFS", "4"): "bidirectional", ("BFS", "5"): "kahn", ("BFS", "6"): "zero-one-bfs",
    ("DFS", "1"): "flood-fill", ("DFS", "2"): "iterative-dfs", ("DFS", "3"): "cycle-detection",
    ("DFS", "4"): "topo-dfs", ("DFS", "5"): "diameter", ("DFS", "6"): "word-search",
}


def render_trick(hook):
    text = html.escape(hook, quote=False)

    def variant_link(m):
        anchor = VARIANT_ANCHORS[(m.group(1), m.group(2))]
        return f'(<a href="/algorithms/graph-traversal#{anchor}">walkthrough</a>)'

    text = re.sub(r"\((?:study_guide )?(BFS|DFS) Variant (\d)\)", variant_link, text)
    text = text.replace(
        "(Variants 4 + 5)",
        '(<a href="/algorithms/graph-traversal#kahn">walkthrough</a>)',
    )
    return text


def problem_blurb(name, hook, descriptions):
    text = descriptions.get(name)
    if text:
        return html.escape(text, quote=False)
    return render_trick(hook)


def render_index(topics, descriptions):
    toc = []
    sections = []
    for i, (topic, problems) in enumerate(topics):
        tid, desc, links = TOPIC_META[topic]
        toc.append(
            f'          <a class="tag" href="#{tid}">{html.escape(topic)}</a>'
        )
        rows = []
        for name, lc, diff, hook in problems:
            slug = lc_slug(name)
            rows.append(
                "            <li><div class=\"prob\">"
                f'<a href="/algorithms/{tid}#{slug}">{html.escape(name)}</a>'
                f'<p class="trick">{problem_blurb(name, hook, descriptions)}</p></div>'
                f'<span class="date diff-{diff.lower()}">{diff} · LC {lc}</span></li>'
            )
        link_line = ""
        if links:
            parts = " · ".join(f'<a href="{href}">{html.escape(label)}</a>' for label, href in links)
            link_line = f'\n          <p class="deep-links">Deep dives: {parts}</p>'
        kicker = f"{i + 1:02d}"
        soft = ' class="soft"' if i % 2 == 0 else ""
        sections.append(f"""    <section id="{tid}"{soft}>
      <div class="wrap">
        <div class="section-head">
          <div class="kicker">{kicker}</div>
          <h2><a href="/algorithms/{tid}">{html.escape(topic)}</a></h2>
          <p>{desc}</p>{link_line}
        </div>
        <ul class="notes tricks">
{chr(10).join(rows)}
        </ul>
      </div>
    </section>""")

    toc_html = "\n".join(toc)
    sections_html = "\n\n".join(sections)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Algorithms · Stanley Jacob</title>
    <meta name="description" content="The NeetCode 250 organized into eighteen topics, from arrays and hashing to bit manipulation, with canonical implementations in Python, C++, Rust, TypeScript, Go, and Swift." />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="{FAVICON}" />
  </head>
  <body>
{NAV}

    <header class="hero">
      <div class="wrap">
        <div class="eyebrow">Interview preparation</div>
        <h1>Algorithms</h1>
        <p class="lead">
          The NeetCode 250 problem set, organized the way NeetCode subdivides it: eighteen topics
          in roadmap order, where each one builds on the techniques of the ones before it. Every
          problem carries a refresher underneath covering what it asks, how the solution works, and
          the trick behind it, and links to its topic page, where solutions appear side by side in
          Python, C++, Rust, TypeScript, Go, and Swift with a language switcher. A solution is
          published only after its implementation passes unit tests against the official LeetCode
          examples.
        </p>
        <div class="cta-row">
          <a class="btn primary" href="/algorithms/graph-traversal">Graph traversal in six languages</a>
        </div>
        <div class="tags" style="margin-top: 20px">
{toc_html}
        </div>
      </div>
    </header>

{sections_html}

{FOOTER}
  </body>
</html>
"""


def render_topic_page(i, topic, problems, descriptions):
    tid, desc, links = TOPIC_META[topic]
    n_solved = sum(1 for p in problems if p[0] in SOLUTIONS)
    if n_solved:
        solved_note = (
            " Every problem here has a full solution in Python, C++, Rust, TypeScript, Go, "
            "and Swift; the tabs switch every snippet on the page at once, and each solution "
            "is published only after passing unit tests against the official LeetCode examples."
        )
    else:
        solved_note = (
            " Solutions in Python, C++, Rust, TypeScript, Go, and Swift are being added topic "
            "by topic, and each appears only after its implementation passes unit tests against "
            "the official LeetCode examples."
        )
    link_line = ""
    if links:
        parts = " · ".join(f'<a href="{href}">{html.escape(label)}</a>' for label, href in links)
        link_line = f'\n        <p class="deep-links">Deep dives: {parts}</p>'
    body = []
    for j, (name, lc, diff, hook) in enumerate(problems, 1):
        slug = lc_slug(name)
        lc_url = f"https://leetcode.com/problems/{slug}/"
        section = [
            f'          <h2 id="{slug}">{j}. {html.escape(name)}</h2>',
            f'          <p class="quiet"><span class="diff-{diff.lower()}">{diff}</span> · '
            f'<a href="{lc_url}" target="_blank" rel="noreferrer">LC {lc}</a></p>',
            f"          <p>{problem_blurb(name, hook, descriptions)}</p>",
        ]
        if name in SOLUTIONS:
            section.append(render_code_tabs(SOLUTIONS[name]))
        body.append("\n".join(section))
    body_html = "\n".join(body)

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(topic)} · Algorithms · Stanley Jacob</title>
    <meta name="description" content="{html.escape(topic)} from the NeetCode 250: every problem with a description of what it asks, how the solution works, and the trick behind it, plus solutions in Python, C++, Rust, TypeScript, Go, and Swift." />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="{FAVICON}" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
  </head>
  <body>
{NAV}
    <header class="hero">
      <div class="wrap">
        <div class="eyebrow"><a href="/algorithms">← Algorithms</a></div>
        <h1>{html.escape(topic)}</h1>
        <p class="meta">Topic {i + 1:02d} of 18</p>
        <p class="lead">{desc}{solved_note}</p>{link_line}
      </div>
    </header>
    <section style="padding-top: 0">
      <div class="wrap">
        <article class="prose article">
{body_html}
        </article>
      </div>
    </section>
{FOOTER}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="/code-tabs.js"></script>
    <script>
      window.addEventListener("DOMContentLoaded", function () {{
        if (window.hljs) hljs.highlightAll();
      }});
    </script>
  </body>
</html>
"""


# --------------------------------------------------------- code extraction

def _lines(path):
    return path.read_text(encoding="utf-8").splitlines()


def _find(lines, prefix):
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            return i
    raise SystemExit(f"marker not found: {prefix!r}")


def _find_re(lines, pattern):
    rx = re.compile(pattern)
    for i, line in enumerate(lines):
        if line and not line[0].isspace() and rx.search(line):
            return i
    raise SystemExit(f"regex marker not found: {pattern!r}")


def extract_py_item(lines, header):
    """A col-0 Python def/class through the end of its indented body."""
    start = _find(lines, header)
    end = start + 1
    while end < len(lines):
        line = lines[end]
        if line.strip() and not line.startswith((" ", "\t")):
            break
        end += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    return "\n".join(lines[start:end])


def _block_from(lines, start):
    """A brace-language item plus contiguous leading comments, to col-0 '}' or '};'."""
    first = start
    while first > 0 and lines[first - 1].lstrip().startswith(("//", "///", "/**", "*", "*/")):
        first -= 1
    end = start
    while end < len(lines) and lines[end].rstrip() not in ("}", "};"):
        end += 1
    return "\n".join(lines[first:end + 1])


def extract_block(lines, prefix):
    return _block_from(lines, _find(lines, prefix))


def extract_blockre(lines, pattern):
    return _block_from(lines, _find_re(lines, pattern))


def extract_line(lines, prefix):
    return lines[_find(lines, prefix)]


def extract_range(lines, start_prefix, end_prefix):
    start = _find(lines, start_prefix)
    end = _find(lines, end_prefix)
    return "\n".join(lines[start:end + 1])


def extract_between(lines, start_prefix, end_prefix):
    """The lines strictly between two col-0 markers (Go class sections)."""
    start = _find(lines, start_prefix)
    end = _find(lines, end_prefix)
    return "\n".join(lines[start + 1:end]).strip("\n")


SOURCES = {
    "py_bfs": PY_BFS,
    "py_dfs": PY_DFS,
    "cpp": CPP,
    "rs": RS,
    "ts": TS,
    "go_gt": ALGO / "golang" / "neetcode" / "graph_traversal" / "graph_traversal.go",
    "sw_gt": ALGO / "swift" / "neetcode" / "graph_traversal.swift",
    "py_ah": ALGO / "python" / "neetcode" / "arrays_hashing.py",
    "cpp_ah": ALGO / "cpp" / "tests" / "arrays_hashing_tests.cpp",
    "rs_ah": ALGO / "rust" / "src" / "arrays_hashing.rs",
    "ts_ah": ALGO / "typescript" / "src" / "arraysHashing.ts",
    "go_ah": ALGO / "golang" / "neetcode" / "arrays_hashing" / "arrays_hashing.go",
    "sw_ah": ALGO / "swift" / "neetcode" / "arrays_hashing.swift",
}
_SRC_CACHE = {}


def src_lines(key):
    if key not in _SRC_CACHE:
        _SRC_CACHE[key] = _lines(SOURCES[key])
    return _SRC_CACHE[key]


def snippet(parts):
    """parts: list of (kind, source, *args) -> joined code text."""
    out = []
    for part in parts:
        kind, src = part[0], src_lines(part[1])
        if kind == "pydef":
            out.append(extract_py_item(src, f"def {part[2]}("))
        elif kind == "pyclass":
            out.append(extract_py_item(src, f"class {part[2]}"))
        elif kind == "block":
            out.append(extract_block(src, part[2]))
        elif kind == "blockre":
            out.append(extract_blockre(src, part[2]))
        elif kind == "line":
            out.append(extract_line(src, part[2]))
        elif kind == "range":
            out.append(extract_range(src, part[2], part[3]))
        elif kind == "between":
            out.append(extract_between(src, part[2], part[3]))
    return "\n\n".join(out)


CPP_COLORS = ("range", "cpp", "// 3-color states", "enum Color")
RS_COLORS = ("range", "rs", "// 3-color states", "const BLACK")
TS_COLORS = ("range", "ts", "// 3-color states", "const BLACK")
TS_DIRS = ("range", "ts", "const FOUR_DIRECTIONS", "];")
PY_COLORS = ("line", "py_dfs", "WHITE, GRAY, BLACK")

VARIANTS = [
    {
        "id": "level-order",
        "title": "Level-order traversal",
        "ref": "LC 102 · Binary Tree Level Order Traversal · the BFS entry point",
        "prose": [
            "Level-order traversal is the cleanest place to watch the queue work, because a "
            "tree has no cycles and the visited set disappears entirely. The one trick is to "
            "snapshot the queue length before draining each round: by the BFS invariant the "
            "queue only ever holds nodes at two consecutive depths, so everything in it at "
            "that instant is exactly one level. Popping that many nodes and pushing their "
            "children walks the tree one depth at a time in O(n) time and O(width) space.",
            "The same round-by-round drain reappears in zigzag traversal, right side view, "
            "minimum depth, and every simulation that advances in waves, including Rotting "
            "Oranges below.",
        ],
        "hook": "Size snapshot = level boundary.",
        "code": {
            "python": [("pydef", "py_bfs", "level_order")],
            "cpp": [("block", "cpp", "vector<vector<int>> levelOrder(")],
            "rust": [("block", "rs", "pub fn level_order(")],
            "typescript": [("block", "ts", "export function levelOrder(")],
        },
    },
    {
        "id": "grid-bfs",
        "title": "Single-source grid BFS",
        "ref": "LC 1091 · Shortest Path in Binary Matrix",
        "prose": [
            "The grid itself is the graph. Instead of building an adjacency list, you "
            "enumerate the eight direction offsets, bounds-check, and skip blocked or "
            "already-seen cells; that neighbor function is the entire edge set. The detail "
            "that decides correctness is marking a cell visited the moment it is enqueued "
            "rather than when it is dequeued. Late marking lets the same cell enter the "
            "queue many times, which inflates the queue on large grids and breaks the "
            "distance guarantee. Time and space are O(n²), one enqueue per cell.",
            "Once nodes are states and edges are moves, the same code solves mazes, knight "
            "paths, and Open the Lock, where the cells are lock combinations and the "
            "directions are wheel turns.",
        ],
        "hook": "The grid is the graph; directions are the edges.",
        "code": {
            "python": [("pydef", "py_bfs", "shortest_path_binary_matrix")],
            "cpp": [("block", "cpp", "int shortestPathBinaryMatrix(")],
            "rust": [("block", "rs", "pub fn shortest_path_binary_matrix(")],
            "typescript": [("block", "ts", "export function shortestPathBinaryMatrix(")],
        },
    },
    {
        "id": "multi-source",
        "title": "Multi-source BFS",
        "ref": "LC 994 · Rotting Oranges",
        "prose": [
            "One changed line turns single-source BFS into a different tool: seed the queue "
            "with every rotten orange before the loop starts. All the wavefronts then "
            "advance together, so each fresh orange is reached at the earliest minute any "
            "source could reach it, and each completed round of the queue is one minute of "
            "simulated time. Conceptually you have added a virtual super-source connected "
            "to every seed at distance zero. O(mn) time and space.",
            "Whenever a question asks for the distance to the nearest of many sources, "
            "Walls and Gates and 01 Matrix included, seed them all and run one pass instead "
            "of one search per cell.",
        ],
        "hook": "Many sources, one queue.",
        "code": {
            "python": [("pydef", "py_bfs", "oranges_rotting")],
            "cpp": [("block", "cpp", "int orangesRotting(")],
            "rust": [("block", "rs", "pub fn oranges_rotting(")],
            "typescript": [TS_DIRS, ("block", "ts", "export function orangesRotting(")],
        },
    },
    {
        "id": "bidirectional",
        "title": "Bidirectional BFS",
        "ref": "LC 127 · Word Ladder",
        "prose": [
            "Words are nodes and one-letter edits are edges, and the graph never gets "
            "built; neighbors are generated by substituting each letter at each position "
            "and testing membership in the dictionary set. Searching from both ends and "
            "always expanding the smaller frontier turns roughly b^d work into roughly "
            "2·b^(d/2): the two waves meet in the middle, and the moment a generated "
            "candidate appears in the opposite frontier the answer is the current distance "
            "plus one. Removing a word from the pool doubles as the visited mark.",
            "Minimum Genetic Mutation is the same problem with a four-letter alphabet, and "
            "the balanced two-frontier idea is the conceptual gateway to A*.",
        ],
        "hook": "Two waves; expand the smaller; meet in the middle.",
        "code": {
            "python": [("pydef", "py_bfs", "ladder_length")],
            "cpp": [("block", "cpp", "int ladderLength(")],
            "rust": [("block", "rs", "pub fn ladder_length(")],
            "typescript": [("block", "ts", "export function ladderLength(")],
        },
    },
    {
        "id": "kahn",
        "title": "Topological sort, Kahn's algorithm",
        "ref": "LC 210 · Course Schedule II",
        "prose": [
            "Kahn's algorithm is BFS where readiness replaces adjacency: a node may enter "
            "the queue only when its indegree drops to zero, meaning every prerequisite is "
            "already placed in the output. Cycle detection falls out for free, because a "
            "node on a cycle waits on a predecessor that waits on it and never reaches "
            "indegree zero. If the finished order holds fewer than n nodes, the leftovers "
            "sit on a cycle and no valid order exists. O(V + E) time and space.",
        ],
        "hook": "Indegree zero = ready to take.",
        "code": {
            "python": [("pydef", "py_bfs", "find_order_kahn")],
            "cpp": [("block", "cpp", "vector<int> findOrderKahn(")],
            "rust": [("block", "rs", "pub fn find_order_kahn(")],
            "typescript": [("block", "ts", "export function findOrderKahn(")],
        },
    },
    {
        "id": "zero-one-bfs",
        "title": "0-1 BFS",
        "ref": "LC 2290 · Minimum Obstacle Removal to Reach Corner",
        "prose": [
            "Plain BFS needs equal edge weights and Dijkstra pays a logarithm per heap "
            "operation. When every edge costs exactly zero or one there is a middle path: "
            "relax edges like Dijkstra but use a deque, pushing free moves to the front and "
            "paid moves to the back. The deque stays sorted by distance with at most two "
            "distinct values in it, the same invariant that makes plain BFS correct, and "
            "every operation is O(1), giving O(mn) overall instead of O(mn log mn).",
            "The same shape solves any problem that lets you flip a limited number of cells "
            "or walls, and it fixes the family relationship in your head: BFS, 0-1 BFS, and "
            "Dijkstra are one algorithm ordered by how general the weights are.",
        ],
        "hook": "Free moves jump the line.",
        "code": {
            "python": [("pydef", "py_bfs", "min_obstacle_removal")],
            "cpp": [("block", "cpp", "int minObstacleRemoval(")],
            "rust": [("block", "rs", "pub fn min_obstacle_removal(")],
            "typescript": [TS_DIRS, ("block", "ts", "export function minObstacleRemoval(")],
        },
    },
    {
        "id": "flood-fill",
        "title": "Flood fill and connected components",
        "ref": "LC 200 · Number of Islands · recursive",
        "prose": [
            "The outer double loop scans every cell, and on finding land it increments the "
            "count and launches a DFS that sinks the entire island by overwriting every "
            "reachable cell. Because the whole component is erased before the scan "
            "continues, no island can be counted twice, so the number of components equals "
            "the number of launches. Mutating the grid doubles as the visited set, which "
            "costs no extra memory; copy first if the caller needs the grid back. O(mn) "
            "time, with recursion as deep as the largest island in the worst case.",
        ],
        "hook": "Count the launches, sink the island.",
        "code": {
            "python": [("pydef", "py_dfs", "num_islands")],
            "cpp": [("block", "cpp", "static void sink("), ("block", "cpp", "int numIslands(")],
            "rust": [("block", "rs", "pub fn num_islands(")],
            "typescript": [("block", "ts", "export function numIslands(")],
        },
    },
    {
        "id": "iterative-dfs",
        "title": "Iterative DFS with an explicit stack",
        "ref": "LC 200 again · the recursion-free fallback",
        "prose": [
            "Recursion depth equals the worst path length, and a snake-shaped island in a "
            "thousand-by-thousand grid overflows the default call stack in most languages. "
            "The fix is the same logic with the call stack swapped for an explicit one: "
            "push the seed, then loop popping and pushing unmarked neighbors, marking each "
            "on push rather than on pop. Marking on pop reintroduces the duplicate-entry "
            "problem from the BFS section, in stack form.",
            "Put side by side with BFS, the only difference is the container. A stack "
            "dives, a queue spreads, and if a problem needs only reachability either "
            "works, while distances demand the queue.",
        ],
        "hook": "Stack or queue is the only difference.",
        "code": {
            "python": [("pydef", "py_dfs", "num_islands_iterative")],
            "cpp": [("block", "cpp", "int numIslandsIterative(")],
            "rust": [("block", "rs", "pub fn num_islands_iterative(")],
            "typescript": [TS_DIRS, ("block", "ts", "export function numIslandsIterative(")],
        },
    },
    {
        "id": "cycle-detection",
        "title": "Cycle detection with three colors",
        "ref": "LC 207 · Course Schedule",
        "prose": [
            "In a directed graph, reaching an already-visited node is ambiguous. Reaching "
            "it through a back edge, meaning it sits on the current recursion path, proves "
            "a cycle; reaching it through a cross edge, meaning an earlier search finished "
            "it, is harmless. A boolean visited flag cannot tell these apart, and the "
            "diamond graph with edges 0 to 1, 0 to 2, and 1 to 2 is the standard case "
            "where the boolean version reports a cycle that does not exist.",
            "Three states make the distinction: white for untouched, gray for open on the "
            "current path, black for fully explored and proven safe. Meeting gray means a "
            "cycle; meeting black means skip. O(V + E) time and O(V) space.",
        ],
        "hook": "Gray means still inside it; meeting gray means a loop.",
        "code": {
            "python": [PY_COLORS, ("pydef", "py_dfs", "can_finish_dfs")],
            "cpp": [CPP_COLORS, ("block", "cpp", "static bool hasCycle("),
                    ("block", "cpp", "bool canFinishDFS(")],
            "rust": [RS_COLORS, ("block", "rs", "pub fn can_finish_dfs(")],
            "typescript": [TS_COLORS, ("block", "ts", "export function canFinishDFS(")],
        },
    },
    {
        "id": "topo-dfs",
        "title": "Topological sort by finish times",
        "ref": "LC 210 · Course Schedule II · the DFS twin of Kahn's",
        "prose": [
            "One line added to cycle detection produces a topological sort: append each "
            "node when it turns black, then reverse the list. A node is appended only "
            "after everything it points to has been appended, so the reversed finish order "
            "puts every node ahead of its dependents, which is the definition.",
            "Knowing both algorithms is worth saying out loud in an interview. Kahn's "
            "yields the order lazily round by round, which answers questions like how many "
            "semesters, while the DFS version yields finish times, which later algorithms "
            "such as Kosaraju's strongly connected components are built on.",
        ],
        "hook": "Finish last, serve first.",
        "code": {
            "python": [PY_COLORS, ("pydef", "py_dfs", "find_order_dfs")],
            "cpp": [CPP_COLORS, ("block", "cpp", "static bool topoVisit("),
                    ("block", "cpp", "vector<int> findOrderDFS(")],
            "rust": [RS_COLORS, ("block", "rs", "pub fn find_order_dfs(")],
            "typescript": [TS_COLORS, ("block", "ts", "export function findOrderDFS(")],
        },
    },
    {
        "id": "diameter",
        "title": "Postorder tree DFS with return values",
        "ref": "LC 543 · Diameter of Binary Tree",
        "prose": [
            "Each recursive call returns one fact about its subtree to its parent, the "
            "height, while a shared best collects a different fact computed from the "
            "children, the longest path bending through this node. The answer is the "
            "collected value, not the root's return value, and that mismatch is the whole "
            "trick. Computing heights independently at every node would be quadratic; the "
            "postorder version computes each height exactly once, O(n) time and O(height) "
            "stack.",
            "Balanced Binary Tree, Binary Tree Maximum Path Sum, Longest Univalue Path, "
            "and House Robber III are this exact shape with a different combine step.",
        ],
        "hook": "Return what the parent needs; stash what the answer needs.",
        "code": {
            "python": [("pydef", "py_dfs", "diameter_of_binary_tree")],
            "cpp": [("block", "cpp", "static int height("),
                    ("block", "cpp", "int diameterOfBinaryTree(")],
            "rust": [("block", "rs", "pub fn diameter_of_binary_tree(")],
            "typescript": [("block", "ts", "export function diameterOfBinaryTree(")],
        },
    },
    {
        "id": "word-search",
        "title": "Backtracking on a grid",
        "ref": "LC 79 · Word Search · DFS plus undo",
        "prose": [
            "Flood fill marks cells permanently because visited is a global fact there. "
            "Here a cell is only blocked for the current path, and a different path may "
            "use it, so the mark is temporary: overwrite the cell, recurse on the four "
            "neighbors for the next character, then restore the cell before returning so "
            "sibling paths can reuse it. DFS plus undo is the definition of backtracking, "
            "and the test suites include a word that only fits by snaking through cells "
            "freed when earlier branches failed.",
            "The check order matters too: test for a complete match before bounds, or the "
            "final character fails at the grid edge. Time is O(mn · 3^L), branching three "
            "ways because the path never returns to the cell it came from, with O(L) stack.",
        ],
        "hook": "Mark, explore, unmark.",
        "code": {
            "python": [("pydef", "py_dfs", "exist")],
            "cpp": [("block", "cpp", "static bool wordDfs("), ("block", "cpp", "bool exist(")],
            "rust": [("block", "rs", "pub fn exist(")],
            "typescript": [("block", "ts", "export function exist(")],
        },
    },
]

# the Go and Swift graph-traversal modules hold one self-contained function
# per variant, so their specs are uniform and injected here
GT_FUNCS = {
    "level-order": "levelOrder", "grid-bfs": "shortestPathBinaryMatrix",
    "multi-source": "orangesRotting", "bidirectional": "ladderLength",
    "kahn": "findOrderKahn", "zero-one-bfs": "minObstacleRemoval",
    "flood-fill": "numIslands", "iterative-dfs": "numIslandsIterative",
    "cycle-detection": "canFinishDFS", "topo-dfs": "findOrderDFS",
    "diameter": "diameterOfBinaryTree", "word-search": "exist",
}
for _v in VARIANTS:
    _fn = GT_FUNCS[_v["id"]]
    _v["code"]["go"] = [("block", "go_gt", f"func {_fn}(")]
    _v["code"]["swift"] = [("block", "sw_gt", f"func {_fn}(")]

LANG_LABELS = [
    ("python", "Python"), ("cpp", "C++"), ("rust", "Rust"),
    ("typescript", "TypeScript"), ("go", "Go"), ("swift", "Swift"),
]

# ------------------------------------------------------------ descriptions

DESC_DIR = ALGO / "leetcode_150" / "descriptions"


def load_descriptions():
    """name -> long description, from the per-topic JSON files."""
    desc = {}
    for f in sorted(DESC_DIR.glob("*.json")):
        for item in json.loads(f.read_text(encoding="utf-8")):
            desc[item["name"]] = item["description"]
    return desc


# ------------------------------------------------- per-problem solutions

def _ah_fn(snake, camel):
    return {
        "python": [("pydef", "py_ah", snake)],
        "cpp": [("blockre", "cpp_ah", rf"^\S.*\b{camel}\(")],
        "rust": [("block", "rs_ah", f"pub fn {snake}(")],
        "typescript": [("block", "ts_ah", f"export function {camel}(")],
        "go": [("block", "go_ah", f"func {camel}(")],
        "swift": [("block", "sw_ah", f"func {camel}(")],
    }


def _ah_class(cls):
    return {
        "python": [("pyclass", "py_ah", cls)],
        "cpp": [("blockre", "cpp_ah", rf"^class {cls}\b")],
        "rust": [("block", "rs_ah", f"pub struct {cls}"), ("block", "rs_ah", f"impl {cls}")],
        "typescript": [("block", "ts_ah", f"export class {cls}")],
        "go": [("between", "go_ah", f"// section: {cls}", f"// endsection: {cls}")],
        "swift": [("block", "sw_ah", f"class {cls}")],
    }


_VARIANT_CODE = {v["id"]: v["code"] for v in VARIANTS}

# problem name (verbatim from the checklist) -> per-language extraction specs.
# Only problems listed here get code tabs; everything else shows its
# description until tested implementations land.
SOLUTIONS = {
    # backed by the graph_traversal modules (already tested)
    "Binary Tree Level Order Traversal": _VARIANT_CODE["level-order"],
    "Rotting Oranges": _VARIANT_CODE["multi-source"],
    "Word Ladder": _VARIANT_CODE["bidirectional"],
    "Course Schedule": _VARIANT_CODE["cycle-detection"],
    "Course Schedule II": _VARIANT_CODE["kahn"],
    "Number of Islands": _VARIANT_CODE["flood-fill"],
    "Word Search": _VARIANT_CODE["word-search"],
    "Diameter of Binary Tree": _VARIANT_CODE["diameter"],
    # arrays & hashing modules
    "Concatenation of Array": _ah_fn("get_concatenation", "getConcatenation"),
    "Contains Duplicate": _ah_fn("contains_duplicate", "containsDuplicate"),
    "Valid Anagram": _ah_fn("is_anagram", "isAnagram"),
    "Two Sum": _ah_fn("two_sum", "twoSum"),
    "Longest Common Prefix": _ah_fn("longest_common_prefix", "longestCommonPrefix"),
    "Group Anagrams": _ah_fn("group_anagrams", "groupAnagrams"),
    "Remove Element": _ah_fn("remove_element", "removeElement"),
    "Majority Element": _ah_fn("majority_element", "majorityElement"),
    "Design HashSet": _ah_class("MyHashSet"),
    "Design HashMap": _ah_class("MyHashMap"),
    "Sort an Array": _ah_fn("sort_array", "sortArray"),
    "Sort Colors": _ah_fn("sort_colors", "sortColors"),
    "Top K Frequent Elements": _ah_fn("top_k_frequent", "topKFrequent"),
    "Encode and Decode Strings": {
        "python": [("pydef", "py_ah", "encode"), ("pydef", "py_ah", "decode")],
        "cpp": [("blockre", "cpp_ah", r"^\S.*\bencode\("), ("blockre", "cpp_ah", r"^\S.*\bdecode\(")],
        "rust": [("block", "rs_ah", "pub fn encode("), ("block", "rs_ah", "pub fn decode(")],
        "typescript": [("block", "ts_ah", "export function encode("), ("block", "ts_ah", "export function decode(")],
        "go": [("block", "go_ah", "func encode("), ("block", "go_ah", "func decode(")],
        "swift": [("block", "sw_ah", "func encode("), ("block", "sw_ah", "func decode(")],
    },
    "Range Sum Query 2D Immutable": _ah_class("NumMatrix"),
    "Product of Array Except Self": _ah_fn("product_except_self", "productExceptSelf"),
    "Valid Sudoku": _ah_fn("is_valid_sudoku", "isValidSudoku"),
    "Longest Consecutive Sequence": _ah_fn("longest_consecutive", "longestConsecutive"),
    "Best Time to Buy And Sell Stock II": _ah_fn("max_profit", "maxProfit"),
    "Majority Element II": _ah_fn("majority_element_ii", "majorityElementII"),
    "Subarray Sum Equals K": _ah_fn("subarray_sum", "subarraySum"),
    "First Missing Positive": _ah_fn("first_missing_positive", "firstMissingPositive"),
}

# ---------------------------------------------- remaining topics, by table
# Each topic maps problem name (verbatim from the checklist) to its symbol:
# camelCase = function (snake_case derived for Python/Rust), Capitalized =
# class (pyclass / cpp class / rust struct+impl / ts export class), list =
# multiple symbols shown together. Topics are wired into SOLUTIONS only
# once listed in ENABLED_TOPICS, after their four implementations pass
# tests.

TOPIC_SYMBOLS = {
    "two-pointers": {
        "Reverse String": "reverseString", "Valid Palindrome": "isPalindrome",
        "Valid Palindrome II": "validPalindrome", "Merge Strings Alternately": "mergeAlternately",
        "Merge Sorted Array": "mergeSortedArray", "Remove Duplicates From Sorted Array": "removeDuplicates",
        "Two Sum II Input Array Is Sorted": "twoSumSorted", "3Sum": "threeSum", "4Sum": "fourSum",
        "Rotate Array": "rotateArray", "Container With Most Water": "maxArea",
        "Boats to Save People": "numRescueBoats", "Trapping Rain Water": "trap",
    },
    "sliding-window": {
        "Contains Duplicate II": "containsNearbyDuplicate",
        "Best Time to Buy And Sell Stock": "maxProfit",
        "Longest Substring Without Repeating Characters": "lengthOfLongestSubstring",
        "Longest Repeating Character Replacement": "characterReplacement",
        "Permutation In String": "checkInclusion", "Minimum Size Subarray Sum": "minSubArrayLen",
        "Find K Closest Elements": "findClosestElements", "Minimum Window Substring": "minWindow",
        "Sliding Window Maximum": "maxSlidingWindow",
    },
    "stack": {
        "Baseball Game": "calPoints", "Valid Parentheses": "isValidParentheses",
        "Implement Stack Using Queues": "MyStack", "Implement Queue using Stacks": "MyQueue",
        "Min Stack": "MinStack", "Evaluate Reverse Polish Notation": "evalRPN",
        "Asteroid Collision": "asteroidCollision", "Daily Temperatures": "dailyTemperatures",
        "Online Stock Span": "StockSpanner", "Car Fleet": "carFleet", "Simplify Path": "simplifyPath",
        "Decode String": "decodeString", "Maximum Frequency Stack": "FreqStack",
        "Largest Rectangle In Histogram": "largestRectangleArea",
    },
    "binary-search": {
        "Binary Search": "binarySearch", "Search Insert Position": "searchInsert",
        "Guess Number Higher Or Lower": "guessNumber", "Sqrt(x)": "mySqrt",
        "Search a 2D Matrix": "searchMatrix", "Koko Eating Bananas": "minEatingSpeed",
        "Capacity to Ship Packages Within D Days": "shipWithinDays",
        "Find Minimum In Rotated Sorted Array": "findMin",
        "Search In Rotated Sorted Array": "searchRotated",
        "Search In Rotated Sorted Array II": "searchRotatedII",
        "Time Based Key Value Store": "TimeMap", "Split Array Largest Sum": "splitArray",
        "Median of Two Sorted Arrays": "findMedianSortedArrays",
        "Find in Mountain Array": "findInMountainArray",
    },
    "linked-list": {
        "Reverse Linked List": "reverseList", "Merge Two Sorted Lists": "mergeTwoLists",
        "Linked List Cycle": "hasCycle", "Reorder List": "reorderList",
        "Remove Nth Node From End of List": "removeNthFromEnd",
        "Copy List With Random Pointer": "copyRandomList", "Add Two Numbers": "addTwoNumbers",
        "Find The Duplicate Number": "findDuplicate", "Reverse Linked List II": "reverseBetween",
        "Design Circular Queue": "MyCircularQueue", "LRU Cache": "LRUCache", "LFU Cache": "LFUCache",
        "Merge K Sorted Lists": "mergeKLists", "Reverse Nodes In K Group": "reverseKGroup",
    },
    "trees": {
        "Binary Tree Inorder Traversal": "inorderTraversal",
        "Binary Tree Preorder Traversal": "preorderTraversal",
        "Binary Tree Postorder Traversal": "postorderTraversal",
        "Invert Binary Tree": "invertTree", "Maximum Depth of Binary Tree": "maxDepth",
        "Balanced Binary Tree": "isBalanced", "Same Tree": "isSameTree",
        "Subtree of Another Tree": "isSubtree",
        "Lowest Common Ancestor of a Binary Search Tree": "lowestCommonAncestor",
        "Insert into a Binary Search Tree": "insertIntoBST", "Delete Node in a BST": "deleteNode",
        "Binary Tree Right Side View": "rightSideView", "Construct Quad Tree": "constructQuadTree",
        "Count Good Nodes In Binary Tree": "goodNodes", "Validate Binary Search Tree": "isValidBST",
        "Kth Smallest Element In a Bst": "kthSmallest",
        "Construct Binary Tree From Preorder And Inorder Traversal": "buildTree",
        "House Robber III": "robTree", "Delete Leaves With a Given Value": "removeLeafNodes",
        "Binary Tree Maximum Path Sum": "maxPathSum",
        "Serialize And Deserialize Binary Tree": "Codec",
    },
    "heap": {
        "Kth Largest Element In a Stream": "KthLargest", "Last Stone Weight": "lastStoneWeight",
        "K Closest Points to Origin": "kClosest", "Kth Largest Element In An Array": "findKthLargest",
        "Task Scheduler": "leastInterval", "Design Twitter": "Twitter",
        "Single Threaded CPU": "getOrder", "Reorganize String": "reorganizeString",
        "Longest Happy String": "longestDiverseString", "Car Pooling": "carPooling",
        "Find Median From Data Stream": "MedianFinder", "IPO": "findMaximizedCapital",
    },
    "backtracking": {
        "Sum of All Subsets XOR Total": "subsetXORSum", "Subsets": "subsets",
        "Combination Sum": "combinationSum", "Combination Sum II": "combinationSum2",
        "Combinations": "combine", "Permutations": "permute", "Subsets II": "subsetsWithDup",
        "Permutations II": "permuteUnique", "Generate Parentheses": "generateParenthesis",
        "Palindrome Partitioning": "partition",
        "Letter Combinations of a Phone Number": "letterCombinations",
        "Matchsticks to Square": "makesquare",
        "Partition to K Equal Sum Subsets": "canPartitionKSubsets",
        "N Queens": "solveNQueens", "N Queens II": "totalNQueens", "Word Break II": "wordBreakII",
    },
    "tries": {
        "Implement Trie Prefix Tree": "Trie",
        "Design Add And Search Words Data Structure": "WordDictionary",
        "Extra Characters in a String": "minExtraChar", "Word Search II": "findWords",
    },
    "graphs": {
        "Island Perimeter": "islandPerimeter", "Verifying An Alien Dictionary": "isAlienSorted",
        "Find the Town Judge": "findJudge", "Max Area of Island": "maxAreaOfIsland",
        "Clone Graph": "cloneGraph", "Walls And Gates": "wallsAndGates",
        "Pacific Atlantic Water Flow": "pacificAtlantic",
        "Surrounded Regions": "solveSurroundedRegions", "Open The Lock": "openLock",
        "Graph Valid Tree": "validTree", "Course Schedule IV": "checkIfPrerequisite",
        "Number of Connected Components In An Undirected Graph": "countComponents",
        "Redundant Connection": "findRedundantConnection", "Accounts Merge": "accountsMerge",
        "Evaluate Division": "calcEquation", "Minimum Height Trees": "findMinHeightTrees",
    },
    "advanced-graphs": {
        "Path with Minimum Effort": "minimumEffortPath", "Network Delay Time": "networkDelayTime",
        "Reconstruct Itinerary": "findItinerary",
        "Min Cost to Connect All Points": "minCostConnectPoints",
        "Swim In Rising Water": "swimInWater", "Alien Dictionary": "alienOrder",
        "Cheapest Flights Within K Stops": "findCheapestPrice",
        "Find Critical and Pseudo Critical Edges in Minimum Spanning Tree": "findCriticalAndPseudoCriticalEdges",
        "Build a Matrix With Conditions": "buildMatrix",
        "Greatest Common Divisor Traversal": "canTraverseAllPairs",
    },
    "dp-1d": {
        "Climbing Stairs": "climbStairs", "Min Cost Climbing Stairs": "minCostClimbingStairs",
        "N-th Tribonacci Number": "tribonacci", "House Robber": "rob", "House Robber II": "robCircle",
        "Longest Palindromic Substring": "longestPalindrome",
        "Palindromic Substrings": "countSubstrings", "Decode Ways": "numDecodings",
        "Coin Change": "coinChange", "Maximum Product Subarray": "maxProduct",
        "Word Break": "wordBreak", "Longest Increasing Subsequence": "lengthOfLIS",
        "Partition Equal Subset Sum": "canPartition", "Combination Sum IV": "combinationSum4",
        "Perfect Squares": "numSquares", "Integer Break": "integerBreak",
        "Stone Game III": "stoneGameIII",
    },
    "dp-2d": {
        "Unique Paths": "uniquePaths", "Unique Paths II": "uniquePathsWithObstacles",
        "Minimum Path Sum": "minPathSum", "Longest Common Subsequence": "longestCommonSubsequence",
        "Last Stone Weight II": "lastStoneWeightII",
        "Best Time to Buy And Sell Stock With Cooldown": "maxProfitWithCooldown",
        "Coin Change II": "change", "Target Sum": "findTargetSumWays",
        "Interleaving String": "isInterleave", "Stone Game": "stoneGame",
        "Stone Game II": "stoneGameII", "Longest Increasing Path In a Matrix": "longestIncreasingPath",
        "Distinct Subsequences": "numDistinct", "Edit Distance": "minDistance",
        "Burst Balloons": "maxCoins", "Regular Expression Matching": "isMatch",
    },
    "greedy": {
        "Lemonade Change": "lemonadeChange", "Maximum Subarray": "maxSubArray",
        "Maximum Sum Circular Subarray": "maxSubarraySumCircular",
        "Longest Turbulent Subarray": "maxTurbulenceSize", "Jump Game": "canJump",
        "Jump Game II": "jump", "Jump Game VII": "canReach", "Gas Station": "canCompleteCircuit",
        "Hand of Straights": "isNStraightHand", "Dota2 Senate": "predictPartyVictory",
        "Merge Triplets to Form Target Triplet": "mergeTriplets",
        "Partition Labels": "partitionLabels", "Valid Parenthesis String": "checkValidString",
        "Candy": "candy",
    },
    "intervals": {
        "Insert Interval": "insertInterval", "Merge Intervals": "mergeIntervals",
        "Non Overlapping Intervals": "eraseOverlapIntervals", "Meeting Rooms": "canAttendMeetings",
        "Meeting Rooms II": "minMeetingRooms", "Meeting Rooms III": "mostBooked",
        "Minimum Interval to Include Each Query": "minInterval",
    },
    "math-geometry": {
        "Excel Sheet Column Title": "convertToTitle",
        "Greatest Common Divisor of Strings": "gcdOfStrings",
        "Insert Greatest Common Divisors in Linked List": "insertGreatestCommonDivisors",
        "Transpose Matrix": "transpose", "Rotate Image": "rotateImage", "Spiral Matrix": "spiralOrder",
        "Set Matrix Zeroes": "setZeroes", "Happy Number": "isHappy", "Plus One": "plusOne",
        "Roman to Integer": "romanToInt", "Pow(x, n)": "myPow", "Multiply Strings": "multiplyStrings",
        "Detect Squares": "DetectSquares",
    },
    "bit-manipulation": {
        "Single Number": "singleNumber", "Number of 1 Bits": "hammingWeight",
        "Counting Bits": "countBits", "Add Binary": "addBinary", "Reverse Bits": "reverseBits",
        "Missing Number": "missingNumber", "Sum of Two Integers": "getSum",
        "Reverse Integer": "reverseInteger", "Bitwise AND of Numbers Range": "rangeBitwiseAnd",
        "Minimum Array End": "minEnd",
    },
}

# topics whose per-language implementations have passed tests
ENABLED_TOPICS = set(TOPIC_SYMBOLS)

TS_MODULE_NAMES = {"stack": "stackProblems", "dp_1d": "dp1d", "dp_2d": "dp2d"}


def _camel_module(snake_tid):
    if snake_tid in TS_MODULE_NAMES:
        return TS_MODULE_NAMES[snake_tid]
    head, *rest = snake_tid.split("_")
    return head + "".join(part.capitalize() for part in rest)


def snake_name(camel):
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", camel)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", "_", s)
    return s.lower()


def _symbol_specs(symbol, keys):
    pyk, cppk, rsk, tsk, gok, swk = keys
    if symbol[0].isupper():  # a design-problem class
        return {
            "python": [("pyclass", pyk, symbol)],
            "cpp": [("blockre", cppk, rf"^class {symbol}\b")],
            "rust": [("block", rsk, f"pub struct {symbol}"), ("block", rsk, f"impl {symbol}")],
            "typescript": [("block", tsk, f"export class {symbol}")],
            "go": [("between", gok, f"// section: {symbol}", f"// endsection: {symbol}")],
            "swift": [("block", swk, f"class {symbol}")],
        }
    sn = snake_name(symbol)
    return {
        "python": [("pydef", pyk, sn)],
        "cpp": [("blockre", cppk, rf"^\S.*\b{symbol}\(")],
        "rust": [("block", rsk, f"pub fn {sn}(")],
        "typescript": [("block", tsk, f"export function {symbol}(")],
        "go": [("block", gok, f"func {symbol}(")],
        "swift": [("block", swk, f"func {symbol}(")],
    }


def _register_topic_sources():
    for tid in TOPIC_SYMBOLS:
        m = tid.replace("-", "_")
        SOURCES[f"py_{m}"] = ALGO / "python" / "neetcode" / f"{m}.py"
        SOURCES[f"cpp_{m}"] = ALGO / "cpp" / "tests" / f"{m}_tests.cpp"
        SOURCES[f"rs_{m}"] = ALGO / "rust" / "src" / f"{m}.rs"
        SOURCES[f"ts_{m}"] = ALGO / "typescript" / "src" / f"{_camel_module(m)}.ts"
        SOURCES[f"go_{m}"] = ALGO / "golang" / "neetcode" / m / f"{m}.go"
        SOURCES[f"sw_{m}"] = ALGO / "swift" / "neetcode" / f"{m}.swift"


def _build_topic_solutions():
    for tid in ENABLED_TOPICS:
        m = tid.replace("-", "_")
        keys = (f"py_{m}", f"cpp_{m}", f"rs_{m}", f"ts_{m}", f"go_{m}", f"sw_{m}")
        for name, symbols in TOPIC_SYMBOLS[tid].items():
            if isinstance(symbols, str):
                symbols = [symbols]
            merged = {lang: [] for lang, _ in LANG_LABELS}
            for sym in symbols:
                for lang, parts in _symbol_specs(sym, keys).items():
                    merged[lang].extend(parts)
            SOLUTIONS[name] = merged


_register_topic_sources()
_build_topic_solutions()


def render_code_tabs(code_cfg):
    buttons = []
    pres = []
    for lang, label in LANG_LABELS:
        active = " class=\"active\"" if lang == "python" else ""
        buttons.append(f'              <button data-lang="{lang}"{active}>{label}</button>')
        code = html.escape(snippet(code_cfg[lang]), quote=False)
        pre_active = " active" if lang == "python" else ""
        pres.append(
            f'            <pre data-lang="{lang}" class="lang{pre_active}">'
            f'<code class="language-{lang}">{code}\n</code></pre>'
        )
    return (
        '          <div class="code-tabs">\n'
        '            <div class="lang-row">\n' + "\n".join(buttons) + "\n            </div>\n"
        + "\n".join(pres) + "\n          </div>"
    )


def render_traversal():
    toc = "\n".join(
        f'            <li><a href="#{v["id"]}">{html.escape(v["title"])}</a></li>'
        for v in VARIANTS
    )
    body = []
    for i, v in enumerate(VARIANTS):
        prose = "\n".join(f"          <p>{p}</p>" for p in v["prose"])
        body.append(f"""          <h2 id="{v['id']}">{i + 1}. {html.escape(v['title'])}</h2>
          <p class="quiet">{html.escape(v['ref'])}</p>
{prose}
          <div class="takeaway"><strong>Memory hook:</strong> {html.escape(v['hook'])}</div>
{render_code_tabs(v['code'])}""")
    body_html = "\n".join(body)

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Graph traversal in six languages · Stanley Jacob</title>
    <meta name="description" content="The twelve canonical BFS and DFS variants, each implemented in Python, C++, Rust, TypeScript, Go, and Swift and verified by unit tests: level order, grid BFS, multi-source, bidirectional, Kahn's, 0-1 BFS, flood fill, cycle detection, topological sort, postorder trees, and grid backtracking." />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="{FAVICON}" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
  </head>
  <body>
{NAV}
    <header class="hero">
      <div class="wrap">
        <div class="eyebrow"><a href="/algorithms">← Algorithms</a></div>
        <h1>Graph traversal in six languages</h1>
        <p class="meta">Algorithms · graphs · Jun 2026</p>
      </div>
    </header>
    <section style="padding-top: 0">
      <div class="wrap">
        <article class="prose article">
          <p>Breadth-first and depth-first search are two skeletons that between them solve most of
          the graph problems in an interview loop. Each section below takes one canonical variant,
          explains what single knob it turns on the base skeleton, and shows the same implementation
          in Python, C++, Rust, TypeScript, Go, and Swift. The tabs remember your language across
          snippets and visits. Every function is lifted verbatim from a repository where it runs against the
          official LeetCode examples plus the edge cases that actually get submissions rejected, so
          the code on this page is the code that passed.</p>
          <p>The BFS skeleton never changes: seed a queue, mark nodes visited as they are enqueued,
          then pop, expand, and push until empty. The variants change exactly one thing each, namely
          what seeds the queue, what counts as an edge, or what the queue itself is. DFS variants
          turn two different knobs: what marking means, whether a permanent flag, a three-state
          color, or a temporary mark that gets undone, and where the answer is computed, on the way
          down or combined on the way back up.</p>
          <ul>
{toc}
          </ul>
{body_html}
          <h2 id="references">Where the code lives</h2>
          <p>The implementations and their test suites live in a local interview-prep repository,
          with the Python versions under <code>python/graph_traversal/</code>, C++ as a
          self-contained assert suite, Rust as a library module with inline tests, TypeScript
          checked by both ts-node assertions and the compiler, Go as a package with go test
          suites, and Swift compiled and asserted against the same cases. The longer written
          treatment of each variant, including the naive baselines and follow-up questions, is in the
          <a href="/software/algorithms/bfs">BFS</a> and
          <a href="/software/algorithms/dfs">DFS</a> notes.</p>
        </article>
      </div>
    </section>
{FOOTER}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="/code-tabs.js"></script>
    <script>
      window.addEventListener("DOMContentLoaded", function () {{
        if (window.hljs) hljs.highlightAll();
      }});
    </script>
  </body>
</html>
"""


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main():
    topics = parse_checklist()
    descriptions = load_descriptions()
    all_names = [p[0] for _, ps in topics for p in ps]
    missing = [n for n in all_names if n not in descriptions]
    if missing:
        print(f"warning: {len(missing)} problems lack descriptions (hook fallback), e.g. {missing[:3]}")
    unknown = [n for n in SOLUTIONS if n not in all_names]
    if unknown:
        raise SystemExit(f"SOLUTIONS names not in checklist: {unknown}")

    out_index = SITE / "algorithms" / "index.html"
    write(out_index, render_index(topics, descriptions))
    print(f"wrote {out_index} ({len(all_names)} problems, {len(topics)} topics)")

    for i, (topic, problems) in enumerate(topics):
        tid = TOPIC_META[topic][0]
        out = SITE / "algorithms" / tid / "index.html"
        write(out, render_topic_page(i, topic, problems, descriptions))
    n_solved = sum(1 for n in all_names if n in SOLUTIONS)
    print(f"wrote {len(topics)} topic pages ({n_solved} problems with {len(LANG_LABELS)}-language solutions)")

    out_trav = SITE / "algorithms" / "graph-traversal" / "index.html"
    write(out_trav, render_traversal())
    print(f"wrote {out_trav} ({len(VARIANTS)} variants x {len(LANG_LABELS)} languages)")


if __name__ == "__main__":
    main()
