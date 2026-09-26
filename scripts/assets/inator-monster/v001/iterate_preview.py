"""Iteration helper: rebuild the blockout and render the half-size sheet preview."""
import runpy
S = '/workspace/haynes-quest/family-eras/inator-monster/v001/source/'
runpy.run_path(S + 'build_blockout.py', run_name='__main__')
runpy.run_path(S + 'sheet.py', run_name='__main__', init_globals={'SHEET_PERCENT': 50, 'SHEET_SAMPLES': 16, 'SHEET_OUT': 'preview/sheet-preview.png'})
