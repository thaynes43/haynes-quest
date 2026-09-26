"""WO111 bin-chicken author probe (not evidence): which bones differ between two clip times."""
import runpy,json
A=runpy.run_path('/workspace/haynes-quest/family-eras/bin-chicken/v001/source/animate.py',run_name='probe')
G=A['build_pose'].__globals__
a=G['build_pose'](G['evaluate']('hit',0.0));b=G['build_pose'](G['evaluate']('hit',1.0))
d={n:round(max(abs(a.M[n][i][j]-b.M[n][i][j]) for i in range(4) for j in range(4)),4) for n in a.M}
print(json.dumps({k:v for k,v in d.items() if v>1e-4}))
