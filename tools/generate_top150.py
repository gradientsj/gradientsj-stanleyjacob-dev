"""Generate /algorithms/top-interview-150 for stanleyjacob.dev.

Covers the 48 problems from LeetCode's Top Interview 150 study plan that the
NeetCode 250 topic pages do not already include. Solutions live in the local
interview-prep workspace (one file per problem per language); every file holds
an "approach ladder" — at least two implementations ordered from a naive or
instructive baseline up to the optimal one, each introduced by a dashed header:

    # ------------------------------------------------------------------
    # Approach 2: One-pass hash map — RECOMMENDED
    # Time:  O(n)   Space: O(n)
    # optional prose
    # ------------------------------------------------------------------

This script parses those headers, slices each approach's code, and renders one
.code-steps block per problem: one <pre> per (language, approach) pair, the
usual global language tabs, and a ‹ › stepper at the bottom right of the block
(approach-stepper.js) that walks the ladder naive -> optimal.

Reads:  $LEETCODE150_DIR, or ~/Desktop/leetcode_150
        tools/top150_blurbs.py (optional; per-problem prose paragraphs)
Writes: algorithms/top-interview-150/index.html

Run from the repo root, then bake highlighting:
    python3 tools/generate_top150.py
    node scripts/highlight.mjs algorithms/top-interview-150/index.html
"""

import html
import os
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parents[1]
SRC = pathlib.Path(
    os.environ.get("LEETCODE150_DIR", pathlib.Path.home() / "Desktop" / "leetcode_150")
)
OUT = SITE / "algorithms" / "top-interview-150" / "index.html"

LANG_LABELS = [
    ("python", "Python"), ("cpp", "C++"), ("rust", "Rust"),
    ("typescript", "TypeScript"), ("go", "Go"), ("swift", "Swift"),
]
LANG_DIR_EXT = {
    "python": ("python", "py"), "cpp": ("cpp", "cpp"), "rust": ("rust", "rs"),
    "typescript": ("typescript", "ts"), "go": ("go", "go"), "swift": ("swift", "swift"),
}

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E"
    "%3Crect width='100' height='100' rx='24' fill='%232B2621'/%3E%3Ctext x='50' y='70' "
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
          <a href="/classes">Classes</a>
          <a href="/algorithms" class="active">Algorithms</a>
          <a href="/systems">Systems</a>
          <a href="/ml">ML</a>
          <a href="/rl">RL</a>
          <a href="/oss">Open source</a>
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

