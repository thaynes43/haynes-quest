"""WO-010: original, deterministic storybook clearing-kit candidates.

Blender 4.5 LTS. Sole live-scene author only; no factory reset or external assets.
Blender Z-up / +Y front becomes glTF Y-up / -Z front in meter units.
Each master retains editable named parts and this complete source in a text block.
"""
import argparse
import bmesh
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

ROOT = Path('/workspace/haynes-quest/clearing-kit/v001')
PARTS = []
MATS = {}
PALETTE = {
    'Walnut': ('735038', .92, 0),
    'Honey bronze': ('c09348', .56, .48),
    'PhotoSurface': ('dca953', 1, 0),
    'Grass': ('627d57', .98, 0),
    'Soil': ('71513b', 1, 0),
    'Sandstone': ('c5ad86', .96, 0),
    'Stone joints': ('827563', 1, 0),
    'Leaf': ('557363', .98, 0),
    'Lavender stone': ('858394', .98, 0),
    'Dark bronze': ('655039', .58, .45),
    'Amber lantern': ('dfaa49', .55, 0),
}
SPECS = {
    'memory-keepsake': {'catalog_id':'memory-keepsake','dimensions_xyz':[.42,.65,.10],'triangles_max':3000,'materials_max':6,'bytes_max':1048576},
    'ground-tile': {'catalog_id':'clearing-path-kit','dimensions_xyz':[2,.12,2],'triangles_max':2000,'materials_max':4,'bytes_max':512000},
    'path-tile': {'catalog_id':'clearing-path-kit','dimensions_xyz':[2,.08,2],'triangles_max':2000,'materials_max':4,'bytes_max':512000},
    'low-step': {'catalog_id':'clearing-path-kit','dimensions_xyz':[2,.22,.6],'triangles_max':2000,'materials_max':4,'bytes_max':512000},
    'clearing-tree': {'catalog_id':'clearing-tree','dimensions_xyz':[2.5,3,None],'triangles_max':5000,'materials_max':5,'bytes_max':1048576},
    'clearing-stone': {'catalog_id':'clearing-stone','dimensions_xyz':[1.05,.8,.75],'triangles_max':1500,'materials_max':3,'bytes_max':512000},
    'arrival-landmark': {'catalog_id':'arrival-landmark','dimensions_xyz':[2.4,2.8,.55],'triangles_max':6000,'materials_max':6,'bytes_max':1048576},
}


def srgb(c):
    return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4


def rgb(h):
    return tuple(srgb(int(h[i:i+2],16)/255) for i in (0,2,4))


def clear():
    global PARTS, MATS
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob,do_unlink=True)
    for store in (bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.cameras,bpy.data.lights):
        for data in list(store):
            if data.users == 0:
                store.remove(data)
    PARTS=[]
    MATS={}
    sc=bpy.context.scene
    sc.unit_settings.system='METRIC'
    sc.unit_settings.scale_length=1
    sc['work_order']='WO-010'
    sc['candidate_status']='unapproved'


def material(name):
    if name in MATS:
        return MATS[name]
    color,rough,metal=PALETTE[name]
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    m.diffuse_color=(*rgb(color),1)
    m['palette_srgb']='#'+color
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(1,1,1,1)
    bsdf.inputs['Roughness'].default_value=rough
    bsdf.inputs['Metallic'].default_value=metal
    bsdf.inputs['Specular IOR Level'].default_value=.27
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name='Color'
    m.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
    if name == 'Amber lantern':
        bsdf.inputs['Emission Color'].default_value=(*rgb('ffc66b'),1)
        bsdf.inputs['Emission Strength'].default_value=.35
    MATS[name]=m
    return m


