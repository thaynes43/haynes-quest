#!/usr/bin/env python3
"""Keep MkDocs-generated media HTML in the runtime pages layer.

The separately cached media layer supplies the source files. MkDocs also turns
Markdown within that source tree into HTML, which review links point to.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def retain_html(site_root: Path) -> tuple[int, int]:
    if not site_root.is_dir() or site_root.is_symlink():
        raise ValueError(f"expected a generated site directory: {site_root}")
    media_root = site_root / "assets" / "media"
    if media_root.absolute().parts[-3:] == ("docs", "assets", "media"):
        raise ValueError(f"refusing to alter source media: {media_root}")
    if any(parent.is_symlink() for parent in media_root.absolute().parents):
        raise ValueError(f"media path traverses a symlink: {media_root}")
    if not media_root.is_dir() or media_root.is_symlink():
        raise ValueError(f"generated media directory is missing or linked: {media_root}")

    removed: list[Path] = []
    retained = 0

    def inspect(directory: Path) -> None:
        nonlocal retained
        with os.scandir(directory) as entries:
            children = list(entries)
        for entry in children:
            path = Path(entry.path)
            if entry.is_symlink():
                raise ValueError(f"symlink in generated media tree: {path}")
            if entry.is_dir(follow_symlinks=False):
                inspect(path)
            elif entry.is_file(follow_symlinks=False):
                if path.suffix.lower() == ".html":
                    retained += 1
                else:
                    removed.append(path)
            else:
                raise ValueError(f"non-file entry in generated media tree: {path}")

    inspect(media_root)
    for path in removed:
        path.unlink()
    return retained, len(removed)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site_root", type=Path, help="generated MkDocs site directory")
    args = parser.parse_args()
    try:
        retained, removed = retain_html(args.site_root)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"retain_runtime_media_html: {exc}\n")
    print(f"retained {retained} media HTML pages; removed {removed} source files")


if __name__ == "__main__":
    main()
