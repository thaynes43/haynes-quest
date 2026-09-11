"""CatNap plush parody with one continuously held left-arm pillow."""
import math
import common as c

def arm_weight(side):
 def weights(p):
  d=((p.x-side*.17)**2+p.y*p.y+(p.z-.535)**2)**.5;w=c.smooth((d-.04)/.22)
  return {'body':1-w,'hand_'+('L' if side<0 else 'R'):w}
 return weights

def tail_weight(p):
 if p.x<.09:
  w=c.smooth((p.x+.01)/.1);return {'body':1-w,'tail_base':w}
 if p.x<.23:
  w=c.smooth((p.x-.09)/.14);return {'tail_base':1-w,'tail_mid':w}
 w=c.smooth((p.x-.23)/.11);return {'tail_mid':1-w,'tail_tip':w}

def character():
 c.bone('body',(0,0,.24),'root');c.bone('head',(0,0,.563));c.bone('jaw',(0,.170,.723),'head')
 c.bone('hand_L',(-.360,.207,.410));c.bone('hand_R',(.246,.072,.386))
 c.bone('foot_L',(-.113,0,.151));c.bone('foot_R',(.113,0,.151))
 c.bone('tail_base',(0,-.13,.30));c.bone('tail_mid',(.16,-.25,.205),'tail_base');c.bone('tail_tip',(.32,-.25,.36),'tail_mid')
 c.bone('brow_L',(-.095,.164,.812),'head');c.bone('brow_R',(.095,.164,.812),'head')
 c.ellipsoid('Plush | rounded purple body',(0,0,.384),(.185,.136,.236),0,n=22,r=12)
 c.ellipsoid('Plush | oval lavender tummy patch',(0,.121,.375),(.109,.027,.147),1,n=20,r=12)
 for sx,label in [(-1,'L'),(1,'R')]:
  c.curve('Leg | '+label+' short plush leg',[(sx*.096,0,.249),(sx*.115,.001,.167),(sx*.118,.027,.099)],[.071,.065,.067],0,'foot_'+label,n=14,steps=3)
  c.ellipsoid('Paw | '+label+' broad stable foot',(sx*.118,.058,.056),(.090,.110,.056),0,'foot_'+label,n=20,r=10)
  for k in [-1,0,1]:
   c.curve('Paw | '+label+' sewn toe division '+str(k),[(sx*.118+k*.029,.153,.046),(sx*.118+k*.029,.151,.068),(sx*.118+k*.029,.135,.081)],.0028,14,'foot_'+label,n=6,steps=2)
 c.ellipsoid('Head | large familiar purple cat plush head',(0,0,.755),(.251,.186,.227),0,'head',n=28,r=14)
 # Triangular sewn ears have broad attached bases and inset plush panels.
 for sx,label in [(-1,'L'),(1,'R')]:
  poly=[(sx*.120,.908),(sx*.249,.869),(sx*.258,1.042),(sx*.218,1.070)]
  c.prism('Ear | '+label+' triangular sewn outer ear',poly,-.006,.100,0,'head',bevel=.018)
  inner=[(sx*.161,.927),(sx*.225,.909),(sx*.231,1.022),(sx*.218,1.032)]
  c.prism('Ear | '+label+' lavender inner ear',inner,.050,.009,10,'head',bevel=.009)
  c.ellipsoid('Muzzle | '+label+' lavender cheek',(sx*.153,.143,.694),(.082,.048,.078),1,'head',n=18,r=10)
 # The giant soft black smile is the primary recognizable facial feature.
 mouth=[(-.185,.750),(-.158,.733),(-.105,.713),(0,.704),(.107,.715),(.158,.735),(.186,.752),(.177,.704),(.148,.660),(.107,.629),(.052,.609),(0,.604),(-.060,.612),(-.118,.635),(-.158,.673),(-.178,.715)]
 c.prism('Smile | one broad soft black grin',mouth,.178,.022,2,'jaw',bevel=.007)
 outline=[(-.185,.184,.749),(-.173,.191,.698),(-.130,.196,.646),(0,.201,.599),(.128,.196,.645),(.173,.191,.702),(.186,.184,.751)]
 c.curve('Smile | continuous lavender plush smile rim',outline,.017,1,'jaw',n=8,steps=4)
 c.ellipsoid('Nose | single dark cat nose',(0,.195,.754),(.024,.020,.015),9,'head',1,n=16,r=8)
 c.curve('Muzzle | tiny nose-to-smile stitch',[(0,.199,.745),(0,.201,.730),(0,.202,.716)],.003,14,'head',n=6,steps=2)
 for sx,label in [(-1,'L'),(1,'R')]:
  x=sx*.097
  c.ellipsoid('Eye | '+label+' big black plush eye',(x,.156,.806),(.055,.025,.065),2,'head',1,n=20,r=10)
  c.ellipsoid('Eye | '+label+' large bright ivory shine',(x-sx*.008,.180,.825),(.016,.007,.022),3,'head',1,n=14,r=8)
  c.curve('Brow | '+label+' sleepy serious brow',[(sx*.048,.173,.862),(sx*.092,.174,.859),(sx*.145,.150,.852)],[.012,.015,.009],14,'brow_'+label,n=8,steps=3)
 c.ellipsoid('Yawn | small plush tongue',(0,.193,.626),(.044,.011,.019),10,'jaw',n=16,r=8)
 # Arms blend from the sewn shoulder to a hand joint, allowing both paws to
 # converge on the same pillow without detached or duplicated geometry.
 c.curve('Arm | left attached plush arm',[(-.158,0,.550),(-.218,.008,.461),(-.273,.057,.395),(-.356,.193,.410)],[.069,.066,.059,.055],0,'body',n=14,steps=3,weights=arm_weight(-1))
 c.curve('Arm | right attached plush arm',[(.159,0,.548),(.214,.008,.475),(.234,.035,.413),(.246,.072,.386)],[.069,.068,.060,.051],0,'body',n=14,steps=3,weights=arm_weight(1))
 for label,point in [('L',(-.360,.207,.410)),('R',(.246,.072,.386))]:
  c.ellipsoid('Hand | '+label+' rounded plush paw',point,(.058,.045,.059),0,'hand_'+label,n=18,r=10)
  for k in [-1,1]:
   c.curve('Hand | '+label+' sewn finger '+str(k),[(point[0]+k*.017,point[1]+.042,point[2]-.026),(point[0]+k*.017,point[1]+.046,point[2]+.003)],.0027,14,'hand_'+label,n=6,steps=2)
 # Exactly one large pillow remains fully weighted to the left hand for all clips.
 c.box('Pillow | single yellow quilted cushion',(-.305,.134,.410),(.238,.137,.357),7,'hand_L',bevel=.048,segments=5)
 seam=[(-.410,.207,.565),(-.420,.207,.554),(-.422,.207,.267),(-.410,.207,.253),(-.201,.207,.253),(-.190,.207,.267),(-.190,.207,.553),(-.201,.207,.565),(-.410,.207,.565)]
 c.curve('Pillow | continuous chunky piped front seam',seam,.0055,12,'hand_L',n=6,steps=2)
 c.box('Pillow | sewn end fold',(-.303,.137,.574),(.164,.086,.012),12,'hand_L',bevel=.005,segments=2)
 c.contact('Hand | L rounded plush paw','Pillow | single yellow quilted cushion')
 c.contact('Arm | left attached plush arm','Hand | L rounded plush paw')
 c.contact('Arm | right attached plush arm','Hand | R rounded plush paw')
 # One tail root is visibly sewn into the lower back; one continuous weighted tube.
 c.curve('Tail | single continuous long curling plush tail',[(0,-.113,.319),(.045,-.198,.246),(.133,-.249,.207),(.247,-.268,.256),(.325,-.251,.358),(.341,-.229,.471),(.299,-.204,.515),(.241,-.187,.467)],[.057,.053,.045,.045,.045,.046,.044,.041],0,n=12,steps=3,weights=tail_weight)
 c.ellipsoid('Tail | sewn root patch',(0,-.133,.317),(.071,.021,.073),14,n=18,r=10)
 c.contact('Tail | single continuous long curling plush tail','Plush | rounded purple body')
 # Continuous forehead mask strap and a single rounded quilted mask.
 c.lathe('Mask | continuous strap around head',(0,0,0),[(.892,.231),(.918,.231),(.918,.226),(.892,.226)],6,'head',2,n=40,ellipse=(1,.77))
 mask=[(-.198,.896),(-.185,.937),(-.125,.961),(-.040,.962),(0,.950),(.040,.962),(.125,.961),(.185,.937),(.198,.896),(.149,.877),(.066,.889),(0,.914),(-.066,.889),(-.149,.877)]
 c.prism('Mask | single turquoise quilted forehead mask',mask,.175,.037,6,'head',2,bevel=.015)
 c.box('Mask | rear strap adjuster',(0,-.183,.905),(.045,.016,.040),6,'head',bevel=.008,segments=2,mat=2)
 c.contact('Mask | continuous strap around head','Mask | single turquoise quilted forehead mask')
 # Cat pendant has one complete cord, a real linking loop and a gold crescent.
 c.ellipse_loop('Pendant | continuous brown neck cord',(0,0,.550),.145,.119,.0075,11,n=40,tube_n=6)
 c.tube('Pendant | connected front hanger',[(0,.119,.550),(0,.139,.529),(0,.145,.512)],.0065,8,mat=3,n=8)
 poly=[]
 for i in range(16):
  a=math.pi/3+(4*math.pi/3)*i/15;poly.append((math.cos(a)*.051,.479+math.sin(a)*.051))
 for i in range(16):
  a=5*math.pi/3-(4*math.pi/3)*i/15;poly.append((.024+math.cos(a)*.039,.479+math.sin(a)*.039))
 c.prism('Pendant | one golden crescent moon',poly,.146,.017,8,mat=3,bevel=.002)
 c.contact('Pendant | continuous brown neck cord','Pendant | connected front hanger')
 c.contact('Pendant | connected front hanger','Pendant | one golden crescent moon')
 # Striped nightcap and sewn pom-pom share the head joint and overlap at seams.
 c.curve('Cap | single floppy navy striped nightcap',[(0,-.016,.965),(-.016,-.020,1.043),(-.068,-.019,1.104),(-.130,-.007,1.078),(-.155,.010,1.020)],[.135,.102,.069,.037,.014],4,'head',2,n=20,steps=3)
 c.ellipse_loop('Cap | fitted cream brim',(0,-.016,.960),.134,.122,.009,5,'head',2,n=36,tube_n=6)
 c.ellipsoid('Cap | one sewn cream pom-pom',(-.155,.010,1.012),(.043,.042,.043),5,'head',2,n=20,r=10)
 c.contact('Cap | single floppy navy striped nightcap','Cap | one sewn cream pom-pom')
 # A few large, legible stitched dashes are part of the back construction.
 for i in range(12):
  z=.26+i*.022;rad=.134*math.sqrt(max(.01,1-((z-.384)/.236)**2))
  c.tube('Back seam | body stitch %02d'%i,[(-.006,-rad-.002,z),(.006,-rad-.002,z+.006)],.0019,1,n=6)

