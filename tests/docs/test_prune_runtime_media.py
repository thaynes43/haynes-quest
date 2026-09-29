"""Focused CLI tests for runtime media pruning."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts/docs/prune_runtime_media.py"


class PruneRuntimeMediaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.media = Path(self.temporary.name) / "media"
        self.media.mkdir()

    def write(self, relative: str, data: bytes = b"x") -> Path:
        path = self.media / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def run_cli(self, *options: str, root: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(root or self.media), *options],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_prunes_only_named_preview_pngs_and_keeps_review_links(self) -> None:
        removed = [
            self.write("hero/v001/preview/frame.png", b"123"),
            self.write("hero/v001/final-preview/frame.PNG", b"12345"),
            self.write("hero/v001/checkpoint-preview-rebuild2/frame.png", b"12"),
            self.write("hero/v001/blender-previews/frame.png", b"1"),
        ]
        kept = [
            self.write("bin-chicken/v001/final-preview/rest-beauty.png"),
            self.write("putty-grunt/v001/final-preview/bind-beauty.png"),
            self.write("hero/v001/previews/frame.png"),
            self.write("hero/v001/preview-extra/frame.png"),
            self.write("hero/v001/review-audit/capture.png"),
            self.write("hero/v001/beauty.png"),
            self.write("hero/v001/preview/model.glb"),
            self.write("hero/v001/final-preview/master.blend"),
            self.write("hero/v001/blender-previews/audio.wav"),
        ]

        result = self.run_cli("--json")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"bytes_saved": 11, "dry_run": False, "png_count": 4})
        self.assertTrue(all(not path.exists() for path in removed))
        self.assertTrue(all(path.exists() for path in kept))
        self.assertEqual(self.run_cli("--json").stdout, '{"bytes_saved": 0, "dry_run": false, "png_count": 0}\n')

    def test_dry_run_reports_without_deleting(self) -> None:
        preview = self.write("hero/v001/preview/frame.png", b"1234")

        result = self.run_cli("--dry-run", "--json")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"bytes_saved": 4, "dry_run": True, "png_count": 1})
        self.assertTrue(preview.exists())

    def test_refuses_symlink_anywhere_before_deleting(self) -> None:
        preview = self.write("hero/v001/preview/frame.png")
        (self.media / "later").symlink_to(preview)

        result = self.run_cli()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("symlink in media tree", result.stderr)
        self.assertTrue(preview.exists())

    def test_refuses_missing_symlink_and_source_roots(self) -> None:
        linked_root = Path(self.temporary.name) / "linked-media"
        linked_root.symlink_to(self.media, target_is_directory=True)
        linked_parent = Path(self.temporary.name) / "linked-parent"
        linked_parent.symlink_to(self.media.parent, target_is_directory=True)
        source = REPO / "docs/assets/media"

        for root, error in (
            (Path(self.temporary.name) / "missing", "missing or is not a directory"),
            (linked_root, "media root is a symlink"),
            (linked_parent / "media", "media root traverses a symlink"),
            (source, "refusing to prune source media"),
            (Path("/"), "filesystem root"),
        ):
            with self.subTest(root=root):
                result = self.run_cli(root=root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(error, result.stderr)

    def test_refuses_source_media_in_another_checkout(self) -> None:
        other_source = Path(self.temporary.name) / "other-checkout/docs/assets/media"
        preview = other_source / "hero/v001/preview/frame.png"
        preview.parent.mkdir(parents=True)
        preview.write_bytes(b"123")

        result = self.run_cli(root=other_source)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("refusing to prune source media", result.stderr)
        self.assertTrue(preview.exists())
        dry_run = self.run_cli("--dry-run", "--json", root=other_source)
        self.assertEqual(dry_run.returncode, 0, dry_run.stderr)
        self.assertEqual(json.loads(dry_run.stdout), {"bytes_saved": 3, "dry_run": True, "png_count": 1})
        self.assertTrue(preview.exists())


if __name__ == "__main__":
    unittest.main()
