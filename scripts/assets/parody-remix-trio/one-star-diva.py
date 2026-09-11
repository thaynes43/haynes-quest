"""Original adult fashion avatar, absurd attached coat, one right-hand vote."""
import math
import common as c

def sleeve_weight(side):
 def weights(p):
  shoulder=(side*.205,0,1.155);d=((p.x-shoulder[0])**2+p.y*p.y+(p.z-shoulder[2])**2)**.5
  w=c.smooth((d-.065)/.255);return {'spine':1-w,'hand_'+('L' if side<0 else 'R'):w}
 return weights

def leg_weight(label):
 def weights(p):
  if p.z>.53:
   w=c.smooth((p.z-.72)/.12);return {'thigh_'+label:1-w,'body':w}
  w=c.smooth((.56-p.z)/.09);return {'thigh_'+label:1-w,'calf_'+label:w}
 return weights

def coat_shell(name,profiles,bn,tile=0,n=24):
 # A fully closed thick shell around the back and sides, with real front opening.
 verts=[]
 for inner in [False,True]:
  for z,rx,ry,gap in profiles:
   for i in range(n):
    a=math.pi/2+gap+(math.tau-2*gap)*i/(n-1)
    verts.append(((rx-(.010 if inner else 0))*math.cos(a),(ry-(.010 if inner else 0))*math.sin(a),z))
 rows=len(profiles);offset=rows*n;faces=[]
 for layer in range(2):
  off=layer*offset
  for j in range(rows-1):
   for i in range(n-1):faces.append((off+j*n+i,off+j*n+i+1,off+(j+1)*n+i+1,off+(j+1)*n+i))
 for i in range(n-1):
  faces.extend([(i,i+1,offset+i+1,offset+i),((rows-1)*n+i,(rows-1)*n+i+1,offset+(rows-1)*n+i+1,offset+(rows-1)*n+i)])
 for j in range(rows-1):
  for i in [0,n-1]:faces.append((j*n+i,(j+1)*n+i,offset+(j+1)*n+i,offset+j*n+i))
 return c.mesh(name,verts,faces,tile,bn,smooth=True)

