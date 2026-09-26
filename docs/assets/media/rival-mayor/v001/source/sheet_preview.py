"""Low-cost preview of the reference sheet (same scene code as sheet.py, smaller render)."""
import runpy, sys
N = globals().get('PREVIEW_N', 1)
runpy.run_path('/workspace/haynes-quest/family-eras/rival-mayor/v001/source/sheet.py', run_name='__main__',
               init_globals={'SHEET_PERCENT': 50, 'SHEET_SAMPLES': 16, 'SHEET_OUT': 'preview/sheet-preview.png'})
