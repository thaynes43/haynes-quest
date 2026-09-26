"""WO111 bounded chunked upload of local artifacts into the authoring workspace."""
from pathlib import Path
import base64,hashlib,json,sys
sys.dont_write_bytecode=True
from transfer import MCP,REMOTE
client=MCP()
client.execute("import bpy; assert bpy.context.scene.get('work_order')=='WO111' and bpy.context.scene.get('scene_lease')=='active' and bpy.context.scene.get('asset_id')=='gadget-helper'")
for local,relative in zip(sys.argv[1::2],sys.argv[2::2]):
 data=Path(local).read_bytes();target=REMOTE+'/'+relative;digest=hashlib.sha256(data).hexdigest()
 client.execute('from pathlib import Path\np=Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")')
 for offset in range(0,len(data),96000):
  client.execute('import base64\nfrom pathlib import Path\nwith Path('+repr(target)+').open("ab") as f:f.write(base64.b64decode('+repr(base64.b64encode(data[offset:offset+96000]).decode())+'))')
 client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(target)+').read_bytes()).hexdigest()=='+repr(digest))
 print(json.dumps({'file':relative,'bytes':len(data),'sha256':digest,'remote_verified':True}))
