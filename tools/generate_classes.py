"""Render classes/index.html from the taxonomy in tools/classes_data.py.

Re-run after adding or editing entries:  python tools/generate_classes.py
Pages that do not exist yet render as plain rows rather than links, so the
index is always honest about what has been written.
"""

import html
import pathlib

from classes_data import GROUPS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "classes" / "index.html"

NAV = """    <nav class="top">
      <div class="inner">
        <div class="brand"><a href="/">Stanley Jacob</a></div>
        <div class="links">
          <a href="/ai">AI</a>
          <a href="/robotics">Robotics</a>
          <a href="/software">Software</a>
          <a href="/classes" class="active">Classes</a>
          <a href="/algorithms">Algorithms</a>
          <a href="/systems">Systems</a>
          <a href="/ml">ML</a>
          <a href="/rl">RL</a>
          <a href="/oss">Open source</a>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </nav>
"""

FOOTER = """    <footer class="site">
      <div class="inner">
        <span>&copy; <span id="yr">2026</span> Stanley Jacob</span>
        <span>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
          &nbsp;&middot;&nbsp; <a href="mailto:stanleyjacobai@gmail.com">stanleyjacobai@gmail.com</a>
        </span>
      </div>
    </footer>
    <script>
      document.getElementById("yr").textContent = new Date().getFullYear();
    </script>
  </body>
</html>
"""

DESC = (
    "Long-form coursework write-ups across machine learning, systems, "
    "architecture, algorithms, graphics, and robotics: the math derived step by "
    "step, worked problems, and reference implementations in PyTorch and JAX."
)


def e(s):
    return html.escape(s, quote=False)


def is_complete(slug):
    """A page counts as live only once it is finished.

    Authoring can be interrupted, leaving a partial file on disk. Those must not
    be linked from the index, so completeness is judged by the markers that only
    appear in a finished page: the reference list and the closing takeaway.
    """
    p = ROOT / "classes" / slug / "index.html"
    if not p.exists():
        return False
    src = p.read_text(encoding="utf-8")
    return '<ol class="refs">' in src and '<div class="takeaway">' in src


def row(article, exists):
    tags = " &middot; ".join(e(t) for t in article.get("tags", []))
    title = e(article["title"])
    blurb = e(article["blurb"])
    if exists:
        head = f'<a href="/classes/{article["slug"]}">{title}</a>'
    else:
        head = f'<span class="pending">{title}</span>'
    return (
        f'          <li><div class="prob">{head}'
        f'<p class="trick">{blurb}</p></div>'
        f'<span class="date">{tags}</span></li>'
    )


def main():
    written = 0
    total = 0
    parts = []
    for i, g in enumerate(GROUPS):
        shade = ' class="soft"' if i % 2 == 0 else ""
        rows = []
        for a in g["articles"]:
            total += 1
            exists = is_complete(a["slug"])
            written += exists
            rows.append(row(a, exists))
        parts.append(
            f"""    <section{shade} id="{g['id']}">
      <div class="wrap">
        <div class="section-head">
          <h2>{e(g['name'])}</h2>
          <p>{e(g['intro'])}</p>
        </div>
        <ul class="notes tricks">
{chr(10).join(rows)}
        </ul>
      </div>
    </section>
"""
        )

    jump = "\n".join(
        f'            <a href="#{g["id"]}">{e(g["name"])}</a>' for g in GROUPS
    )

    featured = next(
        (a for _, a in ((g, a) for g in GROUPS for a in g["articles"]) if a.get("featured")),
        None,
    )
    card = ""
    if featured and is_complete(featured["slug"]):
        card = f"""        <a class="article-card" href="/classes/{featured['slug']}">
          <span class="k">Featured write-up</span>
          <h3>{e(featured['title'])}</h3>
          <p>{e(featured['blurb'])}</p>
          <span class="article-cta">Read the write-up &rarr;</span>
        </a>
"""

    doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Classes &middot; Stanley Jacob</title>
    <meta name="description" content="{e(DESC)}" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%231d1d1f'/%3E%3Ctext x='50' y='70' font-size='52' font-weight='600' text-anchor='middle' font-family='-apple-system,Helvetica,Arial,sans-serif' fill='%23ffffff'%3Esj%3C/text%3E%3C/svg%3E" />
  </head>
  <body>
{NAV}
    <header class="hero">
      <div class="wrap">
        <h1>Classes</h1>
        <p class="lead">
          Long-form write-ups of the coursework I have worked through, rebuilt
          around what the field looks like now rather than what a syllabus
          covered when I sat in the room. Each page states the problem, derives
          the math step by step in full notation, works representative problems
          by hand, and implements the result in PyTorch and JAX side by side,
          with C++, Rust, and CUDA where the subject calls for it. Where a claim
          is about performance, the number comes from a benchmark run on an
          H100 in this repository rather than from memory. The references are
          textbooks and papers, and every page ends with the open-source
          repositories worth reading and a short self-check quiz.
        </p>
        <div class="jump">
{jump}
        </div>
{card}      </div>
    </header>

{''.join(parts)}
{FOOTER}"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(doc, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {written}/{total} articles live")


if __name__ == "__main__":
    main()
