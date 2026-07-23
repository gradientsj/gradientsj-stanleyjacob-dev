"""Validate coursework pages against classes/AUTHORING.md.

    python tools/check_classes.py            # all pages
    python tools/check_classes.py <slug> ... # specific pages

Exits nonzero if any ERROR is found. Warnings do not fail the run but are
worth reading. The course-reference check is the important one: those pages
must be anchored on textbooks and papers, never on a syllabus.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLASSES = ROOT / "classes"

# Phrases that would leak the course scaffolding the pages must not mention.
FORBIDDEN = [
    (r"\b(?:CS|EE|CME|MS&E|STATS?|MATH|ECE)\s?[-–]?\s?\d{2,3}[A-Z]?\b", "course number"),
    (r"\b1[08]-\d{3}\b", "course number"),
    (r"\bthis (?:course|class|quarter|semester)\b", "course reference"),
    (r"\b(?:problem set|pset|homework \d|assignment \d)\b", "assignment reference"),
    (r"\b(?:lecture|lectures)\s+\d+\b", "lecture reference"),
    (r"\bin lecture\b", "lecture reference"),
    (r"\b(?:midterm|final exam)\b", "exam reference"),
    (r"\b(?:syllabus|course notes|course website|teaching assistant|office hours)\b",
     "course reference"),
    (r"\bthe instructor\b", "course reference"),
    (r"\bProfessor\s+[A-Z]", "professor reference"),
]
# Institution names are deliberately NOT forbidden: attributing a result or a
# project to the group that produced it ("Berkeley's Gemmini", "a line of work
# at ETH Zurich") is exactly the cross-referencing these pages are meant to do.
# Only the scaffolding of a taught course is off limits. The one exception is
# the owner's own school, which is warned about below because attribution there
# can read as a course tell rather than as a citation.
SOFT = [(r"\bStanford\b", "owner's school named; make sure this reads as "
                          "research attribution, not a course reference")]

REQUIRED_SCRIPTS = [
    "/classes/math.js",
    "/code-tabs.js",
    "/quiz.js",
    "/code-copy.js",
]

LANG_TO_CODECLASS = {
    "pytorch": "language-python", "jax": "language-python", "python": "language-python",
    "triton": "language-python", "cpp": "language-cpp", "c": "language-cpp",
    "cuda": "language-cpp", "rust": "language-rust", "go": "language-go",
    "typescript": "language-typescript", "swift": "language-swift",
    "sql": "language-sql", "bash": "language-bash", "javascript": "language-javascript",
}


def check(path):
    errors, warns = [], []
    html = path.read_text(encoding="utf-8")
    slug = path.parent.name

    # strip the references list before the forbidden-phrase scan: paper titles
    # legitimately contain things like "18-789" only rarely, but author
    # affiliations and venue names are fine there.
    body = re.sub(r'<ol class="refs">.*?</ol>', "", html, flags=re.S)

    for pat, why in FORBIDDEN:
        for m in re.finditer(pat, body, flags=re.I if "lecture" in why or "course" in why else 0):
            ctx = body[max(0, m.start() - 60): m.end() + 60].replace("\n", " ")
            errors.append(f"{why}: {m.group(0)!r} ... {ctx.strip()[:140]}")

    for pat, why in SOFT:
        n = len(re.findall(pat, body))
        if n:
            warns.append(f"{why} ({n} occurrence(s))")

    # required plumbing
    for s in REQUIRED_SCRIPTS:
        if s not in html:
            errors.append(f"missing script tag: {s}")
    if '<a href="/classes" class="active">Classes</a>' not in html:
        errors.append("nav is missing the active Classes link")
    if '<article class="prose article">' not in html:
        errors.append('missing <article class="prose article">')
    if "<h1>" not in html:
        errors.append("missing <h1>")

    # code tabs: every pre has data-lang, and a matching button exists
    for block in re.findall(r'<div class="code-tabs">(.*?)</div>\s*(?=<)', html, flags=re.S):
        pass  # structural nesting varies; check globally instead
    pres = re.findall(r'<pre([^>]*)>', html)
    for attrs in pres:
        if "code-tabs" in html and "data-lang" in attrs:
            lang = re.search(r'data-lang="([^"]+)"', attrs)
            if lang and lang.group(1) not in LANG_TO_CODECLASS:
                errors.append(f"unknown data-lang: {lang.group(1)}")
    n_pre_tabs = len(re.findall(r'<pre[^>]*data-lang=', html))
    n_buttons = len(re.findall(r'<button data-lang=', html))
    if n_pre_tabs and n_buttons < n_pre_tabs:
        warns.append(f"{n_pre_tabs} tabbed <pre> but only {n_buttons} buttons")

    # code class matches the tab language
    for m in re.finditer(r'<pre[^>]*data-lang="([^"]+)"[^>]*>\s*<code class="([^"]+)"', html):
        want = LANG_TO_CODECLASS.get(m.group(1))
        if want and want not in m.group(2):
            warns.append(f'data-lang="{m.group(1)}" has <code class="{m.group(2)}"> (expected {want})')

    # quiz JSON parses
    quizzes = re.findall(
        r'<script type="application/json" class="quiz-data">(.*?)</script>', html, flags=re.S)
    if not quizzes:
        errors.append("no quiz block")
    for q in quizzes:
        try:
            data = json.loads(q)
        except json.JSONDecodeError as e:
            errors.append(f"quiz JSON does not parse: {e}")
            continue
        if len(data) < 6:
            warns.append(f"quiz has only {len(data)} questions (spec asks 8-12)")
        for item in data:
            for k in ("id", "qtype", "stem", "options", "correctIndex", "explanation"):
                if k not in item:
                    errors.append(f"quiz item missing {k}: {item.get('id', '?')}")
            if item.get("qtype") in ("mcq", "truefalse"):
                ci = item.get("correctIndex", -1)
                if not (0 <= ci < len(item.get("options", []))):
                    errors.append(f"quiz {item.get('id')}: correctIndex out of range")

    # content depth
    n_problems = len(re.findall(r'<div class="problem">', html))
    if n_problems < 4:
        errors.append(f"only {n_problems} .problem blocks (spec requires 4+)")
    if '<div class="takeaway">' not in html:
        errors.append("missing .takeaway")
    n_refs = len(re.findall(r'<ol class="refs">.*?</ol>', html, flags=re.S))
    if not n_refs:
        errors.append("missing <ol class=\"refs\">")
    else:
        refs = re.search(r'<ol class="refs">(.*?)</ol>', html, flags=re.S).group(1)
        n_items = len(re.findall(r"<li>", refs))
        if n_items < 12:
            warns.append(f"only {n_items} references (spec asks 12-25)")

    lines = html.count("\n") + 1
    if lines < 900:
        warns.append(f"only {lines} lines (spec targets 1200-2200)")

    # math present
    if "$$" not in html and "\\(" not in html:
        warns.append("no KaTeX math found")

    # unescaped angle brackets inside code blocks are a common breakage
    for m in re.finditer(r"<code[^>]*>(.*?)</code>", html, flags=re.S):
        inner = m.group(1)
        if re.search(r"<(?!/?span\b)[a-zA-Z/]", inner):
            warns.append("possible unescaped '<' inside a <code> block")
            break

    return slug, lines, errors, warns


def main():
    targets = sys.argv[1:]
    paths = []
    if targets:
        paths = [CLASSES / t / "index.html" for t in targets]
    else:
        paths = sorted(p for p in CLASSES.glob("*/index.html"))

    total_err = 0
    for p in paths:
        if not p.exists():
            print(f"MISSING  {p.relative_to(ROOT)}")
            total_err += 1
            continue
        slug, lines, errors, warns = check(p)
        status = "OK   " if not errors else "FAIL "
        print(f"{status} {slug}  ({lines} lines)")
        for e in errors:
            print(f"    ERROR  {e}")
        for w in warns:
            print(f"    warn   {w}")
        total_err += len(errors)

    print(f"\n{len(paths)} page(s), {total_err} error(s)")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main())
