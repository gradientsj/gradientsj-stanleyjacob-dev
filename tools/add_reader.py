#!/usr/bin/env python3
"""Add the read-aloud widget and reader.js include to the ml/ article pages.

The ai/ pages already carry `<div class="reader" data-reader data-audio=...>`
and the reader.js script; the ml/ concept articles do not. This injects both,
matching the existing pattern, and is idempotent so it can be re-run safely.
Skips ml/index.html (a section hub, not an article).
"""
import glob
import os
import sys

READER_DIV = '          <div class="reader" data-reader data-audio="listen.mp3"></div>\n'
ARTICLE_OPEN = '<article class="prose article">'
THEME_JS = '<script defer src="/theme.js"></script>'
READER_JS = '<script defer src="/reader.js"></script>'


def process(path):
    with open(path, encoding="utf-8") as f:
        html = f.read()
    if "data-reader" in html:
        return "already-has-reader"
    if ARTICLE_OPEN not in html:
        return "no-article-tag"

    # widget as the first child of the article, on its own line
    marker = ARTICLE_OPEN + "\n"
    if marker in html:
        html = html.replace(marker, marker + READER_DIV, 1)
    else:
        html = html.replace(ARTICLE_OPEN, ARTICLE_OPEN + "\n" + READER_DIV, 1)

    # load reader.js just before theme.js (defer keeps order irrelevant, but
    # this mirrors the ai/ pages)
    if READER_JS not in html:
        indent = ""
        for line in html.splitlines():
            if THEME_JS in line:
                indent = line[: line.index("<")]
                break
        html = html.replace(THEME_JS, READER_JS + "\n" + indent + THEME_JS, 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return "added"


def main():
    pages = sorted(glob.glob("ml/*/index.html"))
    pages = [p for p in pages if p != "ml/index.html"]
    counts = {}
    for p in pages:
        r = process(p)
        counts[r] = counts.get(r, 0) + 1
        print(f"  {r:20s} {p}")
    print("summary:", counts)


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(__file__), ".."))
    main()
