"""One porcelain opera singer: a single human head in a complete toilet."""
import math
import common as c
from mathutils import Vector

def character():
 c.bone('body',(0,0,.10),'root');c.bone('neck',(0,.035,.405));c.bone('head',(0,.035,.655),'neck')
 c.bone('lid',(0,-.165,.432));c.bone('brow_L',(-.076,.159,.836),'head');c.bone('brow_R',(.076,.159,.836),'head')
 c.bone('cheek_L',(-.105,.143,.748),'head');c.bone('cheek_R',(.105,.143,.748),'head')
 # Stable closed ceramic foot and a complete hollow-looking bowl cross-section.
 c.lathe('Pedestal | broad closed floor plinth',(0,.025,0),[(0,.166),(.009,.18),(.040,.18),(.052,.169)],0,n=24,ellipse=(1,.94))
 c.lathe('Pedestal | tapered closed ceramic column',(0,.025,0),[(.045,.147),(.065,.128),(.13,.101),(.19,.124),(.214,.148)],0,n=24,ellipse=(1,.93))
 c.lathe('Bowl | continuous ceramic outer inner shell',(0,.042,0),[(.180,.121),(.205,.165),(.247,.208),(.302,.240),(.374,.253),(.414,.254),(.425,.245),(.421,.223),(.392,.218),(.336,.192),(.274,.140),(.261,.106)],0,n=32,ellipse=(1,.89))
 c.ellipse_loop('Bowl | substantial pearly seat rim',(0,.042,.424),.243,.217,.018,0,n=36,tube_n=6)
 c.lathe('Bowl | clean shadowed interior well',(0,.042,0),[(.260,.105),(.275,.108)],1,n=28,ellipse=(1,.88))
 c.box('Cistern | complete rounded rear ceramic tank',(0,-.236,.484),(.398,.191,.319),0,bevel=.035,segments=3)
 c.box('Cistern | oversized fitted tank top',(0,-.236,.651),(.427,.218,.052),0,bevel=.018,segments=2)
 c.box('Cistern | rear original blue glaze flourish',(0,-.334,.491),(.246,.010,.202),13,bevel=.015,segments=2)
 c.box('Cistern | structural bowl-to-tank bridge',(0,-.172,.339),(.227,.121,.196),0,bevel=.024,segments=2)
 c.tube('Lever | mounted flush axle',[(.194,-.236,.547),(.241,-.236,.547)],.019,14,mat=3,n=12)
 c.ellipsoid('Lever | one rear flush handle',(.248,-.215,.547),(.017,.049,.016),7,mat=3,n=16,r=8)
 c.tube('Hinge | single fixed cross axle',[(-.166,-.165,.432),(.166,-.165,.432)],.015,14,mat=3,n=12)
 for x in [-.133,.133]:
  c.box('Hinge | ceramic bearing '+str(x),(x,-.173,.444),(.048,.061,.043),0,bevel=.012,segments=2)
 c.ellipsoid('Lid | one raised oval ceramic lid',(0,-.178,.638),(.217,.025,.219),0,'lid',n=24,r=10)
 c.ellipse_loop('Lid | softly rounded single rim',(0,-.151,.638),.194,.195,.010,1,'lid',normal='y',n=32,tube_n=6)
 # Neck has no body/arms/legs; its deep lower end stays inside the bowl.
 c.lathe('Neck | single flexible opera neck',(0,.043,0),[(.302,.071),(.405,.068),(.491,.052),(.590,.061),(.664,.074)],2,'neck',mat=1,n=24)
 c.ellipsoid('Head | single male cartoon cranium',(0,.027,.775),(.151,.120,.169),2,'head',1,n=28,r=14)
 c.ellipsoid('Face | proud rounded chin',(0,.101,.674),(.094,.070,.063),2,'head',1,n=16,r=8)
 for sx,label in [(-1,'L'),(1,'R')]:
  c.ellipsoid('Head | '+label+' ear',(sx*.147,.024,.758),(.033,.033,.052),3,'head',1,n=16,r=8)
  c.ellipsoid('Head | '+label+' inner ear',(sx*.164,.046,.758),(.015,.015,.029),2,'head',1,n=12,r=6)
  c.ellipsoid('Face | '+label+' expressive cheek',(sx*.100,.113,.748),(.056,.048,.050),3,'cheek_'+label,1,n=16,r=8)
 # A broad black smiling opening, connected lips, six clean chunky upper teeth.
 mouth=[(-.096,.764),(-.077,.765),(-.050,.752),(0,.750),(.050,.752),(.080,.765),(.096,.768),(.088,.731),(.068,.703),(.039,.688),(0,.682),(-.038,.689),(-.067,.706),(-.086,.733)]
 c.prism('Face | broad open opera grin',mouth,.142,.026,9,'head',mat=1,bevel=.007)
 c.curve('Face | lower smiling lip',[(-.090,.156,.738),(-.070,.168,.705),(0,.178,.686),(.071,.168,.706),(.090,.156,.738)],[.010,.012,.013,.012,.009],3,'head',1,n=8,steps=3)
 for i in range(6):
  x=(i-2.5)*.024;z=.746+.010*(abs(x)/.061)**1.5
  c.box('Face | upper tooth %d'%(i+1),(x,.165,z),(.022,.021,.027),6,'head',bevel=.003,segments=2,mat=2)
 c.ellipsoid('Face | warm tongue inside smile',(0,.164,.703),(.031,.011,.012),10,'head',1,n=16,r=6)
 c.ellipsoid('Face | pompous broad nose',(0,.165,.788),(.047,.045,.029),3,'head',1,n=16,r=8)
 for sx,label in [(-1,'L'),(1,'R')]:
  x=sx*.067
  c.ellipsoid('Eye | '+label+' cream sclera',(x,.130,.825),(.045,.037,.050),6,'head',2,n=14,r=7)
  c.ellipsoid('Eye | '+label+' warm iris',(x-sx*.007,.164,.821),(.022,.011,.029),12,'head',2,n=14,r=7)
  c.ellipsoid('Eye | '+label+' black pupil',(x-sx*.008,.174,.823),(.014,.006,.022),5,'head',2,n=12,r=6)
  c.ellipsoid('Eye | '+label+' bright catchlight',(x-sx*.009-.005,.180,.835),(.006,.004,.008),6,'head',2,n=10,r=6)
  c.curve('Brow | '+label+' dramatic swept eyebrow',[(sx*.032,.139,.862),(sx*.064,.152,.876),(sx*.105,.130,.863),(sx*.121,.112,.850)],[.010,.015,.012,.004],4,'brow_'+label,2,n=8,steps=3)
  c.curve('Moustache | '+label+' curled opera point',[(sx*.006,.189,.767),(sx*.037,.194,.765),(sx*.074,.183,.758),(sx*.099,.166,.769),(sx*.091,.168,.785)],[.010,.013,.010,.006,.0025],4,'head',2,n=8,steps=3)
 # Hair is one fitted sculpted mass plus chunky swept locks, never loose strands.
 rr=[]
 for j in range(9):
  a=j/8*math.pi/2
  ring=[]
  for i in range(32):
   theta=math.tau*i/32;front=max(0,math.sin(theta));z=.760+.123*front*(1-math.sin(a))+.194*math.sin(a)
   ring.append((.155*math.cos(a)*math.cos(theta),.020+.126*math.cos(a)*math.sin(theta),z))
  rr.append(ring)
 c.rings('Hair | fitted swept dark cap',rr,4,'head',2,caps=True)
 for i in range(5):
  x=-.114+i*.050
  c.curve('Hair | broad swept quiff lock %d'%i,[(x,.067,.886),(x-.030,.064,.929),(x-.001,.005,.952),(x+.053,-.056,.918)],[.014,.024,.028,.020],4,'head',2,n=9,steps=3)
 for sx,label in [(-1,'L'),(1,'R')]:
  c.curve('Hair | '+label+' sculpted sideburn',[(sx*.131,.024,.859),(sx*.147,-.002,.824),(sx*.133,-.001,.787)],[.032,.031,.021],4,'head',2,n=9,steps=3)
 # Small crown base penetrates the fitted hair; three frontal points read clearly.
 c.lathe('Crown | attached small gold band',(.050,-.009,0),[(.928,.057),(.939,.061),(.963,.059),(.969,.051)],7,'head',3,n=24)
 crown=[(-.008,.957),(.105,.957),(.117,1.012),(.081,.988),(.050,1.038),(.019,.989),(-.016,1.010)]
 c.prism('Crown | three pompous front points',crown,.038,.014,7,'head',3,bevel=.003)
 for i,(x,z) in enumerate([(-.016,1.01),(.05,1.038),(.117,1.012)]):c.ellipsoid('Crown | rounded point %d'%i,(x,.038,z),(.009,.010,.009),15,'head',3,n=12,r=6)
 c.ellipse_loop('Bow tie | continuous turquoise neck band',(0,.043,.516),.056,.057,.010,8,'neck',mat=4,n=32,tube_n=6)
 c.bow('Bow tie | small opera bow',(0,.107,.511),.098,8,'neck',4)
 for i in range(4):
  bn='bubble_%d'%i;c.bone(bn,(0,.145,.724),'head')
  c.ellipsoid('Bubble | opaque pearly soap sphere %d'%i,(0,.143,.724),(.032,.032,.032),11,bn,0,n=12,r=8)
 c.contact('Pedestal | broad closed floor plinth','Pedestal | tapered closed ceramic column')
 c.contact('Pedestal | tapered closed ceramic column','Bowl | continuous ceramic outer inner shell')
 c.contact('Cistern | complete rounded rear ceramic tank','Cistern | structural bowl-to-tank bridge')
 c.contact('Neck | single flexible opera neck','Head | single male cartoon cranium')
 c.contact('Hair | fitted swept dark cap','Crown | attached small gold band')
 c.contact('Hinge | single fixed cross axle','Lid | one raised oval ceramic lid')

