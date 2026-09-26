"""WO111 toon-clubhouse-kit: chunked upload of the Astra concept draft inputs into instance 1 (sha256 verified remotely)."""
import json, sys
sys.dont_write_bytecode = True
from transfer import MCP, upload, GUARD
KIT = '/home/dev/artifacts/haynes-quest/family-eras/toon-clubhouse-kit/v001/'
c = MCP(); c.execute(GUARD)
for name in ['concept-draft.png', 'prompt.txt', 'revision-prompt.txt']:
    print(json.dumps(upload(c, KIT + name, 'inputs/' + name)))
