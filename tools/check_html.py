"""Structural checks the content validator cannot see: tag nesting and math
delimiter balance.

    python tools/check_html.py [dir]     # defaults to classes/

Mismatched tags usually render as a subtly broken layout rather than an error,
and an odd number of `$$` makes KaTeX swallow the rest of the page, so both
failure modes are silent in a browser. Run this before every push.
"""

import pathlib
import re
import sys
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "source", "track", "wbr"}


class Nesting(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []
        self.err = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.err.append(f"stray </{tag}> at line {self.getpos()[0]}")
            return
        if self.stack[-1][0] != tag:
            top, line = self.stack[-1]
            self.err.append(
                f"</{tag}> at line {self.getpos()[0]} closes <{top}> opened at line {line}")
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    break
        else:
            self.stack.pop()


def check(path):
    src = path.read_text(encoding="utf-8")
    msgs = []

    p = Nesting()
    p.feed(src)
    if p.stack:
        msgs.append(f"unclosed tags: {p.stack[:4]}")
    msgs.extend(p.err[:4])

    # math delimiters, ignoring code and script bodies where KaTeX never looks
    body = re.sub(r"<(script|pre|code)\b.*?</\1>", "", src, flags=re.S)
    if body.count("$$") % 2:
        msgs.append(f"odd number of $$ delimiters ({body.count('$$')})")
    opens = len(re.findall(r"\\\(", body))
    closes = len(re.findall(r"\\\)", body))
    if opens != closes:
        msgs.append(f"inline math unbalanced: {opens} '\\(' vs {closes} '\\)'")

    return msgs


def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "classes")
    bad = 0
    for f in sorted(root.glob("*/index.html")):
        msgs = check(f)
        print(("OK   " if not msgs else "FAIL ") + f.parent.name + "  " + "; ".join(msgs))
        bad += bool(msgs)
    print(f"\n{bad} file(s) with structural problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
