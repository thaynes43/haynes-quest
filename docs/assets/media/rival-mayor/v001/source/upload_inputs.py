"""WO111 rival-mayor: chunked upload of the approved sheet inputs into instance 2."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,upload
SHEET='/home/dev/artifacts/haynes-quest/family-eras/rival-mayor/v001/'
FILES=['reference-sheet.png','reference-notes.md','rival-mayor-blockout.blend','rival-mayor-reference-sheet.blend','blockout-measurements.json','source/build_blockout.py','source/sheet.py']
c=MCP()
c.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='rival-mayor'")
for name in FILES:
 target=name if not name.startswith('source/') else 'sheet-source/'+name.split('/',1)[1]
 print(json.dumps(upload(c,SHEET+name,target)))
