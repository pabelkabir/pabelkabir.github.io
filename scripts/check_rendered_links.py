#!/usr/bin/env python3
"""Check rendered local links and media references in docs/."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SKIP_SCHEMES = {"http", "https", "mailto", "tel", "data", "javascript"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[tuple[str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        for attr in ("href", "src"):
            if data.get(attr):
                self.refs.append((attr, data[attr]))
        if data.get("id"):
            self.ids.add(data["id"])


def resolve_file(base: Path, ref: str) -> Path | None:
    parsed = urlparse(ref)
    if parsed.scheme in SKIP_SCHEMES or ref.startswith("#"):
        return None
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    if raw_path.startswith("/"):
        target = DOCS / raw_path.lstrip("/")
    else:
        target = (base.parent / raw_path).resolve()
    if raw_path.endswith("/"):
        target = target / "index.html"
    return target


def main() -> int:
    if not DOCS.exists():
        print("docs/ does not exist", file=sys.stderr)
        return 1
    errors: list[str] = []
    for path in sorted(DOCS.rglob("*.html")):
        parser = LinkParser()
        text = path.read_text(encoding="utf-8", errors="replace")
        parser.feed(text)
        for attr, ref in parser.refs:
            parsed = urlparse(ref)
            if ref.startswith("#") and ref[1:] and ref[1:] not in parser.ids:
                errors.append(f"{path.relative_to(ROOT)}: broken fragment {ref}")
                continue
            target = resolve_file(path, ref)
            if target is None:
                continue
            if parsed.fragment and target == path and parsed.fragment not in parser.ids:
                errors.append(f"{path.relative_to(ROOT)}: broken fragment {ref}")
            if not target.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing local {attr} target {ref}")
    if errors:
        print("Rendered link check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Rendered link check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
