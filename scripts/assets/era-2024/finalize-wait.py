"""Bounded filesystem-only finalization after isolated GLB renders complete.

This process imports no Blender API and never contacts the live editor/addon.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

root=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/haynes-quest/era-2024/v001')
assets=('loop-dancer','prism-mimic','trendweaver')
started=time.time();deadline=started+1800
while time.time()<deadline:
 ready=[]
 for name in assets:
  folder=root/name;completion=folder/'render-complete.json';three=folder/'three-inspection.json'
  try:
   record=json.loads(completion.read_text());check=json.loads(three.read_text())
   current=hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest()
   if record['stills'] and record['video'] and record['sha256']==current==check['glb_sha256'] and all(check['checks'].values()):ready.append(name)
  except (FileNotFoundError,KeyError,json.JSONDecodeError):pass
 if len(ready)==len(assets):
  result=subprocess.run([sys.executable,str(root/'delivery.py'),'--output',str(root)],capture_output=True,text=True)
  status={'status':'complete' if result.returncode==0 else 'failed','started_unix':started,'finished_unix':time.time(),'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
  (root/'finalize-status.json').write_text(json.dumps(status,indent=2)+'\n')
  print(json.dumps(status));sys.exit(result.returncode)
 time.sleep(4)
status={'status':'timed out waiting for exact render/Three reports','started_unix':started,'finished_unix':time.time(),'ready_assets':ready}
(root/'finalize-status.json').write_text(json.dumps(status,indent=2)+'\n')
print(json.dumps(status));sys.exit(1)
