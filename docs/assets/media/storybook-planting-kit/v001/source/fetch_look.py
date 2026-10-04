"""Fetch look renders from instance 2 and tile them into one local PNG for inspection.
usage: python3 fetch_look.py <out-prefix> <views,...> <local.png> [dir]"""
import sys, subprocess, json
sys.dont_write_bytecode = True
from transfer import fetch
prefix, views, dest = sys.argv[1], sys.argv[2].split(','), sys.argv[3]
d = sys.argv[4] if len(sys.argv) > 4 else 'look'
files = []
for v in views:
    p = fetch('%s/%s-%s.png' % (d, prefix, v), '/tmp/mb/look/%s-%s.png' % (prefix, v)); files.append(str(p))
js = "import sharp from 'sharp';const f=%s;const m=await Promise.all(f.map(x=>sharp(x).metadata()));const w=m[0].width,h=m[0].height;await sharp({create:{width:w*f.length,height:h,channels:3,background:'#ffffff'}}).composite(f.map((x,i)=>({input:x,left:i*w,top:0}))).png().toFile(%s);" % (json.dumps(files), json.dumps(dest))
subprocess.run(['node', '--input-type=module', '-e', js], check=True, cwd='/home/dev/work/haynes-quest-1004-180319')
print(dest)
