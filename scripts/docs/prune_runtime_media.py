#!/usr/bin/env python3
"""Remove unlinked generated preview PNGs from a copied runtime media tree."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


PREVIEW_DIRECTORIES = frozenset(
    {"preview", "final-preview", "checkpoint-preview-rebuild2", "blender-previews"}
)
RETAINED_PREVIEWS = frozenset(
    {
        Path("bin-chicken/v001/final-preview/rest-beauty.png"),
        Path("putty-grunt/v001/final-preview/bind-beauty.png"),
    }
)
SOURCE_MEDIA = Path(__file__).resolve().parents[2] / "docs/assets/media"


class UnsafeMediaRoot(ValueError):
    """The supplied path cannot safely be pruned."""


def validate_root(path: Path, dry_run: bool) -> Path:
    if path.is_symlink():
        raise UnsafeMediaRoot(f"media root is a symlink: {path}")
    if any(parent.is_symlink() for parent in path.absolute().parents):
        raise UnsafeMediaRoot(f"media root traverses a symlink: {path}")
    if not path.is_dir():
        raise UnsafeMediaRoot(f"media root is missing or is not a directory: {path}")

    root = path.resolve(strict=True)
    source = SOURCE_MEDIA.resolve()
    if root == Path(root.anchor):
        raise UnsafeMediaRoot(f"media root cannot be a filesystem root: {root}")
    if root.parts[-3:] == ("docs", "assets", "media") and not dry_run:
        raise UnsafeMediaRoot(f"refusing to prune source media; copy it first: {root}")
    if root != source and (source.is_relative_to(root) or root.is_relative_to(source)):
        raise UnsafeMediaRoot(f"media root overlaps source media: {root}")
    return root


def collect_previews(root: Path) -> list[tuple[Path, int]]:
    """Inspect the whole tree before returning any files eligible for deletion."""
    selected: list[tuple[Path, int]] = []

    def walk(directory: Path) -> None:
        with os.scandir(directory) as entries:
            children = sorted(entries, key=lambda entry: entry.name)
        for entry in children:
            path = Path(entry.path)
            if entry.is_symlink():
                raise UnsafeMediaRoot(f"symlink in media tree: {path}")
            if entry.is_dir(follow_symlinks=False):
                walk(path)
            elif entry.is_file(follow_symlinks=False):
                relative = path.relative_to(root)
                if (
                    path.suffix.lower() == ".png"
                    and PREVIEW_DIRECTORIES.intersection(relative.parts[:-1])
                    and relative not in RETAINED_PREVIEWS
                ):
                    selected.append((path, entry.stat(follow_symlinks=False).st_size))
            else:
                raise UnsafeMediaRoot(f"non-file entry in media tree: {path}")

    walk(root)
    return selected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media_root", type=Path, help="copied docs/assets/media directory")
    parser.add_argument("--dry-run", action="store_true", help="report without deleting")
    parser.add_argument("--json", action="store_true", help="print a JSON report")
    args = parser.parse_args()

    try:
        root = validate_root(args.media_root, args.dry_run)
        selected = collect_previews(root)
        if not args.dry_run:
            for path, _ in selected:
                path.unlink()
    except (OSError, UnsafeMediaRoot) as exc:
        parser.exit(1, f"prune_runtime_media: {exc}\n")

    report = {
        "png_count": len(selected),
        "bytes_saved": sum(size for _, size in selected),
        "dry_run": args.dry_run,
    }
    if args.json:
        print(json.dumps(report, sort_keys=True))
    else:
        action = "would prune" if args.dry_run else "pruned"
        print(f"{action} {report['png_count']} PNGs ({report['bytes_saved']} bytes)")


if __name__ == "__main__":
    main()
