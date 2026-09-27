"""Local helper: download preview renders from the instance-1 artifact route into the session scratchpad (review only)."""
import sys
sys.dont_write_bytecode = True
from transfer import fetch
S = '/tmp/claude-1000/-home-dev-work-haynes-quest-0925-164654/79a4958b-24ec-416a-b75a-2d14b8bd1e49/scratchpad/lr/'
for f in sys.argv[1:]:
    print(fetch(f, S + f.replace('/', '_')))
