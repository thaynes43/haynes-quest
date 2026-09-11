"""One-asset entry point. Requires the live WO051 lease; no factory reset."""
import sys, json, importlib
from pathlib import Path
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1 or args[0] not in ('bestie-pink','bestie-black'):raise SystemExit('Choose exactly one scoped asset.')
lease=json.loads((HERE/'scene-lease.json').read_text())
assert lease['owner']=='/root/besties_models' and lease['status'].startswith('active'),lease
import common,model,rig
for module in (common,model,rig):importlib.reload(module)
pink=model.construct(args[0])
arm,skin,inventory,factor,low=rig.build_rig()
import bpy
bpy.ops.wm.save_as_mainfile(filepath=str(common.CURRENT/(args[0]+'-rig-checkpoint.blend')),compress=True)
clips=rig.animate(arm,skin,pink,factor,low)
rig.export(arm,skin,inventory,clips,factor,low)
