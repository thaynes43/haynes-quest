"""Original storybook traveler candidates, WO-007, Blender 4.5 LTS.

Run: blender --background --python build.py -- --output /workspace/haynes-quest/travelers/v001
The deterministic geometry and vertex-painted materials use no external assets.
Blender +Y is character forward; glTF conversion makes character forward -Z.
"""
import argparse
import bpy
import hashlib
import json
import math
import os
import sys
from mathutils import Vector, noise

TAU = math.tau
OUTPUT = '/workspace/haynes-quest/travelers/v001'
REFERENCE_SHA256 = {
    'traveler-ages.png': '4d43c73a80d8f8505cf142f6e6a35703456aba857f19d8d0a2c7a06d25759c84',
    'environment.png': 'f21b9b7c4a7473634350c30050419cca395a22156b791f2ea1d609688f639908',
    'props-materials.png': '1f15acf9aeb14cd7f4b00f6bb0b6d15ecbd97eb3775c9eac5a0b546c7a89f251',
}
PALETTE = {
    'Plum wool': ('50394b', .94, 0),
    'Hood shadow': ('211a25', 1, 0),
    'Leaf linen': ('58675a', .96, 0),
    'Cedar leather': ('69492f', .90, 0),
    'Umber sole': ('49372d', .96, 0),
    'Warm mittens': ('c8ab89', .96, 0),
    'Honey brass': ('dca953', .46, .42),
    'Flax thread': ('bca270', 1, 0),
}
MAT = {}
PARTS = []


def srgb(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4


def palette():
    global MAT
    MAT = {}
    for name, (hexcolor, rough, metal) in PALETTE.items():
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Specular IOR Level'].default_value = .28
        color = tuple(srgb(int(hexcolor[i:i+2], 16)/255) for i in (0, 2, 4))
        mat.diffuse_color = (*color, 1)
        node = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        node.layer_name = 'Color'
        mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
        mat['palette_srgb'] = '#'+hexcolor
        MAT[name] = (mat, color)


def paint(obj, material, tint=1):
    mat, base = MAT[material]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    layer = obj.data.color_attributes.get('Color') or obj.data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
        for li in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            # Broad, restrained color washes are baked into glTF vertex colors.
            n1 = noise.noise_vector(p*11.7)[0]
            n2 = noise.noise_vector(p*31.1)[1]
            wash = tint * (1 + .065*n1 + .022*n2)
            layer.data[li].color = (*[max(.001, min(1, c*wash)) for c in base], 1)
    obj.data.color_attributes.active_color = layer


def weights(obj, influence):
    if isinstance(influence, str):
        group = obj.vertex_groups.new(name=influence)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        return
    for vert in obj.data.vertices:
        for bone, weight in influence(vert.co).items():
            if weight > 0:
                group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
                group.add([vert.index], weight, 'REPLACE')


def mesh(name, verts, faces, material, bone, tint=1):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    # Recalculate outward normals on closed shells, including concave hood cavity.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    paint(obj, material, tint)
    weights(obj, bone)
    PARTS.append(obj)
    return obj


def ringmesh(name, rings, material, bone, tint=1, caps=True):
    n = len(rings[0])
    verts = [p for ring in rings for p in ring]
    faces = []
    for j in range(len(rings)-1):
        for i in range(n):
            a, b = j*n+i, j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    if caps is True or caps == 'first':
        faces.append(tuple(range(n-1,-1,-1)))
    if caps is True or caps == 'last':
        faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name, verts, faces, material, bone, tint)


def uvball(name, center, scale, material, bone, tint=1, segments=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    paint(obj, material, tint)
    weights(obj, bone)
    PARTS.append(obj)
    return obj


def roundbox(name, center, size, bevel, material, bone, tint=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Soft crafted corners', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    paint(obj, material, tint)
    weights(obj, bone)
    PARTS.append(obj)
    return obj


def tube(name, points, radius, material, bone, tint=1, sides=6, closed=False):
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        tangent = (pts[(i+1)%len(pts)]-pts[(i-1)%len(pts)]) if closed else (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)])
        tangent.normalize()
        axis = Vector((0,1,0))
        if abs(axis.dot(tangent)) > .9:
            axis = Vector((1,0,0))
        side = tangent.cross(axis).normalized()
        other = tangent.cross(side).normalized()
        r = radius[i] if isinstance(radius, list) else radius
        rings.append([p+r*(math.cos(TAU*j/sides)*side+math.sin(TAU*j/sides)*other) for j in range(sides)])
    if closed:
        rings.append(rings[0])
    return ringmesh(name, rings, material, bone, tint, caps=not closed)


