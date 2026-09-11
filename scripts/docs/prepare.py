#!/usr/bin/env python3
"""Prepare a MkDocs source tree without duplicating canonical project records."""

from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit


REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_ROOT = REPO_ROOT / ".docs-build"
GITHUB_BLOB_ROOT = "https://github.com/thaynes43/haynes-quest/blob/main"

MARKDOWN_LINK = re.compile(
    r"(?P<open>!?\[[^\]\n]*\]\()"
    r"(?P<target><[^>\n]+>|[^)\s]+)"
    r"(?P<title>\s+(?:\"[^\"\n]*\"|'[^'\n]*'))?"
    r"(?P<close>\))"
)


def fail(message: str) -> None:
    print(f"docs prepare: {message}", file=sys.stderr)
    raise SystemExit(1)


def source_files() -> dict[Path, Path]:
    """Return source-to-generated mappings, preserving stable repository layout."""

    mappings: dict[Path, Path] = {}
    docs_root = REPO_ROOT / "docs"

    for source in sorted(docs_root.rglob("*")):
        if source.is_symlink():
            fail(f"refusing to copy symlink from docs: {source.relative_to(REPO_ROOT)}")
        if not source.is_file():
            continue
        relative = source.relative_to(docs_root)
        destination = Path("index.md") if relative == Path("README.md") else relative
        mappings[source.resolve()] = destination

    agents_root = REPO_ROOT / ".agents"
    for source in sorted(agents_root.rglob("*.md")):
        if source.is_symlink():
            fail(f"refusing to copy symlink from .agents: {source.relative_to(REPO_ROOT)}")
        mappings[source.resolve()] = Path("project") / source.relative_to(agents_root)

    contributor_guide = (REPO_ROOT / "AGENTS.md").resolve()
    if contributor_guide.exists():
        mappings[contributor_guide] = Path("project/contributor-guide.md")

    return mappings


def rewritten_target(
    raw_target: str,
    source: Path,
    destination: Path,
    mappings: dict[Path, Path],
) -> str:
    wrapped = raw_target.startswith("<") and raw_target.endswith(">")
    target = raw_target[1:-1] if wrapped else raw_target
    parsed = urlsplit(target)

    if parsed.scheme or parsed.netloc or not parsed.path or parsed.path.startswith("/"):
        return raw_target

    local_path = unquote(parsed.path)
    resolved = (source.parent / local_path).resolve()
    try:
        repository_path = resolved.relative_to(REPO_ROOT)
    except ValueError:
        return raw_target

    mapped = mappings.get(resolved)
    if mapped is not None:
        relative = Path(os.path.relpath(mapped, destination.parent)).as_posix()
        rebuilt = urlunsplit(("", "", relative, parsed.query, parsed.fragment))
        return f"<{rebuilt}>" if wrapped else rebuilt

    if resolved.exists():
        # A repository file intentionally outside the static site remains reviewable.
        fallback = f"{GITHUB_BLOB_ROOT}/{repository_path.as_posix()}"
        rebuilt = urlunsplit(("https", "github.com", fallback.split("github.com/", 1)[1], parsed.query, parsed.fragment))
        return f"<{rebuilt}>" if wrapped else rebuilt

    return raw_target


def rewrite_markdown(
    text: str,
    source: Path,
    destination: Path,
    mappings: dict[Path, Path],
) -> str:
    def replace(match: re.Match[str]) -> str:
        target = rewritten_target(match.group("target"), source, destination, mappings)
        return f"{match.group('open')}{target}{match.group('title') or ''}{match.group('close')}"

    return MARKDOWN_LINK.sub(replace, text)


def main() -> None:
    mappings = source_files()
    if BUILD_ROOT.exists():
        shutil.rmtree(BUILD_ROOT)
    BUILD_ROOT.mkdir(parents=True)

    for source, destination in mappings.items():
        output = BUILD_ROOT / destination
        output.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix.lower() == ".md":
            text = source.read_text(encoding="utf-8")
            output.write_text(
                rewrite_markdown(text, source, destination, mappings),
                encoding="utf-8",
            )
        else:
            shutil.copyfile(source, output)

    print(f"Prepared {len(mappings)} files in {BUILD_ROOT.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
