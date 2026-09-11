"""Exclusive-lease entry point: one requested character, never the whole trio."""
import sys, importlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1 or args[0] not in ('sir-flush-a-lot','nap-captain','one-star-diva'):
 raise SystemExit('One explicit asset name is required; author models sequentially.')
importlib.import_module(args[0]).main()
