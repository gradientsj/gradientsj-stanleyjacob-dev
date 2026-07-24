#!/usr/bin/env python3
"""Insert the FPGA nav link into every page's top nav, after Systems.

Idempotent: skips any file that already has an FPGA nav link. Scoped to the
nav by anchoring on the Systems anchor, which only appears in the nav bar.
"""
import glob
import re
import os

SYSTEMS_RE = re.compile(r'(<a href="/systems"[^>]*>Systems</a>)')
INSERT = '\n          <a href="/fpga">FPGA</a>'


def main():
    files = glob.glob("**/*.html", recursive=True)
    changed = skipped = noNav = 0
    for f in files:
        html = open(f, encoding="utf-8").read()
        if ">FPGA</a>" in html:
            skipped += 1
            continue
        if not SYSTEMS_RE.search(html):
            noNav += 1
            continue
        html = SYSTEMS_RE.sub(r"\1" + INSERT, html, count=1)
        open(f, "w", encoding="utf-8").write(html)
        changed += 1
    print(f"changed={changed} skipped(has-fpga)={skipped} no-nav={noNav} total={len(files)}")


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    main()