def animate(arm,clip,t):
 p=arm.pose.bones
 for b in p:c.pose(b)
 if clip=='idle':
  w=math.sin(math.tau*t);c.pose(p['body'],scale=(1+.006*w,1+.009*w,1+.006*w));c.pose(p['head'],rot=(.012*w,.022*w,0))
  c.pose(p['tail_base'],rot=(0,.04*w,.035*w));c.pose(p['tail_mid'],rot=(.04*w,0,0))
 elif clip=='move':
  w=math.sin(math.tau*t);c.pose(p['body'],loc=(0,0,.013*(1-math.cos(math.tau*t*2))),rot=(.013*math.sin(math.tau*t*2),0,.019*w))
  c.pose(p['head'],rot=(.028*w,0,-.014*w));c.pose(p['tail_base'],rot=(0,.045*w,.080*w))
  for sx,label in [(-1,'L'),(1,'R')]:c.pose(p['foot_'+label],rot=(.12*sx*w,0,0),loc=(0,.018*sx*w,.030*max(0,sx*w)))
  c.pose(p['hand_R'],rot=(.10*w,0,0))
 elif clip=='attack':
  lift=c.smooth(t/.34)*(1-c.smooth((t-.83)/.17));crouch=c.smooth(t/.42)*(1-c.smooth((t-.56)/.13));hop=c.bell(t,.60,.18)
  c.pose(p['body'],loc=(0,0,-.053*crouch+.074*hop),scale=(1+.065*crouch,1+.025*crouch,1-.080*crouch))
  c.pose(p['head'],rot=(.12*crouch-.10*hop,0,0))
  c.pose(p['hand_L'],loc=(.305*lift,.080*lift,.100*lift))
  c.pose(p['hand_R'],loc=(-.176*lift,.213*lift,.124*lift))
  c.pose(p['tail_base'],rot=(-.12*hop,0,.11*hop));c.pose(p['tail_tip'],rot=(.17*hop,0,0))
  for sx,label in [(-1,'L'),(1,'R')]:c.pose(p['foot_'+label],rot=(-.15*hop,0,0),loc=(sx*.020*crouch,-.025*hop,.025*crouch))
  for sx,label in [(-1,'L'),(1,'R')]:c.pose(p['brow_'+label],rot=(0,sx*.12*crouch,0))
 elif clip=='hit':
  q=c.bell(t,.24,.3);c.pose(p['body'],rot=(-.07*q,.04*q,0));c.pose(p['head'],rot=(-.13*q,.06*q,0));c.pose(p['tail_base'],rot=(.12*q,0,0))
 elif clip=='defeat':
  s=c.smooth((t-.18)/.62);yawn=c.bell(t,.68,.30)*.85+.28*c.smooth((t-.82)/.18)
  c.pose(p['body'],loc=(0,0,-.093*s),scale=(1+.11*s,1+.06*s,1-.18*s));c.pose(p['head'],rot=(-.16*yawn,.06*s,0),scale=(1,1,1/(1-.18*s)))
  for sx,label in [(-1,'L'),(1,'R')]:c.pose(p['foot_'+label],rot=(.72*s,0,0),loc=(sx*.045*s,.074*s,.020*s))
  c.pose(p['hand_L'],loc=(.030*s,.017*s,-.028*s));c.pose(p['hand_R'],loc=(-.117*s,.175*s,.160*s))
  c.pose(p['jaw'],scale=(1-.23*yawn,1,1+.47*yawn));c.pose(p['tail_base'],rot=(-.06*s,0,.21*s));c.pose(p['tail_mid'],rot=(.20*s,0,0))
  for sx,label in [(-1,'L'),(1,'R')]:c.pose(p['brow_'+label],rot=(0,-sx*.17*s,0))

def main():
 c.setup('nap-captain',1.05,.9,1.5,[('Original short plush pile',.96,0),('Soft plush face finish',.82,0),('Quilt and woven night fabric',.91,0),('Painted crescent badge',.42,.40)])
 character();c.deliver(animate,[('idle',2.5),('move',1.0),('attack',1.5),('hit',.5),('defeat',2.0)],'CatNap / Smiling Critters original plush mascot; one left-arm yellow pillow, navy cap and forehead mask.',{'heads':1,'arms':2,'legs':2,'tails':1,'pillows':1,'neutral_pillow_hand':'character LEFT'})
if __name__=='__main__':main()
