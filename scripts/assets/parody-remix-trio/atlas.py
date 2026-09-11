"""WO032 original deterministic ceramic/plush/fashion atlases; no image inputs."""
from pathlib import Path
import math, random, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, __version__ as pillow_version

REPO=Path(__file__).resolve().parents[3]
PALETTES={
 'sir-flush-a-lot':['f0ebe1','e5e7df','d69a70','e6aa83','29201f','151e21','fff5dc','d9a93d','279da8','381714','bd5960','cee7e5','78502c','4d7baa','a77425','f5cb69'],
 'nap-captain':['7744a3','a16dc1','1f1527','fff4d7','263454','ece1c2','42aabb','edd689','d7a738','362640','af69bd','614b39','f8e3a2','395577','654089','9b55ae'],
 'one-star-diva':['db3586','ad80c1','a56b47','211d20','d0a344','f2e8cd','299da7','201721','fff2dc','6b402b','b95150','e44998','af2968','a987c2','b57b54','eebb59']}

def main():
 for index,(name,colors) in enumerate(PALETTES.items()):
  seed=32001+index; rng=np.random.default_rng(seed); yy,xx=np.mgrid[:256,:256]
  atlas=Image.new('RGB',(1024,1024))
  for tile,color in enumerate(colors):
   c=np.array([int(color[i:i+2],16) for i in (0,2,4)])
   cloth=(name=='nap-captain' and tile not in (2,3,8,9,11)) or (name=='one-star-diva' and tile in (0,1,11,12)) or (name=='sir-flush-a-lot' and tile==8)
   plush=name=='nap-captain' and tile in (0,1,10,14,15)
   noise=rng.normal(0,2.9 if plush else 1.8 if cloth else .55,(256,256))
   grain=(np.sin(xx*1.7)*np.cos(yy*1.4)*2.7+np.sin(yy*.44+xx*.013)*.55) if cloth else (np.sin(xx*.065+yy*.021)*.75)
   if plush:grain+=np.sin(xx*.78+yy*1.41)*1.65
   panel=Image.fromarray(np.uint8(np.clip(c+(noise+grain)[:,:,None],0,255)))
   d=ImageDraw.Draw(panel)
   if plush:
    rr=random.Random(seed*19+tile)
    for _ in range(2800):
     x,y=rr.randrange(256),rr.randrange(256);delta=rr.choice([-7,5,7]); cc=tuple(int(v) for v in np.clip(c+delta,0,255));d.line((x,y,x+rr.choice([-1,0,1]),y+2),fill=cc,width=1)
   if name=='nap-captain' and tile in (6,7,12):
    line=tuple(int(v) for v in np.clip(c-14,0,255));hi=tuple(int(v) for v in np.clip(c+10,0,255))
    for j in range(-256,512,64):
     d.line((j,0,j+256,256),fill=line,width=2);d.line((j+3,0,j+259,256),fill=hi,width=1)
     d.line((j,0,j-256,256),fill=line,width=2)
   if name=='nap-captain' and tile==4:
    for y in range(-80,320,76):d.polygon([(0,y),(256,y+55),(256,y+86),(0,y+31)],fill='#e9dfc6')
   if name=='sir-flush-a-lot' and tile==13:
    # Restrained original glaze flourish tile: broad enough for a small cistern.
    panel=Image.new('RGB',(256,256),'#eee9df');d=ImageDraw.Draw(panel)
    for sign in (-1,1):
     pts=[]
     for k in range(64):
      a=k/63*math.pi*2.4;r=43*(1-k/90);pts.append((128+sign*(32+r*math.cos(a)),135+r*math.sin(a)))
     d.line(pts,fill='#4e7dad',width=5)
     d.line([(128,187),(128+sign*34,211),(128+sign*62,186)],fill='#4e7dad',width=5)
    d.polygon([(108,55),(116,71),(128,48),(140,71),(149,55),(143,91),(113,91)],fill='#4e7dad')
   atlas.paste(panel,((tile%4)*256,(tile//4)*256))
  folder=REPO/'docs/assets/media'/name/'v001';folder.mkdir(parents=True,exist_ok=True)
  p=folder/'pigment.png';atlas.save(p,optimize=True)
  (folder/'atlas-provenance.json').write_text(json.dumps({'work_order':'WO-032','asset_id':name,'method':'Original deterministic swatches with ceramic glaze, short plush fibres, woven/quilt stitches or satin grain authored procedurally; no input or downloaded textures.','seed':seed,'size':[1024,1024],'palette':colors,'pillow':pillow_version,'numpy':np.__version__,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size},indent=2)+'\n')
  print(name,p.stat().st_size)
if __name__=='__main__':main()
