"""Author helper (not evidence): paint the atlas alone for inspection."""
import importlib.util,time
spec=importlib.util.spec_from_file_location('dbi_paint','/workspace/haynes-quest/family-eras/demon-band-idol/v001/source/paint.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
t=time.time();print(P.paint_atlas('/workspace/haynes-quest/family-eras/demon-band-idol/v001/pigment-test.png'),time.time()-t)
