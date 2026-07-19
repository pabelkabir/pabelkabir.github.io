#!/usr/bin/env python3
"""Validate rendered public content and publication data."""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA = ROOT / "data"
PUBLIC_SKIP = {"CONTENT_NEEDED.md"}
UNVERIFIED_DOMAIN_EMAIL_ALLOWED = False
PRIVATE_REPO_PATTERN = re.compile(r"github\.com/pabelkabir/aiim-protocol", re.I)


class ImageAltParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.missing: list[str] = []
        self.links: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag == "img" and not data.get("alt"):
            self.missing.append(data.get("src", "<unknown>"))
        if tag == "a" and data.get("href"):
            self.links.append(data["href"])
        if data.get("id"):
            self.ids.add(data["id"])


def read_public_files() -> list[Path]:
    if not DOCS.exists():
        return []
    return [p for p in DOCS.rglob("*") if p.is_file() and p.suffix.lower() in {".html", ".xml", ".txt", ".json"}]


def duplicate_dois() -> list[str]:
    bib = DATA / "publications.bib"
    if not bib.exists():
        return []
    text = bib.read_text(encoding="utf-8")
    dois = re.findall(r"doi\s*=\s*[\{\"]([^}\"]+)", text, re.I)
    normalized = [re.sub(r"^https?://(dx\.)?doi\.org/", "", doi.lower()).strip() for doi in dois]
    seen: set[str] = set()
    duplicates: list[str] = []
    for doi in normalized:
        if doi in seen:
            duplicates.append(doi)
        seen.add(doi)
    return duplicates


def validate_public_files() -> list[str]:
    errors: list[str] = []
    files = read_public_files()
    if not files:
        errors.append("docs/ does not exist or contains no rendered public files")
        return errors
    for path in files:
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8", errors="replace")
        if "TODO" in text:
            errors.append(f"{rel}: visible TODO")
        if "example.com" in text:
            errors.append(f"{rel}: example.com placeholder")
        if "Jane Doe" in text or "John Doe" in text:
            errors.append(f"{rel}: placeholder name")
        if not UNVERIFIED_DOMAIN_EMAIL_ALLOWED and "contact@kabirlab.org" in text:
            errors.append(f"{rel}: unverified domain email is rendered")
        if PRIVATE_REPO_PATTERN.search(text):
            errors.append(f"{rel}: private repository URL rendered")
        if path.suffix.lower() == ".html":
            parser = ImageAltParser()
            parser.feed(text)
            for src in parser.missing:
                errors.append(f"{rel}: image missing alt text: {src}")
            for href in parser.links:
                if href.startswith("#") and href[1:] not in parser.ids:
                    errors.append(f"{rel}: broken same-page anchor {href}")
                if href.startswith(("http:", "https:")) and " " in href:
                    errors.append(f"{rel}: malformed URL with spaces {href}")
    c_name = DOCS / "CNAME"
    if not c_name.exists() or c_name.read_text(encoding="utf-8").strip() != "kabirlab.org":
        errors.append("docs/CNAME missing or incorrect")
    for doi in duplicate_dois():
        errors.append(f"duplicate DOI in data/publications.bib: {doi}")
    return errors


def main() -> int:
    errors = validate_public_files()
    if errors:
        print("Content validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Content validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
