"""WO111 lab-robot author helper (not evidence): paint the atlas to author-preview/pigment-test.png for review."""
import importlib.util, json, time
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
spec = importlib.util.spec_from_file_location('wo111_lr_paint', ROOT / 'source/paint.py'); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
(ROOT / 'author-preview').mkdir(exist_ok=True); t = time.time()
P.paint_atlas(str(ROOT / 'author-preview/pigment-test.png')); print(json.dumps({'seconds': round(time.time() - t, 1)}))
