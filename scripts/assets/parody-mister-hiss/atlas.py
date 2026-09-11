"""WO027 original paper/pigment atlas; deterministic, no input images."""
from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'docs/assets/media/mister-hiss/v001/pigment.png'
COLORS = ['82ae46','92bc51','a2ca60','6d9d48','568643','31563b',
          '823c84','773073','dcb253','152019','fff1c5','c48726',
          'c7429f','53bec7','f1c64b','9fce52']
rng = np.random.default_rng(27001)
atlas = Image.new('RGB', (1024, 1024))
for tile, hexc in enumerate(COLORS):
    color = np.array([int(hexc[i:i+2], 16) for i in (0, 2, 4)])
    noise = rng.normal(0, 1.5 if tile in (9,10,11) else 2.8, (256,256,1))
    yy,xx = np.mgrid[:256,:256]
    fiber = (np.sin(xx*.74+yy*.025)*.75 + np.sin(yy*.44+xx*.042)*.7)[:,:,None]
    paper = np.uint8(np.clip(color + noise + fiber, 0, 255))
    panel = Image.fromarray(paper)
    draw = ImageDraw.Draw(panel)
    rr = random.Random(27001+tile)
    if tile == 0:
        for y in range(0,256,64):
            for x in range(0,256,64):
                wash = rr.choice([(152,189,81,32),(55,94,48,35),(179,210,95,30)])
                overlay = Image.new('RGBA',(256,256))
                ImageDraw.Draw(overlay).rectangle((x,y,x+63,y+63),fill=wash)
                panel = Image.alpha_composite(panel.convert('RGBA'),overlay).convert('RGB')
    if tile == 7:
        for i in range(17):
            x,y = rr.randint(15,242),rr.randint(15,242)
            c = ['#edbe46','#bf54a1','#61bec4','#a4c94f'][i%4]
            if i%3==0:
                poly=[]
                for j in range(10):
                    a=-math.pi/2+j*math.pi/5;r=15 if j%2==0 else 6
                    poly.append((x+math.cos(a)*r,y+math.sin(a)*r))
                draw.polygon(poly,fill=c)
            elif i%3==1:
                draw.polygon([(x-9,y-12),(x+9,y-6),(x+4,y+12),(x-13,y+6)],fill=c)
            else:draw.ellipse((x-7,y-6,x+7,y+6),fill=c)
    # Borders avoid neighboring swatches leaking through filtering.
    atlas.paste(panel,((tile%4)*256,(tile//4)*256))
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
atlas.save(OUTPUT,optimize=True)
print(OUTPUT)
