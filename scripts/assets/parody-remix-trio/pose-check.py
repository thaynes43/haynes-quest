"""A few actual-GLB contact/defeat views before the full media render."""
import bpy,json,sys,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from render import clear,load,studio,set_pose,shot
args=sys.argv[sys.argv.index('--')+1:];name=args[0]
root=Path('/workspace/haynes-quest/parody/remix-trio/v001')/name
record=json.loads((root/'construction.json').read_text());h=record['spec']['height'];attack=next(c for c in record['clips'] if c['name']=='attack');defeat=next(c for c in record['clips'] if c['name']=='defeat')
clear();bpy.context.scene.render.fps=24;arm=load(root/(name+'.glb'));cam=studio(h,width=700,height_px=800,samples=10);target=(0,0,h*.50);views=[]
for file,clip,seconds,position in [('contact-pose.png','attack',attack['contact_time_s'],(2.8*h,5*h,2.4*h)),('contact-followthrough.png','attack',min(attack['duration_s'],attack['contact_time_s']+.12),(2.8*h,5*h,2.4*h)),('defeat-pose.png','defeat',defeat['duration_s'],(2.8*h,5*h,2.4*h)),('defeat-side.png','defeat',defeat['duration_s'],(5*h,0,h*.50))]:
 set_pose(arm,clip,seconds*24);shot(root/file,cam,position,target,h*1.43);views.append({'file':file,'clip':clip,'time_s':seconds})
(root/'pose-check.json').write_text(json.dumps({'asset_id':name,'glb_sha256':hashlib.sha256((root/(name+'.glb')).read_bytes()).hexdigest(),'views':views},indent=2)+'\n')