def character():
 c.bone('body',(0,0,.833),'root');c.bone('spine',(0,0,.924));c.bone('head',(0,0,1.239),'spine')
 c.bone('skirt',(0,0,.897));c.bone('coat',(0,0,.910))
 c.bone('hand_R',(.393,.123,.804),'spine');c.bone('hand_L',(-.230,.206,.959),'spine')
 for sx,label in [(-1,'L'),(1,'R')]:
  c.bone('thigh_'+label,(sx*.103,0,.796));c.bone('calf_'+label,(sx*.111,.003,.505),'thigh_'+label);c.bone('foot_'+label,(sx*.118,.013,.217),'calf_'+label)
 c.bone('brow_L',(-.072,.117,1.522),'head');c.bone('brow_R',(.072,.117,1.522),'head')
 # Deliberately long toy legs, opaque lilac dress, stable broad low heels.
 c.ellipsoid('Body | clothed avatar torso',(0,0,1.035),(.154,.105,.218),1,'spine',n=14,r=7)
 c.lathe('Dress | opaque high-neck ribbed collar',(0,0,0),[(1.196,.079),(1.233,.075),(1.255,.080)],1,'spine',n=24,ellipse=(1,.91))
 c.lathe('Dress | opaque knee-length lilac skirt',(0,.002,0),[(.498,.208),(.518,.214),(.696,.181),(.827,.150),(.906,.142)],1,'skirt',n=28,ellipse=(1,.75))
 c.lathe('Neck | warm brown toy neck',(0,0,0),[(1.203,.060),(1.300,.062)],2,'head',1,n=20,ellipse=(1,.92))
 for sx,label in [(-1,'L'),(1,'R')]:
  c.curve('Leg | '+label+' long articulated toy leg',[(sx*.099,0,.812),(sx*.107,0,.660),(sx*.111,.003,.505),(sx*.117,.012,.344),(sx*.118,.013,.213)],[.068,.062,.054,.051,.052],2,'body',1,n=14,steps=2,weights=leg_weight(label))
  c.lathe('Boot | '+label+' soft turquoise shaft',(sx*.118,.013,0),[(.120,.063),(.230,.060),(.259,.064),(.271,.065)],6,'foot_'+label,3,n=20,ellipse=(1,.92))
  c.ellipsoid('Boot | '+label+' broad rounded forward toe',(sx*.118,.074,.069),(.079,.131,.066),6,'foot_'+label,3,n=14,r=7)
  c.box('Boot | '+label+' stable complete sole',(sx*.118,.076,.018),(.165,.264,.036),6,'foot_'+label,bevel=.016,segments=2,mat=3)
  c.box('Boot | '+label+' practical low heel',(sx*.118,-.021,.044),(.130,.095,.061),6,'foot_'+label,bevel=.012,segments=2,mat=3)
  c.ellipse_loop('Boot | '+label+' top seam',(sx*.118,.013,.263),.063,.057,.003,6,'foot_'+label,3,n=28,tube_n=6)
 # Complete oversized coat with a generous front opening and sewn back shell.
 lower=[(.180,.413,.255,.385),(.205,.425,.263,.385),(.420,.344,.231,.35),(.655,.265,.190,.30),(.880,.180,.149,.24),(.929,.173,.142,.25)]
 coat_shell('Coat | complete thick flared lower shell',lower,'coat')
 coat_shell('Coat | connected upper back and side tailoring',[(.902,.177,.145,.36),(1.035,.198,.153,.48),(1.165,.220,.156,.74),(1.228,.195,.130,.87)],'spine')
 for sx,label in [(-1,'L'),(1,'R')]:
  edge=[]
  for z,rx,ry,g in lower:edge.append((sx*rx*math.sin(g),ry*math.cos(g)+.003,z+.003))
  c.curve('Coat | '+label+' continuous front stitched piping',edge,.0038,11,'coat',n=6,steps=2)
  # Exaggerated folded lapels and their rolled collar corners.
  poly=[(sx*.045,1.187),(sx*.162,1.255),(sx*.278,1.208),(sx*.176,1.153),(sx*.086,.981),(sx*.063,1.098)]
  c.prism('Collar | '+label+' giant folded lapel',poly,.132,.045,0,'spine',bevel=.012)
  c.curve('Collar | '+label+' soft rolled upper edge',[(sx*.044,.148,1.192),(sx*.162,.158,1.241),(sx*.260,.141,1.210)],.014,11,'spine',n=8,steps=2)
 hem=[]
 for i in range(41):
  a=math.pi/2+.40+(math.tau-.8)*i/40;hem.append((.414*math.cos(a),.256*math.sin(a),.209))
 c.tube('Coat | continuous stitched rear hem',hem,.0037,11,'coat',n=5)
 # Huge soft sleeves stay sewn at their shoulders; hand endpoints carry cuffs.
 c.curve('Sleeve | right oversized attached puff',[(.198,0,1.166),(.284,.000,1.135),(.340,.007,1.043),(.365,.034,.943),(.381,.083,.871)],[.104,.160,.163,.102,.060],0,'spine',n=14,steps=3,weights=sleeve_weight(1))
 c.curve('Sleeve | left oversized attached puff',[(-.198,0,1.166),(-.285,0,1.119),(-.358,.015,1.030),(-.324,.127,.959),(-.230,.206,.959)],[.105,.163,.162,.103,.062],0,'spine',n=14,steps=3,weights=sleeve_weight(-1))
 c.box('Cuff | right rolled pink cuff',(.388,.102,.872),(.127,.127,.076),0,'hand_R',bevel=.025,segments=2)
 c.box('Cuff | left rolled pink cuff',(-.231,.204,.972),(.122,.123,.087),0,'hand_L',bevel=.025,segments=2)
 c.box('Hand | right simplified block grip',(.393,.123,.804),(.082,.075,.114),2,'hand_R',bevel=.020,segments=2,mat=1)
 c.box('Hand | left simplified block coat-clutch',(-.230,.226,.958),(.081,.067,.102),2,'hand_L',bevel=.018,segments=2,mat=1,rot=(0,.12,0))
 for label,point in [('R',(.393,.158,.804)),('L',(-.230,.255,.958))]:
  for i in range(3):
   c.box('Hand | '+label+' rounded finger fold %d'%i,(point[0],point[1],point[2]-.031+i*.027),(.069,.021,.022),14,'hand_'+label,bevel=.007,segments=2,mat=1)
 c.ellipsoid('Hand | right wrapped thumb',(.357,.163,.820),(.022,.024,.038),2,'hand_R',1,n=12,r=6,rot=(0,-.3,0))
 # One continuous waist belt connects the central clasp and oversized rear bow.
 c.lathe('Belt | complete continuous wide waist band',(0,0,0),[(.884,.187),(.948,.187),(.948,.176),(.884,.176)],12,'body',n=32,ellipse=(1,.82))
 c.ellipsoid('Clasp | attached oversized gold button',(0,.161,.917),(.045,.021,.049),4,'body',4,n=14,r=7)
 c.ellipsoid('Clasp | inset gold face',(0,.182,.917),(.031,.006,.035),15,'body',4,n=14,r=7)
 c.bow('Rear bow | sewn oversized belt bow',(0,-.181,.922),.251,11,'body',5,back=True)
 c.contact('Belt | complete continuous wide waist band','Clasp | attached oversized gold button')
 c.contact('Belt | complete continuous wide waist band','Rear bow | sewn oversized belt bow | sewn center knot')
 # Voting paddle: exact one front star, plain lavender rear, handle inside grip.
 c.box('Paddle | single attached gold handle',(.408,.161,.826),(.032,.031,.267),4,'hand_R',bevel=.008,segments=2,mat=4)
 c.box('Paddle | one chunky gold-rim board',(.408,.161,1.040),(.221,.041,.260),4,'hand_R',bevel=.026,segments=3,mat=4)
 c.box('Paddle | ivory front voting face',(.408,.185,1.040),(.190,.010,.229),5,'hand_R',bevel=.017,segments=2,mat=4)
 c.box('Paddle | plain lavender back',(.408,.137,1.040),(.190,.010,.229),13,'hand_R',bevel=.017,segments=2,mat=4)
 star=[]
 for i in range(10):
  a=math.pi/2+i*math.pi/5;r=.072 if i%2==0 else .031;star.append((.408+math.cos(a)*r,1.044+math.sin(a)*r))
 c.prism('Paddle | exactly one gold star',star,.194,.008,4,'hand_R',4,bevel=.002)
 c.contact('Hand | right simplified block grip','Paddle | single attached gold handle')
 c.contact('Paddle | single attached gold handle','Paddle | one chunky gold-rim board')
 # Adult cartoon face and bob, clear eyes and indignant pout at game scale.
 c.ellipsoid('Head | single warm brown adult cartoon face',(0,.002,1.444),(.156,.118,.192),2,'head',1,n=24,r=12)
 for sx,label in [(-1,'L'),(1,'R')]:
  c.ellipsoid('Head | '+label+' warm brown ear',(sx*.151,.004,1.417),(.024,.025,.040),2,'head',1,n=12,r=6)
  x=sx*.063
  c.ellipsoid('Eye | '+label+' half-lidded ivory almond',(x,.112,1.465),(.049,.017,.024),8,'head',2,n=14,r=7,rot=(0,-sx*.10,0))
  c.ellipsoid('Eye | '+label+' expressive brown iris',(x-sx*.006,.128,1.463),(.021,.007,.022),9,'head',2,n=14,r=7)
  c.ellipsoid('Eye | '+label+' black pupil',(x-sx*.006,.134,1.463),(.011,.004,.018),7,'head',2,n=12,r=6)
  c.ellipsoid('Eye | '+label+' small bright gleam',(x-sx*.011,.138,1.472),(.0045,.0025,.005),8,'head',2,n=10,r=6)
  c.ellipsoid('Eye | '+label+' warm upper lid',(x,.114,1.488),(.050,.018,.019),2,'head',1,n=14,r=7,rot=(0,-sx*.11,0))
  c.curve('Lash | '+label+' dramatic dark upper lash',[(sx*.023,.130,1.481),(sx*.064,.135,1.485),(sx*.106,.122,1.478),(sx*.118,.115,1.489)],[.003,.005,.005,.0015],3,'head',2,n=6,steps=3)
  c.curve('Brow | '+label+' judging eyebrow',[(sx*.022,.115,1.516),(sx*.063,.123,1.526),(sx*.106,.100,1.516)],[.004,.010,.003],3,'brow_'+label,2,n=8,steps=2)
 c.ellipsoid('Face | small sculpted nose',(0,.121,1.414),(.022,.023,.023),14,'head',1,n=14,r=8)
 for sx in [-1,1]:c.ellipsoid('Pout | upper lip lobe '+str(sx),(sx*.013,.122,1.366),(.017,.011,.009),10,'head',2,n=12,r=6,rot=(0,sx*.20,0))
 c.ellipsoid('Pout | full indignant lower lip',(0,.122,1.354),(.025,.012,.012),10,'head',2,n=14,r=7)
 # Bob cap has a high front hairline and longer fitted side/back silhouette.
 rr=[]
 for j in range(10):
  a=j/9*math.pi/2
  rr.append([(.185*math.cos(a)*math.cos(math.tau*i/32),-.006+.143*math.cos(a)*math.sin(math.tau*i/32),1.315+.258*max(0,math.sin(math.tau*i/32))*(1-math.sin(a))+.342*math.sin(a)) for i in range(32)])
 c.rings('Hair | complete sculpted chin-length black bob',rr,3,'head',2)
 for sx,label in [(-1,'L'),(1,'R')]:
  for i in range(3):
   y=.072-i*.075
   c.curve('Hair | '+label+' rounded bob lock %d'%i,[(sx*.126,y,1.590),(sx*.175,y+.014,1.487),(sx*.188,y+.020,1.375),(sx*.146,y+.040,1.328)],[.032,.034,.042,.030],3,'head',2,n=8,steps=2)
 c.curve('Hair | broad side-swept fringe',[(-.156,.104,1.497),(-.126,.113,1.569),(-.052,.094,1.632),(.041,.070,1.648)],[.025,.037,.038,.024],3,'head',2,n=10,steps=3)
 c.bow('Hair bow | firmly sewn giant pink bow',(0,-.017,1.681),.204,11,'head',5)
 c.box('Hair bow | concealed attachment bar',(0,-.014,1.643),(.135,.082,.060),3,'head',bevel=.008,segments=2,mat=2)
 c.contact('Hair bow | firmly sewn giant pink bow | sewn center knot','Hair bow | concealed attachment bar')
 c.contact('Hair bow | concealed attachment bar','Hair | complete sculpted chin-length black bob')

