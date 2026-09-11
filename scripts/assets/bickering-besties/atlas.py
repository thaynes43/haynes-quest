"""Original WO051 color atlas: deterministic woven cloth and sculpted pigment.

No photographs, generated images or downloaded textures are sampled. The approved
concept informs the manually selected palette only. Each character uses one 1k
atlas, with quiet texture kept below the silhouette and face contrast.
"""
from pathlib import Path
import hashlib, json, math, struct, zlib

REPO = Path(__file__).resolve().parents[3]
PALETTES = {
    'bestie-pink': ['efb982','cd895a','fff7ed','29212b','ed669e','ffb5d0',
                    'dca54f','ffd174','e5418b','36272b','76392e','f17d7c',
                    'f3eeeb','d85898','ef947e','b74d7f'],
    'bestie-black':['e8ad79','c88054','fff4e9','211c27','2e2831','423845',
                    '231e2b','43394c','a56bd3','30232b','713a2e','db7776',
                    'e8e4e9','8250ae','de8b79','615369'],
}

def main():
    for index,(name,colors) in enumerate(PALETTES.items()):
        seed=51000+index
        rgb=[tuple(int(color[i:i+2],16) for i in (0,2,4)) for color in colors]
        pixels=bytearray()
        for y in range(1024):
            pixels.append(0)
            for x in range(1024):
                tile=y//256*4+x//256; xx=x%256; yy=y%256
                grain=round(math.sin(xx*1.8)*math.cos(yy*1.5)) if tile in (4,5,8,15) else 0
                if tile in (6,7):grain+=round(math.sin(xx*.14+math.sin(yy*.025)*.25))
                pixels.extend(max(0,min(255,c+grain)) for c in rgb[tile])
        def chunk(kind,data):
            return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(pixels),9))+chunk(b'IEND',b'')
        folder=REPO/'docs/assets/media'/name/'v001';folder.mkdir(parents=True,exist_ok=True)
        path=folder/'pigment.png';path.write_bytes(png)
        (folder/'atlas-provenance.json').write_text(json.dumps({
            'work_order':'WO051','asset_id':name,'version':'v001','seed':seed,
            'size':[1024,1024],'palette':colors,'method':'Original deterministic pigment swatches; subtle woven cloth and hair color variation. No sampled media.',
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,
        },indent=2)+'\n')
        print(name,path.stat().st_size)

if __name__=='__main__':main()
