"""Author diagnostic (not evidence): which bones still move in the held defeat."""
import runpy,json
g=runpy.run_path('/workspace/haynes-quest/family-eras/demon-band-idol/v001/source/animate.py',run_name='probe')
P0=g['build_pose'](g['evaluate']('defeat',53/72))
out={}
for f in range(54,73):
 P=g['build_pose'](g['evaluate']('defeat',f/72))
 for n in P.M:
  d=max(abs(P.M[n][i][j]-P0.M[n][i][j]) for i in range(4) for j in range(4))
  if d>1e-7:out[n]=max(out.get(n,0),d)
print(json.dumps(out))
c0=g['evaluate']('defeat',53/72);c1=g['evaluate']('defeat',60/72)
for k in c0:
 a=c0[k];b=c1[k]
 try:
  if a!=b:print(k,a,b)
 except Exception as e:print(k,'cmp-err')