# (LC number, title, file slug, difficulty) grouped by Top Interview 150 section,
# in study-plan order. Difficulties are the current official values.
SECTIONS = [
    ("Array / String", [
        (80, "Remove Duplicates from Sorted Array II", "remove_duplicates_from_sorted_array_ii", "Medium"),
        (274, "H-Index", "h_index", "Medium"),
        (380, "Insert Delete GetRandom O(1)", "insert_delete_getrandom_o1", "Medium"),
        (12, "Integer to Roman", "integer_to_roman", "Medium"),
        (58, "Length of Last Word", "length_of_last_word", "Easy"),
        (151, "Reverse Words in a String", "reverse_words_in_a_string", "Medium"),
        (6, "Zigzag Conversion", "zigzag_conversion", "Medium"),
        (28, "Find the Index of the First Occurrence in a String", "find_the_index_of_the_first_occurrence_in_a_string", "Easy"),
        (68, "Text Justification", "text_justification", "Hard"),
    ]),
    ("Two Pointers", [
        (392, "Is Subsequence", "is_subsequence", "Easy"),
    ]),
    ("Sliding Window", [
        (30, "Substring with Concatenation of All Words", "substring_with_concatenation_of_all_words", "Hard"),
    ]),
    ("Matrix", [
        (289, "Game of Life", "game_of_life", "Medium"),
    ]),
    ("Hashmap", [
        (383, "Ransom Note", "ransom_note", "Easy"),
        (205, "Isomorphic Strings", "isomorphic_strings", "Easy"),
        (290, "Word Pattern", "word_pattern", "Easy"),
    ]),
    ("Intervals", [
        (228, "Summary Ranges", "summary_ranges", "Easy"),
        (452, "Minimum Number of Arrows to Burst Balloons", "minimum_number_of_arrows_to_burst_balloons", "Medium"),
    ]),
    ("Stack", [
        (224, "Basic Calculator", "basic_calculator", "Hard"),
    ]),
    ("Linked List", [
        (82, "Remove Duplicates from Sorted List II", "remove_duplicates_from_sorted_list_ii", "Medium"),
        (61, "Rotate List", "rotate_list", "Medium"),
        (86, "Partition List", "partition_list", "Medium"),
    ]),
    ("Binary Tree General", [
        (101, "Symmetric Tree", "symmetric_tree", "Easy"),
        (106, "Construct Binary Tree from Inorder and Postorder Traversal", "construct_binary_tree_from_inorder_and_postorder_traversal", "Medium"),
        (117, "Populating Next Right Pointers in Each Node II", "populating_next_right_pointers_in_each_node_ii", "Medium"),
        (114, "Flatten Binary Tree to Linked List", "flatten_binary_tree_to_linked_list", "Medium"),
        (112, "Path Sum", "path_sum", "Easy"),
        (129, "Sum Root to Leaf Numbers", "sum_root_to_leaf_numbers", "Medium"),
        (173, "Binary Search Tree Iterator", "binary_search_tree_iterator", "Medium"),
        (222, "Count Complete Tree Nodes", "count_complete_tree_nodes", "Medium"),
        (236, "Lowest Common Ancestor of a Binary Tree", "lowest_common_ancestor_of_a_binary_tree", "Medium"),
    ]),
    ("Binary Tree BFS", [
        (637, "Average of Levels in Binary Tree", "average_of_levels_in_binary_tree", "Easy"),
        (103, "Binary Tree Zigzag Level Order Traversal", "binary_tree_zigzag_level_order_traversal", "Medium"),
    ]),
    ("Binary Search Tree", [
        (530, "Minimum Absolute Difference in BST", "minimum_absolute_difference_in_bst", "Easy"),
    ]),
    ("Graph BFS", [
        (909, "Snakes and Ladders", "snakes_and_ladders", "Medium"),
        (433, "Minimum Genetic Mutation", "minimum_genetic_mutation", "Medium"),
    ]),
    ("Divide and Conquer", [
        (108, "Convert Sorted Array to Binary Search Tree", "convert_sorted_array_to_binary_search_tree", "Easy"),
        (148, "Sort List", "sort_list", "Medium"),
    ]),
    ("Binary Search", [
        (162, "Find Peak Element", "find_peak_element", "Medium"),
        (34, "Find First and Last Position of Element in Sorted Array", "find_first_and_last_position_of_element_in_sorted_array", "Medium"),
    ]),
    ("Heap", [
        (373, "Find K Pairs with Smallest Sums", "find_k_pairs_with_smallest_sums", "Medium"),
    ]),
    ("Bit Manipulation", [
        (137, "Single Number II", "single_number_ii", "Medium"),
    ]),
    ("Math", [
        (9, "Palindrome Number", "palindrome_number", "Easy"),
        (172, "Factorial Trailing Zeroes", "factorial_trailing_zeroes", "Medium"),
        (149, "Max Points on a Line", "max_points_on_a_line", "Hard"),
    ]),
    ("Multidimensional DP", [
        (120, "Triangle", "triangle", "Medium"),
        (123, "Best Time to Buy and Sell Stock III", "best_time_to_buy_and_sell_stock_iii", "Hard"),
        (188, "Best Time to Buy and Sell Stock IV", "best_time_to_buy_and_sell_stock_iv", "Hard"),
        (221, "Maximal Square", "maximal_square", "Medium"),
    ]),
]


# ------------------------------------------------------- ladder parsing

DASH = re.compile(r"^\s*(?:#|//)\s?-{10,}\s*$")
COMMENT = re.compile(r"^\s*(?:#|//)")
APPROACH = re.compile(
    r"^\s*(?:#|//)\s?Approach\s+(\d+[a-z]?):\s+(.+?)"
    r"(?:\s+(?:—|--)\s?RECOMMENDED)?\s*$"
)
RECOMMENDED = re.compile(r"(?:—|--)\s?RECOMMENDED\s*$")
TIMESPACE = re.compile(r"^\s*(?:#|//)\s?Time:\s*(.+?)\s+Space:\s*(.+?)\s*$")
SENTINEL = re.compile(r"^\s*(?:#|//)\s?-{2,}\s?tests\s?-{2,}\s*$")
STRIP_LEADER = re.compile(r"^\s*(?:#|//)\s?")


