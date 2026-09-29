"""Focused final-site checks for media pruning and catalog review URLs."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.docs.check_runtime_site import check_site


class RuntimeSiteTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.site = self.root / "site"
        self.site.mkdir()
        self.inventory_path = self.root / "catalog-inventory.json"
        self.asset = {
            "id": "test-candidate",
            "review": "docs/assets/reviews/test-candidate/v001.md#download",
            "concept_images": ["docs/assets/media/test-candidate/v001/concept.png"],
            "model_images": ["docs/assets/media/test-candidate/v001/beauty.png"],
            "models": ["docs/assets/media/test-candidate/v001/model.glb"],
            "audio": ["docs/assets/media/test-candidate/v001/cue.wav"],
            "thumbnail": "docs/assets/media/test-candidate/v001/thumbnail.webp",
            "checksums": {
                "docs/assets/media/test-candidate/v001/preview/frame-003.png": "hash-only"
            },
        }
        self.write_site()

    def file(self, relative: str, contents: str = "x") -> Path:
        target = self.site / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents, encoding="utf-8")
        return target

    def write_site(self) -> None:
        self.file("index.html", '<a href="assets/reviews/test-candidate/v001.html">Review</a>')
        self.file(
            "assets/reviews/test-candidate/v001.html",
            '<img src="../../media/test-candidate/v001/concept.png" '
            'srcset="data:image/png;base64,AAAA 1x, ../../media/test-candidate/v001/beauty.png 2x">'
            '<model-viewer src="../../media/test-candidate/v001/model.glb" '
            'poster="../../media/test-candidate/v001/beauty.png"></model-viewer>'
            '<a href="../../media/test-candidate/v001/model.blend">Blender master</a>'
            '<audio src="../../media/test-candidate/v001/cue.wav"></audio>'
            '<a href="https://example.com/example.glb">Remote</a>'
            '<a href="mailto:review@example.com">Email</a>'
            '<a href="#download">Download section</a>',
        )
        for name in ("concept.png", "beauty.png", "model.glb", "model.blend", "cue.wav", "thumbnail.webp"):
            self.file(f"assets/media/test-candidate/v001/{name}")
        self.write_inventory()

    def write_inventory(self) -> None:
        self.inventory_path.write_text(
            json.dumps({"path_base": "repository-root", "assets": [self.asset]}),
            encoding="utf-8",
        )

    def check(self) -> list[str]:
        return check_site(self.site, self.inventory_path)[2]

    def test_retained_review_links_and_inventory_paths_pass_without_checksum_only_frame(self) -> None:
        self.assertEqual(self.check(), [])

    def test_missing_review_png_fails(self) -> None:
        (self.site / "assets/media/test-candidate/v001/concept.png").unlink()
        self.assertIn("concept.png", "\n".join(self.check()))

    def test_direct_review_downloads_must_exist_even_when_not_in_inventory(self) -> None:
        for name in ("model.glb", "model.blend", "cue.wav"):
            with self.subTest(name=name):
                target = self.site / f"assets/media/test-candidate/v001/{name}"
                target.unlink()
                errors = "\n".join(self.check())
                self.assertIn(f"missing local target '../../media/test-candidate/v001/{name}'", errors)
                target.write_text("x", encoding="utf-8")

    def test_inventory_runtime_fields_must_exist_even_without_html_links(self) -> None:
        target = self.site / "assets/media/test-candidate/v001/thumbnail.webp"
        target.unlink()
        self.assertIn("inventory test-candidate thumbnail: missing local target", "\n".join(self.check()))

    def test_relative_and_encoded_traversal_cannot_escape_site(self) -> None:
        review = self.site / "assets/reviews/test-candidate/v001.html"
        review.write_text(
            review.read_text(encoding="utf-8")
            + '<a href="../../../../outside.blend">Escape</a>'
            + '<img src="/%2e%2e/outside.png">',
            encoding="utf-8",
        )
        errors = "\n".join(self.check())
        self.assertIn("'../../../../outside.blend'", errors)
        self.assertIn("'/%2e%2e/outside.png'", errors)
        self.assertEqual(errors.count("escapes the site"), 2)

    def test_srcset_missing_candidate_fails(self) -> None:
        review = self.site / "assets/reviews/test-candidate/v001.html"
        review.write_text(
            review.read_text(encoding="utf-8")
            + '<img srcset="../../media/test-candidate/v001/beauty.png 1x, '
            '../../media/test-candidate/v001/missing.png 2x">',
            encoding="utf-8",
        )
        self.assertIn("missing.png", "\n".join(self.check()))


if __name__ == "__main__":
    unittest.main()
