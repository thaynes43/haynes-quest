"""Upload reference-notes.md (written locally) to the remote v001 directory with a sha256 check (lease asserted first)."""
import json, sys
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import MCP, GUARD, upload
c = MCP(); c.text(GUARD)
print(json.dumps(upload(c, Path(__file__).resolve().parent.parent / 'reference-notes.md', 'reference-notes.md')))