def animate(arm,clip,t):
 p=arm.pose.bones
 for b in p:c.pose(b)
 for i in range(4):c.pose(p['bubble_%d'%i],scale=(.001,)*3)
 if clip=='idle':
  w=math.sin(math.tau*t);c.pose(p['neck'],scale=(1,1,1+.014*w));c.pose(p['head'],rot=(.009*w,.025*w,0),scale=(1,1,1/(1+.014*w)))
  c.pose(p['brow_L'],rot=(0,.035*w,0))
 elif clip=='move':
  w=math.sin(math.tau*t);c.pose(p['body'],rot=(.019*math.sin(math.tau*t*2),.055*w,0));c.pose(p['head'],rot=(-.019*math.sin(math.tau*t*2),-.025*w,0))
 elif clip=='attack':
  wind=c.smooth(t/.51)*(1-c.smooth((t-.625)/.10));note=c.bell(t,.655,.075);settle=math.sin((t-.7)*math.tau*4)*c.smooth((t-.70)/.08)*(1-c.smooth((t-.88)/.12));stretch=1+.46*wind-.08*note
  c.pose(p['neck'],rot=(-.10*wind+.10*note,0,0),scale=(1-.08*wind,1-.08*wind,stretch));c.pose(p['head'],rot=(-.12*wind+.16*note,.06*settle,0),scale=(1,1,1/stretch))
  for label in ['L','R']:
   c.pose(p['cheek_'+label],scale=(1+.23*wind,1+.32*wind,1+.16*wind));c.pose(p['brow_'+label],rot=(0,(-.20 if label=='L' else .20)*wind,0))
  for i in range(4):
   progress=max(0,(t-.625-i*.018)/.33);visible=c.smooth(progress/.06)*(1-c.smooth((progress-.75)/.25));a=(i-1.5)*.30
   c.pose(p['bubble_%d'%i],loc=(a*progress,.49*progress,.12*math.sin(progress*math.pi)+i*.018*progress),scale=(max(.001,visible*(1+i*.17)),)*3)
 elif clip=='hit':
  q=c.bell(t,.22,.28);c.pose(p['body'],rot=(-.04*q,0,0));c.pose(p['neck'],rot=(-.15*q,0,0));c.pose(p['head'],rot=(-.09*q,.08*q,0));c.pose(p['lid'],rot=(.08*q,0,0))
 elif clip=='defeat':
  duck=c.smooth((t-.13)/.54);w=math.sin(math.tau*t*3)*(1-c.smooth((t-.2)/.52));stretch=1-.85*duck
  c.pose(p['neck'],loc=(0,0,-.220*duck),scale=(1,1,stretch));c.pose(p['head'],rot=(.08*duck,.045*w,0),scale=(1,1,1/stretch))
  c.pose(p['lid'],rot=(-.57*c.smooth((t-.66)/.32),0,0))
  for label in ['L','R']:c.pose(p['brow_'+label],rot=(0,(.12 if label=='L' else -.12)*duck,0))

def main():
 c.setup('sir-flush-a-lot',1.0,1.0,1.6,[('Pearly glazed ceramic',.25,0),('Warm matte skin',.66,0),('Sculpted hair and eyes',.34,0),('Painted crown and hardware',.32,.55),('Woven turquoise bow',.84,0)])
 character();c.deliver(animate,[('idle',2.5),('move',1.0),('attack',1.6),('hit',.5),('defeat',2.0)],'Skibidi Toilet original head-in-toilet silhouette; one pompous opera head, crown, bow tie and soap notes.',{'heads':1,'arms':0,'legs':0,'lids':1,'bubbles':4})
if __name__=='__main__':main()
