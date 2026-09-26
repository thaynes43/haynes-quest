"""WO111 inator-monster: chunked upload of the approved sheet inputs into instance 2 (sha256 verified remotely)."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,upload
SHEET='/home/dev/artifacts/haynes-quest/family-eras/inator-monster/v001/'
FILES=['reference-sheet.png','reference-notes.md','inator-monster-blockout.blend','inator-monster-reference-sheet.blend','blockout-measurements.json','part-measurements.json','source/build_blockout.py','source/sheet.py']
c=MCP()
c.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='inator-monster' and sc.get('scene_owner')=='claude-opus-5-5/inator-monster-model'")
for name in FILES:
 target=name if not name.startswith('source/') else 'sheet-source/'+name.split('/',1)[1]
 print(json.dumps(upload(c,SHEET+name,target)))