def ribbon(name, centers, width, material, bone, tint=1, top=False):
    # A curved, closed leather strip in front/back of the garment.
    points = [Vector(p) for p in centers]
    front, back = [], []
    for i, p in enumerate(points):
        d = (points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
        side = Vector((0,width*.5,0)) if top else Vector((d.z,0,-d.x)).normalized()*width*.5
        thick = Vector((0,0,.002)) if top else Vector((0,.002,0))
        front += [p+side+thick, p-side+thick]
        back += [p+side-thick, p-side-thick]
    verts = front+back
    faces = []
    n = len(front)
    for i in range(len(points)-1):
        a = i*2
        faces += [(a,a+1,a+3,a+2),(n+a+2,n+a+3,n+a+1,n+a),(a,a+2,n+a+2,n+a),(a+3,a+1,n+a+1,n+a+3)]
    faces += [(0,n,n+1,1),(n-2,n-1,2*n-1,2*n-2)]
    return mesh(name, verts, faces, material, bone, tint)


def disc(name, center, radius, depth, material, bone, tint=1):
    # Coin normal points toward Blender +Y / exported -Z.
    cx, cy, cz = center
    rings=[]
    for y, r in [(cy-depth*.5,radius*.85),(cy-depth*.36,radius),(cy+depth*.36,radius),(cy+depth*.5,radius*.85)]:
        rings.append([(cx+r*math.sin(TAU*i/24),y,cz+r*math.cos(TAU*i/24)) for i in range(24)])
    return ringmesh(name, rings, material, bone, tint)


def cyclic_samples(fn, n=36):
    return [fn(TAU*i/n) for i in range(n)]


def hood(cfg):
    zc, rx, rz, yf = cfg['hood']
    def ring(sx, sz, y, center=0, wave=0):
        return cyclic_samples(lambda a:(rx*sx*math.sin(a)*(1-.25*math.cos(a))-.017*cfg['scale']*(1+math.cos(a))*.5,
            y + wave*math.cos(3*a+.7) + .008*cfg['scale']*math.cos(a),
            zc + center + rz*sz*math.cos(a) + .004*cfg['scale']*math.sin(3*a)),40)
    # One outer wool shell rolls into the aperture. Its back is a closed dome.
    rings = [ring(.045,.08,-.177*cfg['scale'],.025*cfg['scale']),
             ring(.50,.68,-.160*cfg['scale'],.016*cfg['scale'],.002),
             ring(.87,.87,-.100*cfg['scale'],.003*cfg['scale'],.004),
             ring(1.02,1,-.025*cfg['scale'],0,.005),
             ring(1.01,.87,.053*cfg['scale'],0,.004),
             ring(.90,.76,yf-.022*cfg['scale'],0,.002),
             ring(.77,.72,yf+.002*cfg['scale'],0,.001),
             ring(.725,.682,yf-.002*cfg['scale']),
             ring(.71,.67,yf-.014*cfg['scale'])]
    # Add smooth loft midpoints to the broad rear shell; preserve the lip rings.
    smooth=[]
    for j in range(len(rings)-1):
        smooth.append(rings[j])
        if j<5:
            p0,p1,p2,p3=rings[max(0,j-1)],rings[j],rings[j+1],rings[min(len(rings)-1,j+2)]
            smooth.append([-.0625*Vector(a)+.5625*Vector(b)+.5625*Vector(c)-.0625*Vector(d) for a,b,c,d in zip(p0,p1,p2,p3)])
    smooth.append(rings[-1])
    ringmesh('Hood | sculpted wool shell and rolled lip', smooth, 'Plum wool', 'head', caps='first')
    # True recessed cavity: rim to deep concave bowl, no face/eyes/decal plane.
    inside = [ring(.711,.671,yf-.014*cfg['scale']),
              ring(.69,.645,yf-.036*cfg['scale']),
              ring(.57,.51,yf-.103*cfg['scale']),
              ring(.35,.32,yf-.133*cfg['scale']),
              ring(.02,.018,yf-.146*cfg['scale'])]
    ringmesh('Hood | recessed featureless lining', inside, 'Hood shadow', 'head', .83, caps='last')
    # A soft seam follows the front roll. It is cloth-colored rather than piping.
    tube('Hood | soft seam',ring(.788,.737,yf+.001*cfg['scale']),.0025*cfg['scale'],'Plum wool','head',1.16,5,True)
    # Five quiet leaf stitches are enough to retain the concept motif.
    for k in range(5):
        angle=-.34-k*.17
        p=Vector(ring(.858,.79,yf-.008*cfg['scale'])[int((angle%TAU)/TAU*40)%40])
        # Sample analytically to avoid stepping the embroidery contour.
        p=Vector((rx*.858*math.sin(angle)*(1-.25*math.cos(angle))-.017*cfg['scale']*(1+math.cos(angle))*.5,
                  yf-.006*cfg['scale']+.008*cfg['scale']*math.cos(angle),
                  zc+rz*.79*math.cos(angle)+.004*cfg['scale']*math.sin(3*angle)))
        pts=[p+Vector((math.sin(TAU*j/10)*.004*cfg['scale'],.001,math.cos(TAU*j/10)*.007*cfg['scale'])) for j in range(10)]
        tube('Hood | leaf stitch %02d'%k,pts,.00115*cfg['scale'],'Flax thread','head',.87,4,True)


def torso(cfg):
    hem, waist, shoulder, neck = cfg['body']
    def blend(p):
        t=max(0,min(1,(p.z-hem)/(shoulder-hem)))
        return {'pelvis':1-t,'spine':t}
    profile=[(hem,.98),(hem+.008,1),(hem+.020,.985),(hem+(waist-hem)*.52,.94),(waist,.87),(shoulder-.045,.87),(shoulder,.84),(neck,.54)]
    rings=[]
    for k,(z,r) in enumerate(profile):
        ring=[]
        for i in range(40):
            a=TAU*i/40
            fold=(.0045*math.cos(7*a+.7)+.0015*math.sin(11*a))* (1-(k/len(profile))*.6)
            ring.append(((cfg['torso_rx']*r+fold)*math.sin(a), (cfg['torso_ry']*r+fold)*math.cos(a),z + .005*math.cos(3*a+.3)*(1-k/len(profile))))
        rings.append(ring)
    ringmesh('Tunic | flared linen body',rings,'Leaf linen',blend)
    for dz,tint in [(.011,.76),(.019,.9)]:
        edge=[(p[0]*1.006,p[1]*1.006,p[2]+dz) for p in rings[0]]
        tube('Tunic | folded hem',edge,.0025*cfg['scale'],'Leaf linen',blend,tint,5,True)
    # Small paired curved stitches around the bottom edge, including the rear.
    for k in range(16):
        a=TAU*k/16
        points=[]
        for j in range(7):
            t=j/6
            b=a+.095*(t-.5)
            points.append(((cfg['torso_rx']*.988+.002)*math.sin(b),(cfg['torso_ry']*.988+.002)*math.cos(b),hem+.029*cfg['scale']+.004*math.sin(t*math.pi)+.005*math.cos(3*b+.3)))
        tube('Tunic | hem stitch %02d'%k,points,.0012*cfg['scale'],'Flax thread',blend,.88,4)
    # Neck scarf: a sculpted cloth strip with a raised upper fold.
    collar=[]
    for v in (0,.22,.57,.84,1):
        ring=[]
        for i in range(40):
            a=TAU*i/40
            x=(cfg['collar_rx']*(.69+.31*math.sin(v*math.pi*.68)))*math.sin(a)
            y=(cfg['collar_ry']*(.68+.36*math.sin(v*math.pi*.68)))*math.cos(a)
            z=neck-.006-v*.068*cfg['scale']+ .018*cfg['scale']*math.sin(a)*math.cos(a)-.012*cfg['scale']*math.cos(a)
            z+=.008*cfg['scale']*math.sin(v*math.pi)*math.cos(2*a)
            ring.append((x,y,z))
        collar.append(ring)
    ringmesh('Scarf | soft folded collar',collar,'Plum wool','spine',.95)
    tube('Scarf | turned edge',collar[-1],.0035*cfg['scale'],'Plum wool','spine',1.07,6,True)
    # Tapered back mantle, thickened shell with broad hand-shaped folds.
    verts=[]
    nu,nv=13,6
    for j in range(nv):
        v=j/(nv-1)
        for i in range(nu):
            u=-1+2*i/(nu-1)
            x=cfg['collar_rx']*.94*(1-.42*v)*u-.018*cfg['scale']*v
            y=-cfg['collar_ry']-(.015*math.sin(math.pi*v)+.009*math.cos(3*math.pi*u)*math.sin(math.pi*v))*cfg['scale']
            z=neck-.028*cfg['scale']-(.09+.095*(1-u*u))*cfg['scale']*v+.01*math.cos(2*math.pi*u)*v*cfg['scale']
            # Tuck the upper corners down into the shoulders rather than leaving
            # triangular cloth tabs in the three-quarter silhouette.
            z-=.038*cfg['scale']*abs(u)**3*(1-v)
            verts.append((x,y,z))
    faces=[(j*nu+i,j*nu+i+1,(j+1)*nu+i+1,(j+1)*nu+i) for j in range(nv-1) for i in range(nu-1)]
    cape=mesh('Scarf | back mantle',verts,faces,'Plum wool','spine',.94)
    bpy.context.view_layer.objects.active=cape
    cape.select_set(True)
    soft=cape.modifiers.new('Soft mantle corners','SUBSURF')
    soft.levels=1
    bpy.ops.object.modifier_apply(modifier=soft.name)
    mod=cape.modifiers.new('Cloth thickness','SOLIDIFY')
    mod.thickness=.006*cfg['scale']
    bpy.ops.object.modifier_apply(modifier=mod.name)
    cape.select_set(False)
    # Solidify inherits vertex paint and weights.
    bottom=verts[-nu:]
    tube('Scarf | mantle hem',bottom,.003*cfg['scale'],'Plum wool','spine',1.08,5)


def limbs(cfg):
    joints={}
    for side, sign in [('R',1),('L',-1)]:
        shoulder,elbow,wrist= [Vector((sign*p[0],p[1],p[2])) for p in cfg['arm']]
        joints.update({f'upper_arm.{side}':shoulder,f'forearm.{side}':elbow,f'hand.{side}':wrist})
        upper, lower=f'upper_arm.{side}',f'forearm.{side}'
        def arm_weights(p,shoulder=shoulder,elbow=elbow,wrist=wrist,upper=upper,lower=lower):
            d=(shoulder-p).length/(shoulder-wrist).length
            t=max(0,min(1,(d-.36)/.40))
            return {upper:1-t,lower:t}
        centers=[]
        for i in range(9):
            t=i/8
            p=(shoulder.lerp(elbow,t*2) if t<=.5 else elbow.lerp(wrist,(t-.5)*2))
            centers.append(p)
        rings=[]
        for i,p in enumerate(centers):
            t=i/8
            r=(.066-.016*t+.009*t**5)*cfg['scale']*(1.13 if cfg['stage']=='infant' else 1)
            if i==0:
                r*=.78
            tangent=(centers[min(i+1,8)]-centers[max(i-1,0)]).normalized()
            axis=tangent.cross(Vector((0,1,0))).normalized()
            axis2=tangent.cross(axis).normalized()
            rings.append([p+(r*(1+.032*math.cos(5*a)))*(axis*math.cos(a)+axis2*math.sin(a)) for a in [TAU*j/20 for j in range(20)]])
        ringmesh(f'Sleeve | {side}',rings,'Leaf linen',arm_weights,.99)
        tube(f'Sleeve | turned cuff {side}',rings[-1],.006*cfg['scale'],'Leaf linen',lower,.79,6,True)
        # Cuff stitches on the front semicircle.
        for k in range(5):
            a=(k/4-.5)*math.pi
            p=Vector(rings[-2][int((a%TAU)/TAU*20)%20])
            tube(f'Sleeve | stitch {side} {k}',[p+Vector((0,.002,.004)),p+Vector((sign*.004,.002,.007))],.0013*cfg['scale'],'Flax thread',lower,.92,4)
        hand_center=wrist+(wrist-elbow).normalized()*.027*cfg['scale']+Vector((0,.009*cfg['scale'],0))
        uvball(f'Mitten | {side}',hand_center,(.036*cfg['scale'],.039*cfg['scale'],.048*cfg['scale']),'Warm mittens',f'hand.{side}',segments=18,rings=12)
        uvball(f'Mitten | thumb {side}',hand_center+Vector((-sign*.023*cfg['scale'],.021*cfg['scale'],.004*cfg['scale'])),(.017*cfg['scale'],.019*cfg['scale'],.026*cfg['scale']),'Warm mittens',f'hand.{side}',.98,segments=12,rings=8)
        hip,knee,ankle= [Vector((sign*p[0],p[1],p[2])) for p in cfg['leg']]
        joints.update({f'thigh.{side}':hip,f'shin.{side}':knee,f'foot.{side}':ankle})
        thigh,shin=f'thigh.{side}',f'shin.{side}'
        def leg_weights(p,hip=hip,knee=knee,ankle=ankle,thigh=thigh,shin=shin):
            t=max(0,min(1,(knee.z+.044*cfg['scale']-p.z)/(.088*cfg['scale'])))
            return {thigh:1-t,shin:t}
        rings=[]
        for i in range(9):
            t=i/8
            p=hip.lerp(knee,t*2) if t<=.5 else knee.lerp(ankle,(t-.5)*2)
            r=cfg['leg_radius']*(.98-.13*t+.075*math.sin(t*5*math.pi))
            rings.append([(p.x+r*math.sin(TAU*j/18),p.y+r*1.08*math.cos(TAU*j/18),p.z+.003*math.cos(TAU*j/18*3)) for j in range(18)])
        ringmesh(f'Trousers | {side}',rings,'Cedar leather',leg_weights,.66)
        # A shallow seam remains readable down the outside of each trouser leg.
        seam=[Vector((r[4 if sign>0 else 13]))+Vector((sign*.001,0,0)) for r in rings[:6]]
        tube(f'Trousers | seam {side}',seam,.0017*cfg['scale'],'Cedar leather',leg_weights,.56,5)
        foot_bone=f'foot.{side}'
        bx=ankle.x
        bs=cfg['boot_scale']
        def bootring(z,rx,ry,yc=0):
            return [(bx+rx*bs*math.sin(TAU*j/24),yc*bs+ry*bs*math.cos(TAU*j/24),z*bs) for j in range(24)]
        ringmesh(f'Boot | sole {side}',[bootring(.0,.059,.101,.033),bootring(.006,.068,.109,.033),bootring(.02,.068,.11,.033),bootring(.027,.062,.104,.033)],'Umber sole',foot_bone,.91)
        ringmesh(f'Boot | rounded toe {side}',[bootring(.024,.063,.104,.033),bootring(.041,.069,.108,.032),bootring(.068,.065,.1,.027),bootring(.086,.054,.079,.008),bootring(.104,.046,.054,-.006)],'Cedar leather',foot_bone,.90)
        ringmesh(f'Boot | shaft {side}',[bootring(.074,.051,.056,-.01),bootring(.102,.052,.058,-.012),bootring(.135,.049,.053,-.01),bootring(.179,.057,.061,-.009)],'Cedar leather',foot_bone,.76)
        ringmesh(f'Boot | folded cuff {side}',[bootring(.148,.06,.065,-.009),bootring(.156,.065,.069,-.009),bootring(.18,.063,.067,-.009),bootring(.187,.057,.061,-.009)],'Cedar leather',foot_bone,1.04)
        # Broad strap across the instep, plus a small brass stud.
        strap=[]
        for j in range(9):
            t=-1+2*j/8
            strap.append((bx+t*.061*bs,.042*bs+.009*bs*t,.075*bs+.014*bs*(1-t*t)))
        ribbon(f'Boot | instep strap {side}',strap,.019*bs,'Cedar leather',foot_bone,1.11,top=True)
        uvball(f'Boot | stud {side}',(bx+sign*.05*bs,.057*bs,.081*bs),(.007*bs,.005*bs,.006*bs),'Honey brass',foot_bone,.77,12,8)
    return joints


def accessories(cfg):
    s=cfg['scale']
    bx,by,bz=cfg['bag']
    bw,bh=.139*s,.162*s
    # Right hip is Blender +X, which remains +X after glTF Y-up conversion.
    roundbox('Satchel | soft body',(bx,by,bz),(bw,.074*s,bh),.023*s,'Cedar leather','pelvis',.90)
    roundbox('Satchel | flap',(bx,by+.04*s,bz+.034*s),(bw*.99,.013*s,bh*.52),.018*s,'Cedar leather','pelvis',1.09)
    # Flap seam in a U, shifted toward the viewer to avoid z-fighting.
    seam=[]
    for j in range(15):
        a=math.pi*j/14
        seam.append((bx+math.cos(a)*bw*.40,by+.049*s,bz+.046*s-math.sin(a)*bh*.22))
    tube('Satchel | flap stitching',seam,.0014*s,'Flax thread','pelvis',.77,4)
    disc('Satchel | clasp backing',(bx-.015*s,by+.051*s,bz+.021*s),.020*s,.007*s,'Honey brass','pelvis',.79)
    disc('Satchel | clasp inset',(bx-.015*s,by+.056*s,bz+.021*s),.012*s,.006*s,'Cedar leather','pelvis',.71)
    disc('Satchel | clasp button',(bx-.015*s,by+.061*s,bz+.021*s),.006*s,.005*s,'Honey brass','pelvis',1.08)
    cx,cy,cz=cfg['clasp']
    neck=cfg['body'][-1]
    front=[]
    for i in range(13):
        t=i/12
        front.append((cx*(1-t)+(bx+.036*s)*t,cy*(1-t)+(by+.019*s)*t+.009*s*math.sin(t*math.pi),cz*(1-t)+(bz+.089*s)*t))
    def strap_weights(p):
        t=max(0,min(1,(p.z-(bz+.06*s))/(cz-bz-.06*s)))
        return {'pelvis':1-t,'spine':t}
    ribbon('Satchel | front shoulder strap',front,.033*s,'Cedar leather',strap_weights,1.06)
    # Two sparse stitch runs emphasize the strap without noisy surface detail.
    for k in range(2,11,2):
        p=Vector(front[k])+Vector((-.009*s,.003*s,-.007*s))
        tube('Satchel | strap stitch %d'%k,[p,p+Vector((.003*s,0,-.004*s))],.0011*s,'Flax thread',strap_weights,.86,4)
    back=[]
    for i in range(14):
        t=i/13
        back.append((cx*(1-t)+(bx+.02*s)*t,-cfg['torso_ry']-.012*s, (neck-.008*s)*(1-t)+(bz+.055*s)*t))
    ribbon('Satchel | back shoulder strap',back,.033*s,'Cedar leather',strap_weights,.96)
    # Continue around the wearer-right side to the bag; the back strap is not
    # a disconnected strip. The local surface normal turns around the torso.
    verts=[]
    for i in range(13):
        t=i/12
        angle=math.pi*t
        p=Vector((bx+.02*s+.045*s*math.sin(angle),back[-1][1]*(1-t)+(by+.020*s)*t,bz+.06*s+.025*s*t))
        normal=Vector((math.sin(angle),-math.cos(angle),0))
        for dz,depth in [(-.016*s,.002*s),(.016*s,.002*s),(-.016*s,-.002*s),(.016*s,-.002*s)]:
            verts.append(p+Vector((0,0,dz))+normal*depth)
    faces=[]
    for i in range(12):
        a=4*i
        faces += [(a,a+4,a+5,a+1),(a+3,a+7,a+6,a+2),(a+2,a+6,a+4,a),(a+1,a+5,a+7,a+3)]
    faces += [(0,1,3,2),(48,50,51,49)]
    mesh('Satchel | side strap attachment',verts,faces,'Cedar leather','pelvis',.98)
    # Shoulder bridge connects the two strap sides over the left shoulder.
    bridge=[]
    for i in range(10):
        t=i/9
        bridge.append((cx,cy*(1-t)+back[0][1]*t,cz+(neck+.014*s-cz)*math.sin(math.pi*t)))
    ribbon('Satchel | over shoulder',bridge,.034*s,'Cedar leather','spine',1.02)
    disc('Scarf | round honey clasp',(cx,cy+.019*s,cz),.028*s,.011*s,'Honey brass','spine')
    disc('Scarf | inset',(cx,cy+.026*s,cz),.020*s,.008*s,'Honey brass','spine',.85)
    disc('Scarf | raised center',(cx,cy+.032*s,cz),.012*s,.007*s,'Honey brass','spine',1.09)
    # A simple sprout impression is original and shared with the material brief.
    tube('Clasp | sprout stem',[(cx,cy+.037*s,cz-.009*s),(cx,cy+.039*s,cz+.007*s)],.0017*s,'Flax thread','spine',1.12,5)


def rig(cfg,joints):
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.armatures.new('Traveler shared skeleton v1')
    arm=bpy.data.objects.new('Traveler_'+cfg['stage'],data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    heads={'root':Vector((0,0,0)),'pelvis':Vector((0,0,cfg['pelvis'])),'spine':Vector((0,0,cfg['body'][1])),'head':Vector((0,0,cfg['body'][-1]))}
    heads.update(joints)
    parents={'pelvis':'root','spine':'pelvis','head':'spine'}
    for side in ('L','R'):
        parents.update({f'upper_arm.{side}':'spine',f'forearm.{side}':f'upper_arm.{side}',f'hand.{side}':f'forearm.{side}',f'thigh.{side}':'pelvis',f'shin.{side}':f'thigh.{side}',f'foot.{side}':f'shin.{side}'})
    for name,head in heads.items():
        b=data.edit_bones.new(name)
        b.head=head
        b.tail=head+Vector((0,0,.075*cfg['scale']))
        b.roll=0
        b.use_deform=True
        if name in parents:
            b.parent=data.edit_bones[parents[name]]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front=True
    arm['appearance_contract']='synthetic-traveler-v1'
    arm['asset_stage']=cfg['stage']
    arm['height_m']=cfg['height']
    arm['forward_blender']='+Y'
    arm['forward_gltf']='-Z'
    arm['owner_approval']='pending; studio candidate only'
    # Join mesh primitives into one skinned draw object with eight material slots.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0]
    bpy.ops.object.join()
    skin=bpy.context.object
    skin.name='Traveler_'+cfg['stage']+'_mesh'
    # Keep the mesh as a scene root. Its armature modifier/skin binds it to the
    # rig; a non-root skinned mesh creates a glTF parent-transform ambiguity.
    skin.parent=None
    mod=skin.modifiers.new('Traveler shared deformation','ARMATURE')
    mod.object=arm
    bpy.context.view_layer.objects.active=skin
    # Ensure exactly eight slots, despite separate-part construction.
    old=list(skin.data.materials)
    unique=[]
    for mat in old:
        if mat not in unique:
            unique.append(mat)
    mapping={i:unique.index(m) for i,m in enumerate(old)}
    indices=[mapping[p.material_index] for p in skin.data.polygons]
    skin.data.materials.clear()
    for mat in unique:
        skin.data.materials.append(mat)
    for p,index in zip(skin.data.polygons,indices):
        p.material_index=index
    # Small redundant rings and seams dominate the construction mesh. Reduce
    # the joined mesh while retaining its material boundaries and skin weights.
    optimize=skin.modifiers.new('Mobile geometry budget','DECIMATE')
    optimize.ratio=.81
    optimize.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=skin
    bpy.ops.object.modifier_move_up(modifier=optimize.name)
    bpy.ops.object.modifier_apply(modifier=optimize.name)
    # Exact physical standing height and ground. All dimensions stay in meters.
    low=min(v.co.z for v in skin.data.vertices)
    high=max(v.co.z for v in skin.data.vertices)
    factor=cfg['height']/(high-low)
    for v in skin.data.vertices:
        v.co*=factor
        v.co.z-=low*factor
    bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='EDIT')
    for b in data.edit_bones:
        b.head*=factor
        b.tail*=factor
        b.head.z-=low*factor
        b.tail.z-=low*factor
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm,skin,factor


def animate(arm,skin,cfg):
    infant=cfg['stage']=='infant'
    scene=bpy.context.scene
    scene.render.fps=24
    clips=[('idle',48),('move',24),('interact',48)] + ([] if infant else [('jump',36)])
    for p in arm.pose.bones:
        p.rotation_mode='XYZ'
    arm.animation_data_create()
    for clip,duration in clips:
        action=bpy.data.actions.new(clip)
        arm.animation_data.action=action
        for frame in range(0,duration+1):
            scene.frame_set(frame)
            t=frame/duration
            phase=TAU*t
            for p in arm.pose.bones:
                p.location=(0,0,0)
                p.rotation_euler=(0,0,0)
                p.scale=(1,1,1)
            p=arm.pose.bones
            if clip=='idle':
                p['spine'].rotation_euler.x=.012*math.sin(phase)
                p['spine'].scale=(1+.007*math.sin(phase),1+.006*math.sin(phase),1+.007*math.sin(phase))
                p['head'].rotation_euler.z=.021*math.sin(phase)
                p['head'].rotation_euler.x=.015*math.sin(phase+.5)
                for side,sign in [('L',-1),('R',1)]:
                    p['upper_arm.'+side].rotation_euler.z=sign*.012*math.sin(phase)
            if clip=='move':
                amplitude=.37 if infant else .48
                p['pelvis'].rotation_euler.z=(.070 if infant else .031)*math.sin(phase)
                p['pelvis'].rotation_euler.y=.025*math.sin(phase)
                p['spine'].rotation_euler.z=-.035*math.sin(phase)
                p['spine'].rotation_euler.x=-.065 if infant else -.027
                p['head'].rotation_euler.z=-.025*math.sin(phase)
                # Bone-local Y is global vertical. Bob is visual only, no root travel.
                p['pelvis'].location.y=.009*(1-math.cos(phase*2))
                for side,sign in [('L',1),('R',-1)]:
                    gait=math.sin(phase)*sign
                    p['thigh.'+side].rotation_euler.x=amplitude*gait
                    p['shin.'+side].rotation_euler.x=-.48*max(0,-gait)
                    p['foot.'+side].rotation_euler.x=-.19*gait
                    p['upper_arm.'+side].rotation_euler.x=-.30*gait
                    p['forearm.'+side].rotation_euler.x=.09-.09*gait
            if clip=='interact':
                reach=math.sin(math.pi*t)**2
                p['spine'].rotation_euler.x=-.10*reach
                p['head'].rotation_euler.x=-.13*reach
                p['upper_arm.L'].rotation_euler.x=1.02*reach
                p['upper_arm.L'].rotation_euler.z=-.17*reach
                p['forearm.L'].rotation_euler.x=.32*reach
                p['hand.L'].rotation_euler.z=.20*reach
                p['upper_arm.R'].rotation_euler.x=.16*reach
            if clip=='jump':
                # Anticipation -> rising tuck -> soft landing. Root stays fixed.
                lift=max(0,math.sin(math.pi*(t-.16)/.68)) if .16<t<.84 else 0
                crouch=max(0,1-abs(t-.14)/.14)*.07 + max(0,1-abs(t-.86)/.14)*.05
                p['pelvis'].location.y=.17*lift-crouch
                p['thigh.L'].rotation_euler.x=.23*lift+.3*crouch/.07
                p['thigh.R'].rotation_euler.x=.17*lift+.3*crouch/.07
                p['shin.L'].rotation_euler.x=-.45*lift-.60*crouch/.07
                p['shin.R'].rotation_euler.x=-.37*lift-.60*crouch/.07
                p['foot.L'].rotation_euler.x=.19*lift+.3*crouch/.07
                p['foot.R'].rotation_euler.x=.19*lift+.3*crouch/.07
                p['upper_arm.L'].rotation_euler.z=-.33*lift
                p['upper_arm.R'].rotation_euler.z=.33*lift
                p['spine'].rotation_euler.x=-.08*lift
                p['head'].rotation_euler.x=.05*lift
            if clip in ('move','jump'):
                # Evaluate the actual deformed mesh at every exported frame.
                # Plant the lowest sole for locomotion and prevent jump landing
                # penetration without putting locomotion on the root/collider.
                bpy.context.view_layer.update()
                ev=skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
                data=ev.to_mesh()
                low=min((ev.matrix_world@v.co).z for v in data.vertices)
                ev.to_mesh_clear()
                if clip=='move' or low<0:
                    p['pelvis'].location.y-=low
            for pose in arm.pose.bones:
                pose.keyframe_insert('location',frame=frame,group=pose.name)
                pose.keyframe_insert('rotation_euler',frame=frame,group=pose.name)
                pose.keyframe_insert('scale',frame=frame,group=pose.name)
        action.use_fake_user=True
        track=arm.animation_data.nla_tracks.new()
        track.name=clip
        strip=track.strips.new(clip,0,action)
        strip.name=clip
        track.mute=True
        arm.animation_data.action=None
    for p in arm.pose.bones:
        p.location=(0,0,0)
        p.rotation_euler=(0,0,0)
        p.scale=(1,1,1)
    scene.frame_set(0)
    return [name for name,_ in clips]


CONFIGS=[
 {'stage':'infant','height':.75,'scale':.78,'hood':(.585,.189,.165,.145),'body':(.159,.282,.406,.453),'torso_rx':.168,'torso_ry':.121,'collar_rx':.173,'collar_ry':.129,'arm':[(.123,0,.424),(.190,.019,.338),(.222,.052,.290)],'leg':[(.084,0,.209),(.092,0,.134),(.098,-.004,.063)],'leg_radius':.046,'boot_scale':.67,'pelvis':.218,'bag':(.139,.131,.249),'clasp':(-.050,.128,.427)},
 {'stage':'child','height':1.20,'scale':1,'hood':(.996,.207,.204,.166),'body':(.468,.630,.807,.867),'torso_rx':.193,'torso_ry':.128,'collar_rx':.204,'collar_ry':.142,'arm':[(.151,-.003,.823),(.220,.017,.657),(.267,.038,.552)],'leg':[(.085,0,.527),(.09,-.005,.317),(.096,-.009,.107)],'leg_radius':.056,'boot_scale':1,'pelvis':.533,'bag':(.173,.143,.564),'clasp':(-.064,.142,.833)}
]


def build(output=OUTPUT):
    global PARTS
    os.makedirs(output,exist_ok=True)
    records=[]
    for cfg in CONFIGS:
        # Never load factory settings inside the live MCP scene: that unloads the
        # bridge addon. Remove authored data explicitly, preserving the service.
        if bpy.context.object and bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for data in list(bpy.data.meshes):
            bpy.data.meshes.remove(data)
        for data in list(bpy.data.armatures):
            bpy.data.armatures.remove(data)
        for data in list(bpy.data.texts):
            bpy.data.texts.remove(data)
        for action in list(bpy.data.actions):
            bpy.data.actions.remove(action)
        for mat in list(bpy.data.materials):
            bpy.data.materials.remove(mat)
        PARTS=[]
        bpy.context.scene.unit_settings.system='METRIC'
        bpy.context.scene.unit_settings.scale_length=1
        palette()
        hood(cfg)
        torso(cfg)
        joints=limbs(cfg)
        accessories(cfg)
        arm,skin,factor=rig(cfg,joints)
        clips=animate(arm,skin,cfg)
        bpy.ops.object.select_all(action='DESELECT')
        skin.select_set(True)
        arm.select_set(True)
        bpy.context.view_layer.objects.active=arm
        # Keep a build-source text block in each editable master as well as on disk.
        source_path=os.path.join(output,'build.py')
        if os.path.exists(source_path):
            text=bpy.data.texts.new('build.py')
            text.write(open(source_path).read())
        master=os.path.join(output,'traveler-'+cfg['stage']+'.blend')
        bpy.ops.wm.save_as_mainfile(filepath=master)
        target=os.path.join(output,'traveler-'+cfg['stage']+'.glb')
        bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',use_selection=True,export_yup=True,
            export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips_merged_animation_name='',
            export_skins=True,export_def_bones=True,export_all_influences=False,export_influence_nb=4,
            export_apply=False,export_texcoords=False,export_normals=True,export_tangents=False,
            export_materials='EXPORT',export_vertex_color='ACTIVE',export_all_vertex_colors=False,
            export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,
            export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,
            export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,
            export_draco_mesh_compression_enable=False)
        skin.data.calc_loop_triangles()
        coords=[v.co for v in skin.data.vertices]
        rec={'stage':cfg['stage'],'asset_version':'v001','blender':bpy.app.version_string,'triangles':len(skin.data.loop_triangles),
             'vertices_blender':len(skin.data.vertices),'materials':len(skin.data.materials),'bones':len(arm.data.bones),
             'height_m':max(v.z for v in coords)-min(v.z for v in coords),'standing_min_z_m':min(v.z for v in coords),
             'width_m':max(v.x for v in coords)-min(v.x for v in coords),'depth_m':max(v.y for v in coords)-min(v.y for v in coords),
             'expected_clips':clips,'coordinate_system':{'blender_up':'+Z','blender_forward':'+Y','gltf_up':'+Y','gltf_forward':'-Z','unit':'meter','origin':'feet at ground'},
             'construction_scale_correction':factor,'reference_sha256':REFERENCE_SHA256,
             'files':{os.path.basename(p):{'bytes':os.path.getsize(p),'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest()} for p in (master,target)}}
        records.append(rec)
        print(json.dumps(rec))
    with open(os.path.join(output,'construction.json'),'w') as f:
        json.dump(records,f,indent=2)
    return records


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=OUTPUT)
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    args=parser.parse_args(argv)
    build(args.output)
