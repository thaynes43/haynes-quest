"""Regression checks for staging local project evidence in MkDocs."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.docs import check_links, prepare


class PrepareEvidenceTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.build = self.root / ".docs-build"
        docs = self.root / "docs"
        docs.mkdir()
        (docs / "README.md").write_text("# Studio\n", encoding="utf-8")

    def prepare_site(self) -> None:
        with patch.object(prepare, "REPO_ROOT", self.root), patch.object(prepare, "BUILD_ROOT", self.build):
            prepare.main()

    def test_evidence_png_is_copied_and_links_remain_local(self) -> None:
        evidence = self.root / ".agents/evidence/action-worlds"
        evidence.mkdir(parents=True)
        (evidence / "frame.png").write_bytes(b"synthetic screenshot")
        (evidence / "record.md").write_text(
            "# Synthetic capture\n\n![Arena view](frame.png)\n\n[Download frame](frame.png)\n",
            encoding="utf-8",
        )

        self.prepare_site()

        staged = self.build / "project/evidence/action-worlds"
        self.assertEqual((staged / "frame.png").read_bytes(), b"synthetic screenshot")
        text = (staged / "record.md").read_text(encoding="utf-8")
        self.assertIn("![Arena view](frame.png)", text)
        self.assertIn("[Download frame](frame.png)", text)
        errors: list[str] = []
        check_links.check_markdown(staged / "record.md", self.build, errors)
        self.assertEqual(errors, [])

    def test_evidence_png_symlink_is_rejected(self) -> None:
        evidence = self.root / ".agents/evidence/action-worlds"
        evidence.mkdir(parents=True)
        target = self.root / "outside.png"
        target.write_bytes(b"external")
        (evidence / "frame.png").symlink_to(target)

        with self.assertRaises(SystemExit) as result:
            self.prepare_site()
        self.assertEqual(result.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
