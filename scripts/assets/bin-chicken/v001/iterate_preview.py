"""Iteration helper: rebuild the blockout, render the half-size sheet preview and quick face crops."""
import runpy
S = '/workspace/haynes-quest/family-eras/bin-chicken/v001/source/'
runpy.run_path(S + 'build_blockout.py', run_name='__main__')
runpy.run_path(S + 'sheet.py', run_name='__main__', init_globals={'SHEET_PERCENT': 50, 'SHEET_SAMPLES': 16, 'SHEET_OUT': 'preview/sheet-preview.png'})
runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 16, 'CROP_ONLY': ['crop-face-three-quarter.png', 'crop-back.png']})