def animate(arm,clip,t):
 p=arm.pose.bones
 for b in p:c.pose(b)
 if clip=='idle':
  w=math.sin(math.tau*t);c.pose(p['spine'],rot=(0,.012*w,.009*w));c.pose(p['head'],rot=(0,.019*w,-.018*w));c.pose(p['coat'],rot=(0,0,.008*w))
  c.pose(p['brow_R'],rot=(0,-.035*w,0))
 elif clip=='move':
  w=math.sin(math.tau*t);c.pose(p['body'],loc=(0,0,.009*(1-math.cos(math.tau*t*2))),rot=(0,.010*w,.020*w))
  for sx,label in [(-1,'L'),(1,'R')]:
   c.pose(p['thigh_'+label],rot=(.18*sx*w,0,0));c.pose(p['calf_'+label],rot=(-.13*max(0,sx*w),0,0));c.pose(p['foot_'+label],rot=(-.04*sx*w,0,0))
  c.pose(p['coat'],rot=(0,.025*w,0));c.pose(p['head'],rot=(0,-.02*w,-.02*w))
 elif clip=='attack':
  wind=c.smooth(t/.24)*(1-c.smooth((t-.72)/.18));turn=c.smooth((t-.30)/.30);trip=c.bell(t,.67,.13);recover=c.smooth((t-.82)/.18)
  c.pose(p['body'],rot=(.10*trip,-.10*trip,math.tau*turn),loc=(0,0,.028*c.bell(t,.51,.18)))
  c.pose(p['spine'],rot=(-.06*wind,0,.06*trip));c.pose(p['head'],rot=(0,-.12*wind,-.08*wind))
  c.pose(p['hand_R'],loc=(-.065*wind,-.025*wind,.500*wind),rot=(0,-.11*wind,0))
  c.pose(p['hand_L'],loc=(-.090*wind,-.010*wind,.170*wind),rot=(0,.24*wind,0))
  c.pose(p['coat'],scale=(1+.18*c.bell(t,.51,.23),1+.14*c.bell(t,.51,.23),1-.08*c.bell(t,.51,.23)),rot=(0,0,-.15*c.bell(t,.51,.22)))
  c.pose(p['skirt'],scale=(1+.07*trip,1+.04*trip,1-.035*trip));c.pose(p['thigh_L'],rot=(.21*trip,0,.08*trip));c.pose(p['calf_L'],rot=(-.27*trip,0,0));c.pose(p['foot_L'],rot=(.06*trip,0,0))
  c.pose(p['brow_R'],rot=(0,-.18*wind,0))
 elif clip=='hit':
  q=c.bell(t,.22,.28);c.pose(p['spine'],rot=(-.085*q,.06*q,0));c.pose(p['head'],rot=(-.09*q,-.08*q,0));c.pose(p['coat'],rot=(0,.04*q,0))
 elif clip=='defeat':
  s=c.smooth((t-.15)/.63);c.pose(p['body'],loc=(0,0,-.435*s),rot=(0,0,.025*s))
  c.pose(p['coat'],scale=(1+.25*s,1+.21*s,1-.66*s));c.pose(p['skirt'],scale=(1+.11*s,1+.10*s,1-.52*s))
  for sx,label in [(-1,'L'),(1,'R')]:
   c.pose(p['thigh_'+label],rot=(1.17*s,0,sx*.12*s));c.pose(p['calf_'+label],rot=(-.50*s,0,0));c.pose(p['foot_'+label],rot=(-.67*s,0,0))
  c.pose(p['spine'],rot=(-.035*s,0,0));c.pose(p['head'],rot=(.09*s,-.13*s,-.10*s))
  c.pose(p['hand_R'],loc=(-.050*s,.010*s,.265*s),rot=(0,-.12*s,0));c.pose(p['hand_L'],loc=(.080*s,.003*s,-.090*s))
  c.pose(p['brow_L'],rot=(0,.13*s,0));c.pose(p['brow_R'],rot=(0,-.13*s,0))

def main():
 c.setup('one-star-diva',1.65,1.25,2.0,[('Woven oversized runway coat and dress',.87,0),('Warm matte toy skin',.66,0),('Polished bob and expressive face',.33,0),('Soft vinyl turquoise boots',.43,0),('Painted gold and voting paddle',.37,.36),('Satin attached bows',.48,0)])
 character();c.deliver(animate,[('idle',2.5),('move',1.0),('attack',2.0),('hit',.5),('defeat',2.0)],'Dress to Impress fashion avatar and one-star voting parody; original adult brown-skinned avatar and complete opaque oversized pink outfit.',{'heads':1,'arms':2,'legs':2,'paddles':1,'front_stars':1,'paddle_hand':'character RIGHT'})
if __name__=='__main__':main()