def paint(ob,mat,tint=1,smooth=False):
    ob.data.materials.clear()
    ob.data.materials.append(material(mat))
    for uv in list(ob.data.uv_layers):
        ob.data.uv_layers.remove(uv)
    color=ob.data.color_attributes.get('Color') or ob.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
    base=rgb(PALETTE[mat][0])
    for face in ob.data.polygons:
        face.use_smooth=smooth
        for li in face.loop_indices:
            p=ob.data.vertices[ob.data.loops[li].vertex_index].co
            if mat=='Walnut':
                wash=1+.15*math.sin(p.x*16+p.z*2)+.06*math.sin(p.y*19+p.z*3)
            elif mat in ('Leaf','Grass'):
                wash=1+.21*math.sin(p.x*4+p.z*2)*math.cos(p.y*4)+.085*math.sin(p.y*7+p.z*3)
            else:
                wash=1+.09*math.sin(p.x*7+p.z*3)*math.cos(p.y*8)+.045*math.sin(p.x*12-p.z*6)
            painted=base
            if mat=='Leaf':
                # Warm broad olive wash over the common leaf-green anchor.
                mix=.18+.13*(.5+.5*math.sin(p.z*3+p.x*2))
                olive=rgb('929457')
                painted=tuple(a*(1-mix)+b*mix for a,b in zip(base,olive))
            if mat=='Lavender stone':
                center=face.center
                wash=1+.16*math.sin(center.x*13+center.z*7)*math.cos(center.y*14)+.055*math.cos(center.z*15+center.y*9)
            color.data[li].color=(*[min(1,max(.0001,v*tint*wash)) for v in painted],1)
    ob.data.color_attributes.active_color=color


def mesh(name,verts,faces,mat,tint=1,smooth=False,closed=True):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    if closed:
        bm=bmesh.new(); bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(data); bm.free()
    paint(ob,mat,tint,smooth)
    PARTS.append(ob)
    return ob