def parse_ladder(text):
    """Return the ordered approach list for one solution file."""
    lines = text.splitlines()
    limit = len(lines)
    for i, line in enumerate(lines):
        if SENTINEL.match(line):
            limit = i
            break

    headers = []
    i = 0
    while i < limit:
        if DASH.match(lines[i]):
            j = i + 1
            while j < limit and COMMENT.match(lines[j]) and not DASH.match(lines[j]):
                j += 1
            if j < limit and DASH.match(lines[j]) and j > i + 1:
                m = APPROACH.match(lines[i + 1])
                if m:
                    time = space = ""
                    prose = []
                    for k in range(i + 2, j):
                        ts = TIMESPACE.match(lines[k])
                        if ts and not time:
                            time, space = ts.group(1), ts.group(2)
                        else:
                            prose.append(STRIP_LEADER.sub("", lines[k]))
                    headers.append({
                        "title": m.group(2).strip(),
                        "recommended": bool(RECOMMENDED.search(lines[i + 1].rstrip())),
                        "time": time, "space": space,
                        "prose": " ".join(p for p in prose if p.strip()).strip(),
                        "start": i, "end": j,
                    })
                i = j + 1
                continue
        i += 1

    approaches = []
    for idx, h in enumerate(headers):
        start = h["end"] + 1
        end = headers[idx + 1]["start"] if idx + 1 < len(headers) else limit
        code = lines[start:end]
        while code and not code[0].strip():
            code.pop(0)
        while code and not code[-1].strip():
            code.pop()
        if idx == len(headers) - 1:
            # The final slice may drag in the enclosing class/impl closer that
            # sits between the last method and the tests sentinel. Pop a bare
            # trailing } / }; only when it is shallower than the code above it
            # (a container's brace, never the function's own closer).
            def _indent(s):
                return len(s) - len(s.lstrip())
            while code and code[-1].strip() in ("}", "};"):
                above = [
                    c for c in code[:-1]
                    if c.strip() and c.strip() not in ("public:", "private:", "protected:")
                ]
                if not above or _indent(code[-1]) >= min(_indent(c) for c in above):
                    break
                code.pop()
                while code and not code[-1].strip():
                    code.pop()
        indents = [len(c) - len(c.lstrip()) for c in code if c.strip()]
        cut = min(indents) if indents else 0
        h["code"] = "\n".join(c[cut:] if c.strip() else "" for c in code)
        approaches.append(h)
    return approaches


# ------------------------------------------------------------ rendering

