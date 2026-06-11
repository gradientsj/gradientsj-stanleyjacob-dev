"""One-shot: insert the Algorithms nav link before the Systems link on every page."""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
count = 0
for f in root.rglob("*.html"):
    text = f.read_text(encoding="utf-8")
    if 'href="/algorithms"' in text or 'href="/systems"' not in text:
        continue
    new = re.sub(
        r'(?m)^([ \t]*)(<a href="/systems")',
        r'\1<a href="/algorithms">Algorithms</a>\n\1\2',
        text,
        count=1,
    )
    if new != text:
        with open(f, "w", encoding="utf-8", newline="") as out:
            out.write(new)
        count += 1
print("updated", count, "pages")
