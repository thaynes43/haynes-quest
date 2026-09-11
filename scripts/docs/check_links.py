#!/usr/bin/env python3
"""Check local links and safe, accessible media in prepared documentation."""

from __future__ import annotations

import json
import re
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


MARKDOWN_LINK = re.compile(
    r"(?P<image>!)?\[(?P<label>[^\]\n]*)\]\("
    r"(?P<target><[^>\n]+>|[^)\s]+)"
    r"(?:\s+(?:\"[^\"\n]*\"|'[^'\n]*'))?\)"
)
FENCED_BLOCK = re.compile(
    r"(?ms)^[ \t]*(?P<fence>`{3,}|~{3,})[^\n]*\n.*?^[ \t]*(?P=fence)[ \t]*$"
)
INLINE_CODE = re.compile(r"`[^`\n]*`")
MEDIA_TAGS = {"audio", "img", "model-viewer", "source", "video"}
MEDIA_EXTENSIONS = {
    ".avif",
    ".glb",
    ".gltf",
    ".jpeg",
    ".jpg",
    ".m4a",
    ".mp3",
    ".mp4",
    ".ogg",
    ".png",
    ".svg",
    ".wav",
    ".webm",
    ".webp",
}
DECODER_EXTENSIONS = {
    "EXT_meshopt_compression",
    "KHR_draco_mesh_compression",
    "KHR_texture_basisu",
}


class DocumentHTMLParser(HTMLParser):
    def __init__(self, path: Path, errors: list[str]) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.errors = errors
        self.targets: list[tuple[str, int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        line = self.getpos()[0]

        if tag == "img" and not (attributes.get("alt") or "").strip():
            self.errors.append(f"{self.path}:{line}: HTML image needs descriptive alt text")

        if tag == "model-viewer":
            if not (attributes.get("alt") or "").strip():
                self.errors.append(f"{self.path}:{line}: model-viewer needs descriptive alt text")
            if not attributes.get("src"):
                self.errors.append(f"{self.path}:{line}: model-viewer needs a local src")

        if tag == "audio":
            if "controls" not in attributes:
                self.errors.append(f"{self.path}:{line}: audio previews must expose native controls")
            if "autoplay" in attributes:
                self.errors.append(f"{self.path}:{line}: audio previews must not autoplay")

        for attribute in ("href", "poster", "src"):
            target = attributes.get(attribute)
            if target:
                context = f"{tag} {attribute}"
                if tag in MEDIA_TAGS or (tag == "a" and attribute == "href"):
                    self.targets.append((target, line, context))


def without_code(markdown: str) -> str:
    return INLINE_CODE.sub("", FENCED_BLOCK.sub("", markdown))


def is_remote(target: str) -> bool:
    unwrapped = target[1:-1] if target.startswith("<") and target.endswith(">") else target
    parsed = urlsplit(unwrapped)
    return bool(parsed.scheme or parsed.netloc)


def target_suffix(target: str) -> str:
    unwrapped = target[1:-1] if target.startswith("<") and target.endswith(">") else target
    return Path(urlsplit(unwrapped).path).suffix.lower()


def check_local_target(
    target: str,
    source: Path,
    root: Path,
    line: int,
    context: str,
    errors: list[str],
) -> None:
    unwrapped = target[1:-1] if target.startswith("<") and target.endswith(">") else target
    parsed = urlsplit(unwrapped)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    if parsed.path.startswith("/"):
        errors.append(f"{source}:{line}: {context} uses site-absolute path {target!r}")
        return

    resolved = (source.parent / unquote(parsed.path)).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        errors.append(f"{source}:{line}: {context} escapes the documentation tree: {target!r}")
        return

    if not resolved.is_file():
        errors.append(f"{source}:{line}: missing local target {target!r} ({context})")


def check_markdown(path: Path, root: Path, errors: list[str]) -> None:
    text = without_code(path.read_text(encoding="utf-8"))
    for match in MARKDOWN_LINK.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        target = match.group("target")
        if match.group("image") and not match.group("label").strip():
            errors.append(f"{path}:{line}: Markdown image needs descriptive alt text")
        if is_remote(target) and (
            match.group("image")
            or target_suffix(target) in MEDIA_EXTENSIONS
        ):
            errors.append(f"{path}:{line}: media must use a repository-local path, got {target!r}")
        check_local_target(target, path, root, line, "Markdown link", errors)

    parser = DocumentHTMLParser(path, errors)
    parser.feed(text)
    for target, line, context in parser.targets:
        if is_remote(target) and context.startswith(tuple(MEDIA_TAGS)):
            errors.append(f"{path}:{line}: {context} must use repository-local media, got {target!r}")
        elif not is_remote(target):
            check_local_target(target, path, root, line, context, errors)


def check_glb(path: Path, root: Path, errors: list[str]) -> None:
    data = path.read_bytes()
    relative = path.relative_to(root)
    if len(data) < 20 or data[:4] != b"glTF":
        errors.append(f"{relative}: invalid GLB header")
        return

    version, declared_length = struct.unpack_from("<II", data, 4)
    if version != 2 or declared_length != len(data):
        errors.append(f"{relative}: expected a complete glTF 2.0 binary")
        return

    chunk_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A or 20 + chunk_length > len(data):
        errors.append(f"{relative}: missing valid JSON chunk")
        return

    try:
        document = json.loads(data[20 : 20 + chunk_length].decode("utf-8").rstrip(" \t\r\n\0"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        errors.append(f"{relative}: invalid JSON chunk: {exc}")
        return

    used = set(document.get("extensionsUsed", []))
    unsupported = sorted(used & DECODER_EXTENSIONS)
    if unsupported:
        errors.append(
            f"{relative}: decoder-dependent extensions are not allowed in offline previews: "
            f"{', '.join(unsupported)}"
        )

    for collection in ("buffers", "images"):
        for entry in document.get(collection, []):
            uri = entry.get("uri")
            if not uri or uri.startswith("data:"):
                continue
            errors.append(
                f"{relative}: {collection[:-1]} URI must be embedded in the standalone GLB: {uri!r}"
            )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: check_links.py <prepared-docs-directory>")
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        raise SystemExit(f"prepared docs directory does not exist: {root}")

    errors: list[str] = []
    markdown_files = sorted(root.rglob("*.md"))
    for path in markdown_files:
        check_markdown(path, root, errors)
    for path in sorted(root.rglob("*.glb")):
        check_glb(path, root, errors)

    if errors:
        print("Documentation checks failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        raise SystemExit(1)

    print(f"Checked {len(markdown_files)} Markdown files and local media references")


if __name__ == "__main__":
    main()
