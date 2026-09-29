#!/usr/bin/env python3
"""Check that the final MkDocs site contains every linked local runtime file.

Run this after media pruning. The earlier source link check validates the complete
archive; checksum inventories deliberately do not promise runtime availability.
"""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[2]
INVENTORY = REPO_ROOT / "scripts/assets/catalog-inventory.json"
INVENTORY_LIST_FIELDS = ("concept_images", "model_images", "models", "audio")


def srcset_urls(value: str) -> list[str]:
    """Extract URL tokens, allowing commas inside data URLs.

    This follows the URL/descriptor split of the HTML srcset parser. A URL may
    contain commas; only commas after optional descriptors separate candidates.
    """

    urls: list[str] = []
    position = 0
    while position < len(value):
        while position < len(value) and (value[position].isspace() or value[position] == ","):
            position += 1
        start = position
        while position < len(value) and not value[position].isspace():
            position += 1
        url = value[start:position].rstrip(",")
        if url:
            urls.append(url)
        if position == start or value[position - 1] == ",":
            continue
        while position < len(value) and value[position] != ",":
            position += 1
        position += 1
    return urls


def check_target(
    target: str, source: Path, site_root: Path, context: str, errors: list[str]
) -> None:
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return

    url_path = unquote(parsed.path)
    if "\x00" in url_path:
        errors.append(f"{context}: invalid local URL {target!r}")
        return
    base = site_root if url_path.startswith("/") else source.parent
    candidate = (base / url_path.lstrip("/")).resolve()
    try:
        candidate.relative_to(site_root)
    except ValueError:
        errors.append(f"{context}: local URL escapes the site: {target!r}")
        return

    if candidate.is_dir():
        candidate /= "index.html"
    if not candidate.is_file():
        errors.append(f"{context}: missing local target {target!r}")


class SiteHTMLParser(HTMLParser):
    def __init__(self, source: Path, site_root: Path, errors: list[str]) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.site_root = site_root
        self.errors = errors

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        line = self.getpos()[0]
        for name, value in attrs:
            if not value or name not in {"href", "src", "poster", "srcset"}:
                continue
            targets = srcset_urls(value) if name == "srcset" else [value]
            for target in targets:
                context = f"{self.source.relative_to(self.site_root)}:{line} <{tag}> {name}"
                check_target(target, self.source, self.site_root, context, self.errors)

    handle_startendtag = handle_starttag


def check_inventory(site_root: Path, inventory_path: Path, errors: list[str]) -> int:
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    if inventory.get("path_base") != "repository-root" or not isinstance(inventory.get("assets"), list):
        errors.append(f"{inventory_path}: unsupported catalog inventory schema")
        return 0

    checked = 0
    for index, asset in enumerate(inventory["assets"]):
        asset_name = asset.get("id", f"asset {index}")
        references: list[tuple[str, str]] = []
        review = asset.get("review")
        if isinstance(review, str) and review:
            references.append(("review", review))
        else:
            errors.append(f"inventory {asset_name}: missing review path")
        for field in INVENTORY_LIST_FIELDS:
            values = asset.get(field)
            if not isinstance(values, list):
                errors.append(f"inventory {asset_name}: {field} must be a list")
                continue
            for value in values:
                references.append((field, value))
        thumbnail = asset.get("thumbnail")
        if thumbnail is not None:
            references.append(("thumbnail", thumbnail))

        for field, value in references:
            context = f"inventory {asset_name} {field}"
            if not isinstance(value, str):
                errors.append(f"{context}: expected a path string")
                continue
            parsed = urlsplit(value)
            path = unquote(parsed.path)
            if parsed.scheme or parsed.netloc or not path.startswith("docs/"):
                errors.append(f"{context}: expected a repository-root docs/ path, got {value!r}")
                continue
            if field == "review":
                if not path.endswith(".md"):
                    errors.append(f"{context}: expected a Markdown review path, got {value!r}")
                    continue
                path = f"{path[:-3]}.html"
            check_target(path.removeprefix("docs/"), site_root / "index.html", site_root, context, errors)
            checked += 1
    return checked


def check_site(site_root: Path, inventory_path: Path = INVENTORY) -> tuple[int, int, list[str]]:
    site_root = site_root.resolve()
    errors: list[str] = []
    html_files = sorted(site_root.rglob("*.html"))
    for source in html_files:
        parser = SiteHTMLParser(source, site_root, errors)
        parser.feed(source.read_text(encoding="utf-8"))
        parser.close()
    inventory_count = check_inventory(site_root, inventory_path, errors)
    return len(html_files), inventory_count, errors


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: check_runtime_site.py <site-root>")
    site_root = Path(sys.argv[1]).resolve()
    if not site_root.is_dir():
        raise SystemExit(f"site directory does not exist: {site_root}")
    html_count, inventory_count, errors = check_site(site_root)
    if errors:
        print("Runtime site checks failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        raise SystemExit(1)
    print(f"Checked {html_count} HTML pages and {inventory_count} catalog runtime paths")


if __name__ == "__main__":
    main()
