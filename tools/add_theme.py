#!/usr/bin/env python3
"""Idempotently add the theme system to every HTML page.

Two insertions per page:
  1. An anti-FOUC init script just before </head> that reads the saved theme
     from localStorage and sets data-theme before first paint. The site
     defaults to dark; only a stored "light"/"dark" overrides it.
  2. A deferred include of /theme.js just before </body>, which builds the
     nav toggle.

Run from the repo root after all pages exist:

    python tools/add_theme.py
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

INIT = (
    '<script>(function(){try{var t=localStorage.getItem("theme");'
    'if(t==="light"||t==="dark")document.documentElement.setAttribute'
    '("data-theme",t);}catch(e){}})();</script>'
)
INCLUDE = '<script defer src="/theme.js"></script>'

INIT_MARK = 'localStorage.getItem("theme")'
INCLUDE_MARK = 'src="/theme.js"'

SKIP_DIRS = {".git", "node_modules", "tools", "scripts"}


def process(path: pathlib.Path) -> bool:
    html = path.read_text(encoding="utf-8")
    orig = html

    if INIT_MARK not in html and "</head>" in html:
        html = html.replace("</head>", "    " + INIT + "\n  </head>", 1)

    if INCLUDE_MARK not in html and "</body>" in html:
        html = html.replace("</body>", "    " + INCLUDE + "\n  </body>", 1)

    if html != orig:
        path.write_text(html, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    total = 0
    for path in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        total += 1
        if process(path):
            changed += 1
    print(f"theme system: updated {changed} of {total} html files")


if __name__ == "__main__":
    main()