def rings(name,rows,mat,tint=1,smooth=False):
    n=len(rows[0]); v=[p for row in rows for p in row]
    f=[]
    for j in range(len(rows)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            f.append((a,b,b+n,a+n))
    f.extend([tuple(range(n-1,-1,-1)),tuple((len(rows)-1)*n+i for i in range(n))])
    return mesh(name,v,f,mat,tint,smooth)


def box(name,center,size,mat,bevel=0,tint=1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    ob=bpy.context.object; ob.name=name; ob.scale=size
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if bevel:
        m=ob.modifiers.new('Rounded crafted edges','BEVEL'); m.width=bevel; m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
    paint(ob,mat,tint,False)
    ob.select_set(False); PARTS.append(ob)
    return ob


def tube(name,points,radii,mat,sides=10,tint=1):
    pts=[Vector(p) for p in points]; rows=[]
    for i,p in enumerate(pts):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        axis=Vector((0,1,0))
        if abs(t.dot(axis))>.9: axis=Vector((1,0,0))
        u=t.cross(axis).normalized(); v=t.cross(u).normalized()
        r=radii[i] if isinstance(radii,list) else radii
        rows.append([p+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v) for j in range(sides)])
    return rings(name,rows,mat,tint,True)


def disk(name,center,radius,depth,mat,sides=20):
    cx,cy,cz=center
    return rings(name,[[(cx+radius*math.cos(i*math.tau/sides),y,cz+radius*math.sin(i*math.tau/sides)) for i in range(sides)] for y in (cy-depth/2,cy+depth/2)],mat)


def profile(name,outline,depth,mat,y=0,bevel=0,tint=1):
    ob=rings(name,[[(x,y+d,z) for x,z in outline] for d in (-depth/2,depth/2)],mat,tint)
    if bevel:
        bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        m=ob.modifiers.new('Soft profile edges','BEVEL'); m.width=bevel; m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
        paint(ob,mat,tint)
        ob.select_set(False)
    return ob


def fit(dimensions):
    pts=[v.co for ob in PARTS for v in ob.data.vertices]
    lo=[min(p[k] for p in pts) for k in range(3)]
    hi=[max(p[k] for p in pts) for k in range(3)]
    # Requested tuple is Blender width, depth, height. None keeps its existing scale.
    scale=[dimensions[k]/(hi[k]-lo[k]) if dimensions[k] is not None else 1 for k in range(3)]
    for ob in PARTS:
        for v in ob.data.vertices:
            for k in range(3):
                v.co[k]=(v.co[k]-(lo[k] if k==2 else (hi[k]+lo[k])/2))*scale[k]
        ob.data.update()


def inside(point,poly):
    x,y=point; hit=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: hit=not hit
    return hit


def photo_surface():
    # Constrained triangulation makes the placeholder a truly flat colored surface.
    # Every face has the SAME replacement material and a continuous UV projection.
    boundary=[(-.154,.084),(.154,.084),(.154,.393),(.139,.457),(.093,.523),(0,.59),(-.093,.523),(-.139,.457),(-.154,.393)]
    ellipse=lambda x,z,rx,rz,n=16:[(x+rx*math.cos(i*math.tau/n),z+rz*math.sin(i*math.tau/n)) for i in range(n)]
    sun=ellipse(.06,.443,.026,.026,20)
    hill=[(-.136,.09),(.136,.09),(.136,.17),(.09,.188),(.04,.172),(-.02,.192),(-.075,.173),(-.136,.19)]
    road=[(-.05,.09),(.006,.09),(.038,.128),(.036,.153),(.007,.177),(-.01,.177),(.012,.15),(.015,.134)]
    trunk=[(-.042,.172),(.015,.172),(-.004,.195),(-.009,.27),(.023,.31),(.029,.327),(.011,.316),(-.015,.288),(-.031,.322),(-.045,.337),(-.04,.305),(-.025,.274),(-.028,.203)]
    crown=[ellipse(-.065,.34,.042,.036),ellipse(-.031,.373,.043,.037),ellipse(.014,.362,.043,.039),ellipse(.052,.329,.036,.032),ellipse(-.005,.327,.046,.038),ellipse(-.078,.309,.026,.025)]
    polygons=[boundary,sun,hill,road,trunk,*crown]
    coords=[]; constraints=[]
    for poly in polygons:
        start=len(coords); coords.extend(Vector(p) for p in poly)
        constraints.append(tuple(range(start,len(coords))))
    verts,_,faces,*_=delaunay_2d_cdt(coords,[],constraints,0,1e-7,False)
    fs=[]; cols=[]
    for face in faces:
        c=sum((verts[i] for i in face),Vector((0,0)))/len(face)
        if not inside(c,boundary): continue
        color='cf9640'
        if inside(c,hill): color='ae752f'
        if inside(c,road): color='f6d884'
        if inside(c,trunk) or any(inside(c,p) for p in crown): color='76512f'
        if inside(c,sun): color='f9e6a5'
        fs.append(tuple(reversed(face))); cols.append(rgb(color))
    ob=mesh('PhotoSurface',[(p.x,.026,p.y) for p in verts],fs,'PhotoSurface',closed=False)
    layer=ob.data.color_attributes['Color']
    for f,color in zip(ob.data.polygons,cols):
        for li in f.loop_indices: layer.data[li].color=(*color,1)
    uv=ob.data.uv_layers.new(name='PhotoUV')
    for loop in ob.data.loops:
        p=ob.data.vertices[loop.vertex_index].co
        # A +Y-facing Blender panel (glTF -Z) has screen-left at +X.
        # Reverse U so a later photo material reads correctly from the front.
        uv.data[loop.index].uv=((.154-p.x)/.308,(p.z-.084)/(.59-.084))
    ob['replacement']='Assign a photo material using TEXCOORD_0 and ignoring COLOR_0; all insert faces share one material. No overlay objects or private image are present.'
    ob['content']='Original fictional amber tree, geometric vertex-color illustration.'
    return ob


def keepsake():
    outer=[(-.185,.054),(.185,.054),(.185,.39),(.16,.467),(.105,.543),(0,.615),(-.105,.543),(-.16,.467),(-.185,.39)]
    profile('Plain closed walnut backing',outer,.028,'Walnut',y=-.016,bevel=.003,tint=.85)
    # Two cheeks and a seven-segment pointed arch make a thick but unobstructed frame.
    box('Left walnut cheek',(-.162,.008,.25),(.046,.05,.39),'Walnut',.006)
    box('Right walnut cheek',(.162,.008,.25),(.046,.05,.39),'Walnut',.006,tint=1.05)
    arch=[(-.163,.008,.385),(-.143,.008,.45),(-.095,.008,.512),(0,.008,.585),(.095,.008,.512),(.143,.008,.45),(.163,.008,.385)]
    tube('Pointed rounded arch',arch,.026,'Walnut',sides=8)
    box('Lower crosspiece',(0,.01,.055),(.385,.062,.073),'Walnut',.008)
    for x in (-.17,.17):
        box('Base corner brace', (x,.032,.04),(.064,.036,.08),'Walnut',.006,tint=.90)
        box('Shoulder brace',(x,.031,.40),(.07,.025,.048),'Walnut',.004,tint=1.07)
        disk('Discreet bronze peg',(x,.048,.04),.007,.005,'Honey bronze',12)
    profile('Apex token seat',[(-.05,.557),(.05,.557),(.053,.602),(0,.63),(-.053,.602)],.02,'Walnut',y=.025,bevel=.004,tint=.84)
    disk('Honey token',(0,.043,.587),.029,.009,'Honey bronze')
    tube('Token sprout',[(0,.05,.57),(0,.05,.59),(0,.05,.609)],.0025,'Honey bronze',6,tint=1.25)
    for side in (-1,1):
        profile('Token leaf',[(0,.592),(side*.013,.598),(side*.012,.587),(0,.582)],.002,'Honey bronze',y=.05,tint=1.3)
    # Full width rear wedge sits within the agreed shallow 10 cm total envelope.
    wedge=[(-.11,-.027,0),(.11,-.027,0),(-.11,-.027,.15),(.11,-.027,.15),(-.11,-.066,0),(.11,-.066,0)]
    mesh('Integral stable rear wedge',wedge,[(0,1,3,2),(0,4,5,1),(0,2,4),(1,5,3),(2,3,5,4)],'Walnut',.83)
    photo_surface()
    fit((.42,.10,.65))


def tile_ground():
    n=16; verts=[]
    for iy in range(n+1):
        for ix in range(n+1):
            x=-1+ix*2/n; y=-1+iy*2/n
            z=.12 if ix in (0,n) or iy in (0,n) else .112+.008*(.5+.5*math.sin(ix*1.6+iy*2.1))
            verts.append((x,y,z))
    faces=[]
    for iy in range(n):
        for ix in range(n):
            a=iy*(n+1)+ix; faces.append((a,a+1,a+n+2,a+n+1))
    boundary=list(range(n+1))+[i*(n+1)+n for i in range(1,n+1)]+list(range(n*(n+1)+n-1,n*(n+1)-1,-1))+[i*(n+1) for i in range(n-1,0,-1)]
    for i in boundary: verts.append((verts[i][0],verts[i][1],0))
    start=(n+1)**2
    for j in range(len(boundary)):
        k=(j+1)%len(boundary)
        faces.append((boundary[j],start+j,start+k,boundary[k]))
    faces.append(tuple(start+i for i in range(len(boundary)-1,-1,-1)))
    ob=mesh('Ground tile — closed grass and soil',verts,faces,'Grass')
    ob.data.materials.append(material('Soil'))
    color=ob.data.color_attributes['Color']; base=rgb('71513b')
    for f in list(ob.data.polygons)[n*n:]:
        f.material_index=1
        for li in f.loop_indices:
            p=ob.data.vertices[ob.data.loops[li].vertex_index].co
            w=.88+.12*math.sin(p.x*8+p.y*5)
            color.data[li].color=(*[v*w for v in base],1)


def clip(poly,n,c):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=a[0]*n[0]+a[1]*n[1]-c; db=b[0]*n[0]+b[1]*n[1]-c
        if da<=1e-9: out.append(a)
        if (da<0)!=(db<0):
            t=da/(da-db); out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return out


def pavers(width,depth,height,seeds):
    bed=box('Continuous closed rectangular joint bed',(0,0,(height-.013)/2),(width,depth,height-.013),'Stone joints')
    bed.data.materials.append(material('Sandstone'))
    color=bed.data.color_attributes['Color']
    for face in bed.data.polygons:
        if face.normal.z<.5:
            face.material_index=1
            for li in face.loop_indices: color.data[li].color=(*[v*.93 for v in rgb('c5ad86')],1)
    for i,p in enumerate(seeds):
        poly=[(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]
        for q in seeds:
            if p==q: continue
            n=(q[0]-p[0],q[1]-p[1]); c=(q[0]**2+q[1]**2-p[0]**2-p[1]**2)/2
            poly=clip(poly,n,c)
        # Chamfer broad paver corners without changing the bed's rectangular envelope.
        rounded=[]
        for j,pnt in enumerate(poly):
            a=Vector(poly[j-1]); b=Vector(pnt); c=Vector(poly[(j+1)%len(poly)])
            rounded.extend([tuple(b+(a-b).normalized()*min(.035,(a-b).length*.18)),tuple(b+(c-b).normalized()*min(.035,(c-b).length*.18))])
        poly=rounded
        cx=sum(v[0] for v in poly)/len(poly); cy=sum(v[1] for v in poly)/len(poly)
        inset=lambda p,k:(cx+(p[0]-cx)*k,cy+(p[1]-cy)*k)
        bottom=[(x,y,height-.013) for x,y in poly]
        rim=[]; top=[]
        for pnt in poly:
            q=inset(pnt,.976)
            # Border vertices remain on the exact outside rectangle below the soft top lip.
            x=pnt[0] if abs(abs(pnt[0])-width/2)<1e-6 else q[0]
            y=pnt[1] if abs(abs(pnt[1])-depth/2)<1e-6 else q[1]
            rim.append((x,y,height-.006))
            tx,ty=inset((x,y),.973)
            top.append((tx,ty,height))
        rings('Broad sandstone paver %02d'%(i+1),[bottom,rim,top],'Sandstone',.91+.035*(i%5))


def tile_path():
    pavers(2,2,.08,[(-.67,-.62),(.40,-.66),(-.61,.13),(.26,.10),(.80,.42),(-.61,.79),(.21,.82)])


def low_step():
    pavers(2,.6,.22,[(-.76,-.07),(-.30,.06),(.20,-.04),(.72,.065)])


def leaf_mass(name,center,scale,phase,tint):
    n=24; nr=13; rows=[]
    for j in range(1,nr):
        phi=math.pi*j/nr; row=[]
        for i in range(n):
            th=math.tau*i/n
            lobe=1+.075*math.sin(th*5+phase)*math.sin(phi)**2+.045*math.cos(phi*5+th*3+phase)
            row.append((center[0]+scale[0]*math.sin(phi)*math.cos(th)*lobe,center[1]+scale[1]*math.sin(phi)*math.sin(th)*lobe,center[2]+scale[2]*math.cos(phi)*lobe))
        rows.append(row)
    verts=[(center[0],center[1],center[2]+scale[2])]+[p for row in rows for p in row]+[(center[0],center[1],center[2]-scale[2])]
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
    for j in range(len(rows)-1):
        for i in range(n):
            a=1+j*n+i; b=1+j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    last=len(verts)-1; off=1+(len(rows)-1)*n
    faces.extend((off+i,last,off+(i+1)%n) for i in range(n))
    ob=mesh(name,verts,faces,'Leaf',tint,True)
    ob['foliage_mass']=True


def tree():
    # Closed root-flare rings and three limbs; four broad leaf masses only.
    trunk=[(0,0,0,.37),(.01,0,.13,.28),(.08,-.01,.38,.21),(.16,-.015,.67,.17),(.15,0,.96,.15),(.02,-.015,1.23,.13),(-.11,-.02,1.48,.11),(-.17,-.04,1.76,.085),(-.13,-.055,2.13,.055),(-.11,-.05,2.50,.023)]
    rows=[]
    for j,(x,y,z,r) in enumerate(trunk):
        rows.append([(x+math.cos(i*math.tau/14)*r*(1+.16*math.cos(i*math.tau*5/14)/(1+j*.5)),y+math.sin(i*math.tau/14)*r*(1+.12*math.cos(i*math.tau*5/14)/(1+j*.5)),z) for i in range(14)])
    rings('Curved trunk with integral root flare',rows,'Walnut',1,True)
    tube('Left main limb',[(.10,0,.76),(-.14,.07,1.04),(-.47,.11,1.28),(-.75,.15,1.58)],[.12,.11,.085,.028],'Walnut',12)
    tube('Right main limb',[(.04,0,1.20),(.28,-.025,1.38),(.49,-.03,1.65),(.64,-.02,2.01)],[.125,.108,.076,.026],'Walnut',12,tint=1.08)
    tube('Low right branch',[(.13,-.025,.65),(.36,-.12,.80),(.61,-.20,1.04),(.77,-.23,1.23)],[.092,.075,.05,.020],'Walnut',10,tint=.93)
    leaf_mass('Foliage 01 — high cushion',(-.17,-.06,2.47),(.85,.73,.56),.3,1.04)
    leaf_mass('Foliage 02 — left cushion',(-.82,.15,1.63),(.62,.59,.51),1.6,.97)
    leaf_mass('Foliage 03 — right cushion',(.62,-.03,2.05),(.69,.62,.54),3.2,1.02)
    leaf_mass('Foliage 04 — low cushion',(.78,-.22,1.20),(.45,.46,.37),4.5,.91)
    fit((2.5,None,3))


def stone():
    n=22; rows=[]
    specs=[(0,.73),(.042,.87),(.135,.98),(.30,1),(.49,.87),(.63,.70),(.73,.46),(.79,.18)]
    for j,(z,r) in enumerate(specs):
        row=[]
        for i in range(n):
            th=math.tau*i/n+.032*math.sin(j*2+i*1.7)
            offset=.039*math.sin(3*th+z*6)+.026*math.cos(5*th-z*2)
            radius=r*(1+.055*math.sin(3*th+.4)+.035*math.cos(5*th+j*.1))
            x=.525*math.cos(th)*radius-.055*z
            y=.375*math.sin(th)*radius+.026*z
            # Preserve a broad planar underside; the first irregular shoulder ring
            # must never become lower than the closed bottom cap.
            zz=0 if j==0 else max(.012,z+offset*r)
            # One shallow shoulder fold, broad enough to survive the mobile silhouette.
            x-=.018*math.exp(-((th-4.4)/.45)**2)*math.sin(z*math.pi/.8)
            row.append((x,y,zz))
        rows.append(row)
    ob=rings('One rounded asymmetric lavender boulder',rows,'Lavender stone',1,False)
    bm=bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    paint(ob,'Lavender stone',1,False)
    fit((1.05,.75,.8))


def gateway():
    outer=[(-1.15,.13),(-1.20,.57),(-1.195,1.02),(-1.14,1.47),(-1.02,1.88),(-.84,2.24),(-.61,2.55),(-.36,2.80)]
    inner=[(-.28,2.64),(-.48,2.42),(-.65,2.12),(-.79,1.79),(-.87,1.43),(-.90,1.05),(-.89,.69),(-.82,.34),(-.80,.13)]
    for side in (1,-1):
        profile(('Left' if side==1 else 'Right')+' inward walnut crescent',[(x*side,z) for x,z in outer+inner],.33,'Walnut',bevel=.018,tint=1 if side==1 else .94)
        # Three plain stone courses. Bottom rectangle retains the exact footprint.
        for j,(z,w,d,h) in enumerate([(.07,.4,.55,.14),(.205,.4,.55,.14),(.34,.4,.55,.14)]):
            box('Sandstone foot course %d %d'%(side,j),(-side*1.0,0,z),(w,d,h),'Sandstone',.014,tint=.97+.055*j)
    pts=[(-.64+1.28*i/16,0,2.37+.12*(1-((i-8)/8)**2)) for i in range(17)]
    tube('Thin bronze crossbar',pts,.023,'Dark bronze',8)
    tube('Lantern suspension',[(0,0,2.49),(0,0,2.35),(0,0,2.29)],.012,'Dark bronze',8)
    # Small opaque faceted amber glass avoids transparency sorting and bloom needs.
    n=6
    rows=[[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for i in range(n)] for z,r in [(1.93,.05),(1.98,.085),(2.14,.098),(2.20,.076)]]
    rings('Amber lantern glass',rows,'Amber lantern',1,False)
    for z,r in [(1.95,.065),(2.19,.105)]:
        rings('Bronze lantern rim', [[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),zz) for i in range(n)] for zz in (z-.008,z+.008)],'Dark bronze')
    for i in range(n):
        th=i*math.tau/n
        tube('Lantern frame rib %d'%i,[(r*math.cos(th),r*math.sin(th),z) for z,r in [(1.95,.065),(1.99,.088),(2.14,.10),(2.19,.105)]],.006,'Dark bronze',6)
    rings('Lantern six-sided cap',[[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for i in range(n)] for z,r in [(2.195,.12),(2.22,.108),(2.265,.032),(2.28,.022)]],'Dark bronze')
    fit((2.4,.55,2.8))


