#!/usr/bin/env python3
"""Build generated publication content from curated BibTeX and metadata."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
GENERATED = ROOT / "site" / "generated"
PRIMARY_BIB = DATA / "publications.bib"
SCHOLAR_BIB = DATA / "google-scholar-export.bib"
METADATA = DATA / "publications.yml"


def strip_outer(value: str) -> str:
    value = value.strip().rstrip(",")
    if len(value) >= 2 and value[0] in "{\"" and value[-1] in "}\"":
        value = value[1:-1]
    return re.sub(r"\s+", " ", value).strip()


def normalize_doi(value: str) -> str:
    value = strip_outer(value).lower()
    value = re.sub(r"^https?://(dx\.)?doi\.org/", "", value)
    value = re.sub(r"^doi:\s*", "", value)
    return value.strip()


def normalize_title(value: str) -> str:
    value = unicodedata.normalize("NFKD", strip_outer(value)).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", " ", value).lower()
    return re.sub(r"\s+", " ", value).strip()


def parse_bibtex(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    entries: list[dict[str, str]] = []
    i = 0
    while True:
        match = re.search(r"@(\w+)\s*\{\s*([^,]+),", text[i:], re.S)
        if not match:
            break
        start = i + match.start()
        body_start = i + match.end()
        depth = 1
        j = body_start
        while j < len(text) and depth:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        raw_body = text[body_start : j - 1]
        entry: dict[str, str] = {
            "entry_type": match.group(1).lower(),
            "citekey": match.group(2).strip(),
        }
        for field, value in re.findall(r"(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|\"[^\"]*\"|[^,\n]+)\s*,?", raw_body, re.S):
            entry[field.lower()] = strip_outer(value)
        entries.append(entry)
        i = j
    return entries


def parse_metadata(path: Path) -> dict[str, dict[str, object]]:
    if not path.exists():
        return {}
    items: dict[str, dict[str, object]] = {}
    current: dict[str, object] | None = None
    current_key: str | None = None
    lines = path.read_text(encoding="utf-8").splitlines()
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if not line.strip() or line.lstrip().startswith("#"):
            idx += 1
            continue
        if line.startswith("- citekey:"):
            citekey = line.split(":", 1)[1].strip().strip("\"'")
            current = {"citekey": citekey}
            items[citekey] = current
            current_key = None
            idx += 1
            continue
        if current is not None and line.startswith("  ") and ":" in line:
            key, raw = line.strip().split(":", 1)
            raw = raw.strip()
            if raw == ">-":
                block: list[str] = []
                idx += 1
                while idx < len(lines) and lines[idx].startswith("    "):
                    block.append(lines[idx].strip())
                    idx += 1
                current[key] = " ".join(block).strip()
                current_key = key
                continue
            if raw.lower() in {"true", "false"}:
                current[key] = raw.lower() == "true"
            else:
                current[key] = raw.strip("\"'")
            current_key = key
        elif current is not None and current_key and line.startswith("    "):
            current[current_key] = f"{current.get(current_key, '')} {line.strip()}".strip()
        idx += 1
    return items


def valid_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def merge_entries(primary: list[dict[str, str]], scholar: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[str]]:
    report: list[str] = []
    merged: list[dict[str, str]] = []
    by_doi: dict[str, dict[str, str]] = {}
    by_title: dict[str, dict[str, str]] = {}
    for source, entries in [("seed", primary), ("scholar", scholar)]:
        for entry in entries:
            title_key = normalize_title(entry.get("title", ""))
            doi_key = normalize_doi(entry.get("doi", ""))
            existing = by_doi.get(doi_key) if doi_key else by_title.get(title_key)
            if existing:
                report.append(f"merged duplicate from {source}: {entry.get('citekey')} -> {existing.get('citekey')}")
                for key, value in entry.items():
                    existing.setdefault(key, value)
                continue
            merged.append(entry)
            if doi_key:
                by_doi[doi_key] = entry
            if title_key:
                by_title[title_key] = entry
            report.append(f"added from {source}: {entry.get('citekey')}")
    return merged, report


def validate(entries: list[dict[str, str]], metadata: dict[str, dict[str, object]]) -> list[str]:
    errors: list[str] = []
    seen_doi: dict[str, str] = {}
    for entry in entries:
        citekey = entry.get("citekey", "<unknown>")
        if not entry.get("title"):
            errors.append(f"{citekey}: missing title")
        if not entry.get("year"):
            errors.append(f"{citekey}: missing year")
        doi = normalize_doi(entry.get("doi", ""))
        if doi:
            if doi in seen_doi and seen_doi[doi] != citekey:
                errors.append(f"duplicate DOI {doi}: {seen_doi[doi]} and {citekey}")
            seen_doi[doi] = citekey
        for field in ["url"]:
            value = entry.get(field)
            if value and not valid_url(value):
                errors.append(f"{citekey}: malformed {field} URL {value}")
    for citekey, meta in metadata.items():
        if citekey not in {entry.get("citekey") for entry in entries}:
            errors.append(f"metadata citekey not found in BibTeX: {citekey}")
        for field in ["code", "data", "preprint", "pdf", "supporting_information"]:
            value = meta.get(field)
            if isinstance(value, str) and value and not valid_url(value):
                errors.append(f"{citekey}: malformed metadata URL {field}={value}")
    return errors


def format_authors(authors: str) -> str:
    names = [name.strip() for name in authors.split(" and ") if name.strip()]
    rendered = []
    for name in names:
        if "Kabir" in name and ("Pabel" in name or "Md Pabel" in name or "Mohammad" in name):
            rendered.append(f"<strong>{name}</strong>")
        else:
            rendered.append(name)
    return "; ".join(rendered)


def entry_type(entry: dict[str, str], meta: dict[str, object]) -> str:
    if meta.get("type"):
        return str(meta["type"])
    if entry.get("entry_type") == "mastersthesis":
        return "thesis"
    return "journal-article"


def link_line(entry: dict[str, str], meta: dict[str, object]) -> str:
    links: list[str] = []
    doi = normalize_doi(entry.get("doi", ""))
    if doi:
        links.append(f'<a href="https://doi.org/{doi}">DOI</a>')
    for label, key in [
        ("Code", "code"),
        ("Data", "data"),
        ("Preprint", "preprint"),
        ("PDF", "pdf"),
        ("Supporting Information", "supporting_information"),
    ]:
        value = meta.get(key)
        if isinstance(value, str) and value:
            links.append(f'<a href="{value}">{label}</a>')
    url = entry.get("url", "")
    if not doi and url:
        links.append(f'<a href="{url}">Link</a>')
    return " | ".join(links)


def make_qmd(entries: list[dict[str, str]], metadata: dict[str, dict[str, object]]) -> str:
    entries = sorted(entries, key=lambda e: (int(e.get("year", 0)), e.get("title", "")), reverse=True)
    featured = [e for e in entries if metadata.get(e.get("citekey", ""), {}).get("featured")]
    lines: list[str] = []
    lines.append("## Featured Publications\n")
    lines.append("::: {.publication-grid}\n")
    for entry in featured:
        meta = metadata.get(entry.get("citekey", ""), {})
        lines.append("::: {.publication-card}\n")
        lines.append(f"### {entry.get('title')}\n")
        lines.append(f"<p class=\"pub-meta\">{format_authors(entry.get('author', ''))}</p>\n")
        lines.append(f"<p class=\"pub-meta\">{entry.get('journal', entry.get('school', ''))}, {entry.get('year')}</p>\n")
        if meta.get("summary"):
            lines.append(f"{meta['summary']}\n")
        links = link_line(entry, meta)
        if links:
            lines.append(f"{links}\n")
        lines.append(":::\n")
    lines.append(":::\n")
    lines.append("\n## All Publications\n")
    current_year = None
    open_list = False
    for entry in entries:
        year = entry.get("year", "Unknown")
        if year != current_year:
            if open_list:
                lines.append("</div>\n")
            lines.append(f"\n### {year} {{.publication-year}}\n")
            lines.append("<div class=\"publication-list\">\n")
            open_list = True
            current_year = year
        meta = metadata.get(entry.get("citekey", ""), {})
        kind = entry_type(entry, meta)
        summary = meta.get("summary", "")
        links = link_line(entry, meta)
        lines.append("<article class=\"publication-entry\">\n")
        lines.append(f"<span class=\"tag\">{kind}</span>\n")
        lines.append(f"<h3>{entry.get('title')}</h3>\n")
        lines.append(f"<p class=\"pub-meta\">{format_authors(entry.get('author', ''))}</p>\n")
        venue = entry.get("journal") or entry.get("school") or ""
        if venue:
            lines.append(f"<p class=\"pub-meta\">{venue}</p>\n")
        if summary:
            lines.append(f"<p>{summary}</p>\n")
        if links:
            lines.append(f"<p>{links}</p>\n")
        lines.append("</article>\n")
    if open_list:
        lines.append("</div>\n")
    return "".join(lines)


def main() -> int:
    primary = parse_bibtex(PRIMARY_BIB)
    scholar = parse_bibtex(SCHOLAR_BIB)
    metadata = parse_metadata(METADATA)
    entries, report = merge_entries(primary, scholar)
    errors = validate(entries, metadata)
    if errors:
        print("Publication build failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    GENERATED.mkdir(exist_ok=True)
    (GENERATED / "publications.qmd").write_text(make_qmd(entries, metadata), encoding="utf-8")
    json_entries = []
    for entry in entries:
        meta = metadata.get(entry.get("citekey", ""), {})
        item = {**entry, **{k: v for k, v in meta.items() if k != "citekey"}}
        json_entries.append(item)
    (GENERATED / "publications.json").write_text(json.dumps(json_entries, indent=2), encoding="utf-8")
    print("Publication build report:")
    for line in report:
        print(f"- {line}")
    print(f"Generated {len(entries)} publication entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
