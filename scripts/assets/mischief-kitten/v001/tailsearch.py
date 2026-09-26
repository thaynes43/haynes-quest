import bpy,json,runpy,math,itertools
from mathutils import Vector
A=runpy.run_path('/workspace/haynes-quest/family-eras/mischief-kitten/v001/source/animate.py',run_name='search')
ev=A['evaluate'];bp=A['build_pose'];RESTM=A['RESTM'];bones=bpy.data.objects['Mischief_Kitten_Rig'].data.bones
T=['tail_%d'%i for i in range(1,7)]
def pts(P):
 out=[]
 for n in T:
  h=P.point(n,RESTM[n].translation);t=P.point(n,bones[n].tail_local)
  out+=[h,h.lerp(t,1/3),h.lerp(t,2/3)]
 out.append(t);return out
best=[]
for x,y,z,c1 in itertools.product([i*0.1 for i in range(8,19)],[i*0.2 for i in range(-5,4)],[i*0.1 for i in range(-4,12)],[-.4,-.2,0,.2,.4]):
 c=ev('defeat',1.0);c['tail_rot'][0]=Vector((x,y,z));c['tail_curl']=[0.0,c1,0,0,0,0]
 P=bp(c);p=pts(P)
 head=P.point('head',Vector((0,0.19,0.60)))
 legs=[]
 for s in 'RL':
  for n in ('hind_thigh_','hind_shin_','hind_paw_'):
   b=n+s;h=P.point(b,RESTM[b].translation);t=P.point(b,bones[b].tail_local);legs+=[h,(h+t)/2,t]
 mz=min(q.z for q in p);Mz=max(q.z for q in p)
 dh=min((q-head).length for q in p[3:]);dl=min((q-l).length for q in p[2:] for l in legs)
 if mz<0.062 or dh<0.30 or dl<0.13:continue
 ext=max(max(abs(q.x) for q in p),max(-q.y for q in p))
 best.append((round(Mz+0.3*max(0,ext-0.55),4),round(Mz,3),round(mz,3),round(dh,3),round(dl,3),round(ext,3),(round(x,2),round(y,2),round(z,2),c1)))
best.sort();print(json.dumps(best[:10]))
