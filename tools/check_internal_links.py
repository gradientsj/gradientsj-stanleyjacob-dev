"""Check root-relative links and assets across the static site.

Usage:
    python tools/check_internal_links.py [root]   # defaults to repository root
"""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attr in ("href", "src"):
            value = values.get(attr)
            if value and value.startswith("/") and not value.startswith("//"):
                self.refs.append((self.getpos()[0], attr, value))


def target_for(root: Path, raw: str) -> Path | None:
    path = unquote(urlsplit(raw).path)
    candidate = root / path.lstrip("/")
    if path.endswith("/"):
        return candidate / "index.html"
    if candidate.is_file():
        return candidate
    index = candidate / "index.html"
    if index.is_file():
        return index
    return candidate


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors = []
    checked = 0
    for page in sorted(root.rglob("*.html")):
        parser = References()
        parser.feed(page.read_text(encoding="utf-8"))
        for line, attr, raw in parser.refs:
            target = target_for(root, raw)
            checked += 1
            if target is not None and not target.exists():
                errors.append(f"{page.relative_to(root)}:{line}: {attr}={raw} -> missing")

    for error in errors:
        print(error)
    print(f"{checked} internal references checked; {len(errors)} missing")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
