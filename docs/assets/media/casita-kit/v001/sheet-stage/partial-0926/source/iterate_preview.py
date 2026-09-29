"""Iteration helper: rebuild the blockout, render a sheet preview (ITER_PERCENT, default 50) and optional close-up crops."""
import runpy
S = '/workspace/haynes-quest/family-eras/casita-kit/v001/source/'
ONLY = globals().get('ITER_CROPS', [])
PCT = globals().get('ITER_PERCENT', 50)
OUT = 'preview/sheet-preview.png' if PCT < 100 else 'preview/sheet-full-draft.png'
runpy.run_path(S + 'build_blockout.py', run_name='__main__')
runpy.run_path(S + 'sheet.py', run_name='__main__', init_globals={'SHEET_PERCENT': PCT, 'SHEET_SAMPLES': 16, 'SHEET_OUT': OUT})
if ONLY:
    runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 16, 'CROP_ONLY': ONLY})
