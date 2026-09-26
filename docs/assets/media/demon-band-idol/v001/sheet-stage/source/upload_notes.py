"""Upload reference-notes.md (written locally) to the remote v001 directory with a sha256 check."""
from pathlib import Path
import base64, hashlib, json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcpclient import MCP
from run import REMOTE, OWNER
data = (Path(__file__).resolve().parent.parent / 'reference-notes.md').read_bytes(); digest = hashlib.sha256(data).hexdigest()
c = MCP()
print(c.text("import bpy; sc=bpy.context.scene; assert sc.get('asset_id')=='demon-band-idol' and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER)))
print(c.text('from pathlib import Path\nimport hashlib,base64\np=Path(' + repr(REMOTE + '/reference-notes.md') + ')\np.write_bytes(base64.b64decode(' + repr(base64.b64encode(data).decode()) +
             '))\nassert hashlib.sha256(p.read_bytes()).hexdigest()==' + repr(digest) + '\nprint("ok")'))
print(json.dumps({'file': 'reference-notes.md', 'bytes': len(data), 'sha256': digest, 'remote_verified': True}))