def stats(objects):
    points=[]; triangles=0; boundaries={};ground_contact_area=0
    for ob in objects:
        ob.data.calc_loop_triangles(); triangles+=len(ob.data.loop_triangles)
        points.extend(ob.matrix_world@v.co for v in ob.data.vertices)
        for p in ob.data.polygons:
            if all(abs((ob.matrix_world@ob.data.vertices[i].co).z)<1e-6 for i in p.vertices):
                ground_contact_area+=p.area
        bm=bmesh.new(); bm.from_mesh(ob.data)
        boundaries[ob.name]={'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges)}
        bm.free()
    lo=[min(p[k] for p in points) for k in range(3)]; hi=[max(p[k] for p in points) for k in range(3)]
    return {'triangles':triangles,'materials':sorted({m.name for o in objects for m in o.data.materials}),'bounds_blender':{'min':lo,'max':hi},'dimensions_blender':[hi[k]-lo[k] for k in range(3)],'ground_contact_area_m2':ground_contact_area,'topology':boundaries}


def digest(path):
    return {'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def export_model(name,root):
    folder=root/name; folder.mkdir(parents=True,exist_ok=True)
    sc=bpy.context.scene; sc['asset_id']=name
    source=(root/'build.py').read_text()
    text=bpy.data.texts.get('WO-010-build.py') or bpy.data.texts.new('WO-010-build.py')
    text.clear(); text.write(source)
    evidence=stats(PARTS)
    evidence.update({'asset_id':name,'spec':SPECS[name],'source_blender':bpy.app.version_string,'front_blender':'+Y','front_gltf':'-Z','ground_gltf_y':0,'source_concepts':json.loads((root/'source-concepts.json').read_text())})
    master=folder/(name+'.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
    # Master keeps named editable construction pieces. Export combines static shells
    # into one mesh (plus PhotoSurface) to bound browser draw calls by materials.
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for original in PARTS:
        duplicate=original.copy(); duplicate.data=original.data.copy()
        bpy.context.collection.objects.link(duplicate)
        duplicate.select_set(True); copies.append(duplicate)
        original.hide_set(True)
    surfaces=[o for o in copies if o.name.startswith('PhotoSurface')]
    main=[o for o in copies if o not in surfaces]
    bpy.ops.object.select_all(action='DESELECT')
    for ob in main: ob.select_set(True)
    bpy.context.view_layer.objects.active=main[0]
    bpy.ops.object.join(); combined=bpy.context.object; combined.name=name
    if surfaces:
        # glTF requires the public node and material names to be exact.
        for ob in PARTS:
            if ob.name=='PhotoSurface': ob.name='PhotoSurface master'
        surfaces[0].name='PhotoSurface'
    bpy.ops.object.select_all(action='DESELECT')
    combined.select_set(True)
    for ob in surfaces: ob.select_set(True)
    glb=folder/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_attributes=True)
    evidence['master']=digest(master); evidence['glb']=digest(glb)
    evidence['intentional_open_surface']='PhotoSurface is a flat, front-facing UV insert backed by closed wood.' if surfaces else None
    (folder/'construction.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({'built':name,'triangles':evidence['triangles'],'materials':len(evidence['materials']),'glb_bytes':glb.stat().st_size}),flush=True)
    return evidence


def build(root=ROOT):
    root=Path(root); root.mkdir(parents=True,exist_ok=True)
    records={}
    for name,fn in [('memory-keepsake',keepsake),('ground-tile',tile_ground),('path-tile',tile_path),('low-step',low_step),('clearing-tree',tree),('clearing-stone',stone),('arrival-landmark',gateway)]:
        clear(); fn(); records[name]=export_model(name,root)
    (root/'build-inventory.json').write_text(json.dumps(records,indent=2)+'\n')
    return records


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--output',default=str(ROOT))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build(args.output)
