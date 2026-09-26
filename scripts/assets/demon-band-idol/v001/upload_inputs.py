"""WO111 demon-band-idol: chunked, sha256-verified upload of the approved sheet inputs into instance 2."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,upload
SHEET='/home/dev/artifacts/haynes-quest/family-eras/demon-band-idol/v001/'
FILES=['reference-sheet.png','reference-notes.md','demon-band-idol-blockout.blend','demon-band-idol-reference-sheet.blend','blockout-measurements.json','part-measurements.json','source/build_blockout.py','source/sheet.py']
c=MCP();c.guard()
for name in FILES:
 target=name if not name.startswith('source/') else 'sheet-source/'+name.split('/',1)[1]
 print(json.dumps(upload(c,SHEET+name,target)))
