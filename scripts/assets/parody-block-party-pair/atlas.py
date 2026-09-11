"""WO028 deterministic original pigment atlases; no source images or dependencies.

PNG writing uses only the standard library. Small-scale texture belongs in this
atlas, while silhouette, joints and major folds are real authored geometry.
"""
from pathlib import Path
import hashlib, json, math, random, struct, zlib

REPO = Path(__file__).resolve().parents[3]
PALETTES = {
    'peel-patrol': ['f1c72b','ffe16a','d69c2b','795030','273354','344263','17243d','c8a04d',
                    '26222a','e8bc56','9c7641','e9d392','3d383d','f7dc75','b77929','504057'],
    'drama-dragon': ['252330','312d3b','1b1924','484451','85808a','696774','71375f','944c80',
                    'd5a758','f3d184','ad42e3','e794ff','100f19','ada5aa','593451','43404a'],
}

def chunk(kind, data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)

def main(remote=False):
    manifests={}
    for asset,colors in PALETTES.items():
        rng=random.Random(28001 if asset=='peel-patrol' else 28002)
        panels=[]
        for tile,hexc in enumerate(colors):
            base=[int(hexc[i:i+2],16) for i in (0,2,4)]
            speckles=[(rng.randrange(12,244),rng.randrange(12,244),rng.uniform(.45,1.6)) for _ in range(45)]
            mottles=[[rng.uniform(-4,5) for x in range(8)] for y in range(8)]
            panel=[]
            for y in range(256):
                for x in range(256):
                    noise=rng.gauss(0,1.4)
                    wash=2.0*math.sin(x*.024+y*.011)+1.4*math.sin(y*.061-x*.019)
                    if asset=='peel-patrol':
                        if tile in [0,1,2,13,14]:
                            wash += 2.1*math.sin(x*.061)+.7*math.sin(x*.41+y*.009)
                            for px,py,r in speckles:
                                if abs(x-px)<r and abs(y-py)<r*1.6:
                                    wash-=35;break
                        elif tile in [4,5,6,15]:
                            wash += (x%3==0)*2.1+(y%3==0)*1.6
                        elif tile in [7,9,10]:
                            wash+=1.5*math.sin(y*.62)
                    else:
                        if tile in [0,1,2,3,12,15]:
                            wash+=mottles[y//32][x//32]
                            if x%64<2 or y%64<2:wash-=7
                            if x%64 in (2,3) or y%64 in (2,3):wash+=3
                        elif tile in [6,7,14]:
                            wash+=(x%3==0)*1.8+(y%4==0)*2.0
                        elif tile in [10,11]:
                            wash=2.5*math.sin(x*.04)+rng.gauss(0,.5)
                    panel.extend(max(0,min(255,round(c+noise+wash))) for c in base)
            panels.append(bytes(panel))
        rows=[]
        for y in range(1024):
            row=b'\x00'
            for tx in range(4):
                p=panels[y//256*4+tx]
                row+=p[(y%256)*768:(y%256+1)*768]
            rows.append(row)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',1024,1024,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
        folder=(Path(__file__).resolve().parent/asset) if remote else REPO/'docs/assets/media'/asset/'v001';folder.mkdir(parents=True,exist_ok=True)
        out=folder/'pigment.png';out.write_bytes(png)
        record={'asset_id':asset,'method':'Original deterministic pigment, banana speckle / cloth weave / voxel wash atlas; standard-library PNG writer.',
                'seed':28001 if asset=='peel-patrol' else 28002,'dimensions':[1024,1024],'colors':colors,
                'bytes':len(png),'sha256':hashlib.sha256(png).hexdigest(),'source_images':[]}
        (folder/'atlas-source.json').write_text(json.dumps(record,indent=2)+'\n');manifests[asset]=record
    print(json.dumps(manifests,indent=2))

if __name__=='__main__':main()
