"""Author helper (not evidence): paint the atlas alone to author-preview/pigment-test.png."""
import importlib.util,time
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
spec=importlib.util.spec_from_file_location('wo111_rhs_paint',ROOT/'source/paint.py');P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
(ROOT/'author-preview').mkdir(exist_ok=True);t=time.time()
print(P.paint_atlas(str(ROOT/'author-preview/pigment-test.png')),'%.1fs'%(time.time()-t))
