"""WO111 putty-grunt: chunked upload of the approved sheet inputs into instance 2 (sha256 verified remotely)."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,upload
SHEET='/home/dev/artifacts/haynes-quest/family-eras/putty-grunt/v001/'
FILES=['reference-sheet.png','reference-notes.md','putty-grunt-blockout.blend','putty-grunt-reference-sheet.blend','blockout-measurements.json','part-measurements.json','sheet-render.json','source/build_blockout.py','source/sheet.py']
c=MCP()
c.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='putty-grunt' and sc.get('scene_owner')=='claude-opus-5-5/putty-grunt-model'")
for name in FILES:
 target=name if not name.startswith('source/') else 'sheet-source/'+name.split('/',1)[1]
 print(json.dumps(upload(c,SHEET+name,target)))
