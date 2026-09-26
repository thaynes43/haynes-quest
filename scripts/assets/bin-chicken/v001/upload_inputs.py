"""WO111 bin-chicken: chunked upload of the approved sheet inputs into instance 2 (sha256 verified remotely)."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,upload,OWNER
SHEET='/home/dev/artifacts/haynes-quest/family-eras/bin-chicken/v001/'
FILES=['reference-sheet.png','reference-notes.md','bin-chicken-blockout.blend','bin-chicken-reference-sheet.blend','blockout-measurements.json','part-measurements.json','sheet-render.json',
 'source/build_blockout.py','source/sheet.py','source/measure_parts.py']
c=MCP()
c.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='bin-chicken' and sc.get('scene_owner')=="+repr(OWNER))
for name in FILES:
 target=name if not name.startswith('source/') else 'sheet-source/'+name.split('/',1)[1]
 print(json.dumps(upload(c,SHEET+name,target)))
