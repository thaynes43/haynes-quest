#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

python3 scripts/docs/prepare.py
python3 scripts/docs/check_links.py .docs-build
python3 -m mkdocs build --strict --clean