def lc_slug(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9 \-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    return s


def load_blurbs():
    try:
        sys.path.insert(0, str(SITE / "tools"))
        from top150_blurbs import BLURBS  # noqa: PLC0415
        return BLURBS
    except ImportError:
        return {}


def fallback_blurb(ladders):
    steps = next((l for l in ladders.values() if l), [])
    if len(steps) < 2:
        return ""
    walk = " up to ".join(
        html.escape(f"{a['title'].lower()} ({a['time']})", quote=False)
        for a in (steps[0], steps[-1])
    )
    return (
        f"{len(steps)} approaches, from {walk}. "
        f"{html.escape(steps[-1]['prose'], quote=False)}".strip()
    )


def render_problem(index, num, title, slug, diff, ladders, blurbs):
    anchor = lc_slug(title)
    lc_url = f"https://leetcode.com/problems/{anchor}/"
    blurb = blurbs.get(num) or fallback_blurb(ladders)

    buttons = []
    for lang, label in LANG_LABELS:
        if not ladders[lang]:
            continue
        active = ' class="active"' if lang == "python" else ""
        buttons.append(f'              <button data-lang="{lang}"{active}>{label}</button>')

    notes, pres = [], []
    for lang, _label in LANG_LABELS:
        for r, a in enumerate(ladders[lang], 1):
            attrs = (
                f'data-lang="{lang}" data-rung="{r}" '
                f'data-title="{html.escape(a["title"], quote=True)}" '
                f'data-time="{html.escape(a["time"], quote=True)}" '
                f'data-space="{html.escape(a["space"], quote=True)}"'
            )
            if a["recommended"]:
                attrs += ' data-rec="1"'
            if a["prose"]:
                note_active = " active" if lang == "python" and r == 1 else ""
                notes.append(
                    f'            <p class="approach-note{note_active}" data-lang="{lang}" '
                    f'data-rung="{r}">{html.escape(a["prose"])}</p>'
                )
            pre_active = " active" if lang == "python" and r == 1 else ""
            code = html.escape(a["code"], quote=False)
            pres.append(
                f'            <pre {attrs} class="lang{pre_active}">'
                f'<code class="language-{lang}">{code}\n</code></pre>'
            )

    # bake the initial (python, rung 1) state so the bar reads correctly pre-JS
    init_ladder = ladders["python"] or next((l for l in ladders.values() if l), [])
    first = init_ladder[0]
    init_label = html.escape(f"Approach 1 of {len(init_ladder)} · {first['title']}")
    init_comp = html.escape(f"{first['time']} time · {first['space']} space")
    next_off = "true" if len(init_ladder) < 2 else "false"

    return f"""          <h2 id="{anchor}">{index}. {html.escape(title)}</h2>
          <p class="quiet"><span class="diff-{diff.lower()}">{diff}</span> ·
            <a href="{lc_url}" target="_blank" rel="noreferrer">LC {num}</a></p>
          <p>{blurb}</p>
          <div class="code-tabs code-steps">
            <div class="lang-row">
{chr(10).join(buttons)}
            </div>
{chr(10).join(notes)}
{chr(10).join(pres)}
            <div class="approach-bar">
              <span class="approach-badge">Recommended</span>
              <span class="approach-meta" role="status" aria-live="polite"><span class="approach-label">{init_label}</span><span class="approach-comp">{init_comp}</span></span>
              <span class="approach-nav">
                <button type="button" class="step-prev" aria-label="Previous approach" aria-disabled="true">‹</button>
                <button type="button" class="step-next" aria-label="Next approach" aria-disabled="{next_off}">›</button>
              </span>
            </div>
          </div>"""


def main():
    lenient = "--lenient" in sys.argv
    if not SRC.is_dir():
        raise SystemExit(f"solutions dir not found: {SRC} (set LEETCODE150_DIR)")

    blurbs = load_blurbs()
    problems = 0
    errors = []
    body = []
    toc = []
    index = 0

    for section, entries in SECTIONS:
        first_anchor = lc_slug(entries[0][1])
        toc.append(
            f'            <li><a href="#{first_anchor}">{html.escape(section)}</a>'
            f' <span class="quiet">({len(entries)})</span></li>'
        )
        body.append(f'          <h3 class="section-mark">{html.escape(section)}</h3>')
        for num, title, slug, diff in entries:
            index += 1
            ladders = {}
            for lang, (d, ext) in LANG_DIR_EXT.items():
                path = SRC / d / f"{slug}.{ext}"
                if not path.is_file():
                    errors.append(f"missing file: {path}")
                    ladders[lang] = []
                    continue
                ladder = parse_ladder(path.read_text(encoding="utf-8"))
                if len(ladder) < 2:
                    errors.append(f"{path}: {len(ladder)} approach(es), expected >= 2")
                ladders[lang] = ladder
            if any(not v for v in ladders.values()):
                if not lenient:
                    continue
            problems += 1
            body.append(render_problem(index, num, title, slug, diff, ladders, blurbs))

    if errors and not lenient:
        for e in errors:
            print(f"ERROR {e}", file=sys.stderr)
        raise SystemExit(f"{len(errors)} ladder error(s); fix or rerun with --lenient")

    total = sum(len(e) for _s, e in SECTIONS)
    page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Top Interview 150 · Algorithms · Stanley Jacob</title>
    <meta name="description" content="The {problems} problems from LeetCode's Top Interview 150 that the NeetCode 250 pages don't already cover: every approach from brute force to optimal, in Python, C++, Rust, TypeScript, Go, and Swift." />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="{FAVICON}" />
      <script>(function(){{try{{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}}catch(e){{}}}})();</script>
  </head>
  <body>
{NAV}
    <header class="hero">
      <div class="wrap">
        <div class="eyebrow"><a href="/algorithms">← Algorithms</a></div>
        <h1>Top Interview 150</h1>
        <p class="meta">{problems} problems · six languages · every approach from naive to optimal</p>
        <p class="lead">The NeetCode 250 topic pages already cover most of LeetCode's Top Interview 150 study plan; these are the {problems} problems they miss. Each one is solved in Python, C++, Rust, TypeScript, Go, and Swift, and every solution is an approach ladder: it starts from a naive or instructive baseline and rebuilds toward the optimal answer. The tabs switch language everywhere at once; the ‹ › control at the bottom right of each code block steps through the ladder, and each implementation is published only after passing unit tests against the official LeetCode examples.</p>
      </div>
    </header>
    <section style="padding-top: 0">
      <div class="wrap">
        <article class="prose article">
          <ul class="toc">
{chr(10).join(toc)}
          </ul>
{chr(10).join(body)}
        </article>
      </div>
    </section>
{FOOTER}
    <script src="/approach-stepper.js"></script>
    <script defer src="/reader.js"></script>
    <script defer src="/code-copy.js"></script>
    <script defer src="/theme.js"></script>
  </body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    slices = page.count("<pre ")
    print(f"wrote {OUT.relative_to(SITE)}: {problems}/{total} problems, {slices} code slices"
          + (f", {len(errors)} ladder errors tolerated" if errors else ""))


if __name__ == "__main__":
    main()
