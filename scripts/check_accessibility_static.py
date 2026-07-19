#!/usr/bin/env python3
"""Static accessibility sanity checks for rendered HTML."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class A11yParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.lang = ""
        self.title = ""
        self.in_title = False
        self.images_without_alt: list[str] = []
        self.link_stack: list[dict[str, str]] = []
        self.links_without_names: list[str] = []
        self.heading_levels: list[int] = []
        self.ids: list[str] = []
        self.hidden_stack: list[bool] = []

    @property
    def in_hidden_content(self) -> bool:
        return any(self.hidden_stack)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        parent_hidden = self.in_hidden_content
        hidden = "quarto-title-block" in data.get("class", "") or "display: none" in data.get("style", "")
        effective_hidden = hidden or parent_hidden
        if tag not in VOID_TAGS:
            self.hidden_stack.append(effective_hidden)
        if tag == "html":
            self.lang = data.get("lang", "")
        if tag == "title":
            self.in_title = True
        if effective_hidden:
            return
        if tag == "img" and not data.get("alt"):
            self.images_without_alt.append(data.get("src", "<unknown>"))
        if tag == "img" and self.link_stack and data.get("alt"):
            self.link_stack[-1]["label"] += data["alt"].strip()
        if tag == "a":
            self.link_stack.append({"href": data.get("href", ""), "label": data.get("aria-label", "")})
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.heading_levels.append(int(tag[1]))
        if data.get("id"):
            self.ids.append(data["id"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        if not self.in_hidden_content and tag == "a" and self.link_stack:
            link = self.link_stack.pop()
            if link["href"] and not link["label"].strip():
                self.links_without_names.append(link["href"])
        if self.hidden_stack:
            self.hidden_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data.strip()
        if self.link_stack and not self.in_hidden_content:
            self.link_stack[-1]["label"] += data.strip()


def heading_jumps(levels: list[int]) -> list[str]:
    errors: list[str] = []
    previous = 0
    for level in levels:
        if previous and level > previous + 1:
            errors.append(f"heading jumps from h{previous} to h{level}")
        previous = level
    return errors


def duplicates(values: list[str]) -> set[str]:
    seen: set[str] = set()
    repeated: set[str] = set()
    for value in values:
        if value in seen:
            repeated.add(value)
        seen.add(value)
    return repeated


def main() -> int:
    if not DOCS.exists():
        print("docs/ does not exist", file=sys.stderr)
        return 1
    errors: list[str] = []
    for path in sorted(DOCS.rglob("*.html")):
        parser = A11yParser()
        parser.feed(path.read_text(encoding="utf-8", errors="replace"))
        rel = path.relative_to(ROOT)
        if not parser.lang:
            errors.append(f"{rel}: missing html lang")
        if not parser.title:
            errors.append(f"{rel}: missing document title")
        h1_count = parser.heading_levels.count(1)
        if h1_count != 1:
            errors.append(f"{rel}: expected one h1, found {h1_count}")
        for src in parser.images_without_alt:
            errors.append(f"{rel}: image missing alt text: {src}")
        for href in parser.links_without_names:
            errors.append(f"{rel}: link has no accessible name: {href}")
        for jump in heading_jumps(parser.heading_levels):
            errors.append(f"{rel}: {jump}")
        for value in sorted(duplicates(parser.ids)):
            errors.append(f"{rel}: duplicate id {value}")
    if errors:
        print("Static accessibility check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Static accessibility check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
