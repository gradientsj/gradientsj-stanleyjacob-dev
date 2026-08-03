"""Insert the Classes nav link before the Algorithms link on every page.

Idempotent: pages that already carry href="/classes" are skipped, so this is
safe to re-run after new pages are added.
"""

import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
count = 0
for f in root.rglob("*.html"):
    text = f.read_text(encoding="utf-8")
    if 'href="/classes"' in text or 'href="/algorithms"' not in text:
        continue
    new = re.sub(
        r'(?m)^([ \t]*)(<a href="/algorithms")',
        r'\1<a href="/classes">Classes</a>\n\1\2',
        text,
        count=1,
    )
    if new != text:
        with open(f, "w", encoding="utf-8", newline="") as out:
            out.write(new)
        count += 1
print("updated", count, "pages")
