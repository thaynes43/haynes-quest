"""Original Rooftop City primitives. Blender +Z up; front -Y becomes glTF +Z."""
import bpy, bmesh, math
from mathutils import Vector

PALETTE = {
    'ink':'#2f3a50', 'steel':'#60788c', 'light':'#adbbc2', 'cream':'#e2d6bb',
    'wood':'#9c6346', 'wood2':'#b27b53', 'wood3':'#85533f',
    'honey':'#eab24f', 'honeydark':'#c18438', 'mauve':'#b1687f', 'black':'#27313e',
}
MATS = {}
PARTS = []
CUR = None

def linear(hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)

def mat(key):
    if key not in MATS:
        m=bpy.data.materials.new('Rooftop '+key);m.use_nodes=True
        m.diffuse_color=linear(PALETTE[key]);p=m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=m.diffuse_color
        p.inputs['Roughness'].default_value=.82 if 'wood' in key else .68
        p.inputs['Metallic'].default_value=0
        p.inputs['Specular IOR Level'].default_value=.2
        m['palette_hex']=PALETTE[key];MATS[key]=m
    return MATS[key]

def begin(prop):
    global CUR
    CUR=bpy.data.collections.new('RC '+prop);bpy.context.scene.collection.children.link(CUR)

def mesh(name,verts,faces,key,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);CUR.objects.link(ob);me.materials.append(mat(key))
    ob['kit_prop']=CUR.name[3:];ob['palette']=key
    for p in me.polygons:p.use_smooth=smooth
    PARTS.append(ob);return ob

def finish(ob,bevel=0,seg=1):
    if bevel:
        m=ob.modifiers.new('Soft edge','BEVEL');m.width=bevel;m.segments=seg
        m=ob.modifiers.new('Face normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return ob

def box(name,loc,size,key,bevel=.018,seg=1):
    v=[(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in
       [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    ob=mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],key)
    ob.location=loc;return finish(ob,bevel,seg)

def cyl(name,loc,r,depth,key,seg=24,r2=None,rotation=None,bevel=0):
    if r2 is None:r2=r
    v=[(R*math.cos(math.tau*i/seg),R*math.sin(math.tau*i/seg),z) for R,z in [(r,-depth/2),(r2,depth/2)] for i in range(seg)]
    f=[tuple(reversed(range(seg))),tuple(range(seg,seg*2))]
    f += [(i,(i+1)%seg,(i+1)%seg+seg,i+seg) for i in range(seg)]
    ob=mesh(name,v,f,key);ob.location=loc
    if rotation:ob.rotation_euler=rotation
    return finish(ob,bevel)

def beam(name,a,b,width,key,depth=None,bevel=.01):
    a,b=Vector(a),Vector(b)
    ob=box(name,(a+b)/2,(width,depth or width,(b-a).length),key,bevel)
    ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return ob

def rod(name,a,b,r,key,seg=12):
    a,b=Vector(a),Vector(b)
    ob=cyl(name,(a+b)/2,r,(b-a).length,key,seg)
    ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return ob

def ring(name,loc,major,minor,key,seg=32,tube=6,rotation=None):
    v=[((major+minor*math.cos(math.tau*j/tube))*math.cos(math.tau*i/seg),
        (major+minor*math.cos(math.tau*j/tube))*math.sin(math.tau*i/seg),minor*math.sin(math.tau*j/tube))
       for i in range(seg) for j in range(tube)]
    f=[(i*tube+j,((i+1)%seg)*tube+j,((i+1)%seg)*tube+(j+1)%tube,i*tube+(j+1)%tube) for i in range(seg) for j in range(tube)]
    ob=mesh(name,v,f,key,True);ob.location=loc
    if rotation:ob.rotation_euler=rotation
    return ob

def slab(name,points,depth,key,y=0,bevel=0):
    n=len(points);v=[(x,y+dy,z) for dy in (-depth/2,depth/2) for x,z in points]
    f=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return finish(mesh(name,v,f,key),bevel)

def sweep(name,points,r,key,seg=8):
    pts=[Vector(p) for p in points];v=[]
    for i,p in enumerate(pts):
        tangent=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]
        tangent.normalize();axis=Vector((0,1,0));cross=tangent.cross(axis).normalized()
        rad=r[i] if isinstance(r,list) else r
        for j in range(seg):v.append(tuple(p+rad*(axis*math.cos(math.tau*j/seg)+cross*math.sin(math.tau*j/seg))))
    f=[tuple(reversed(range(seg))),tuple(range((len(pts)-1)*seg,len(pts)*seg))]
    f += [(i*seg+j,i*seg+(j+1)%seg,(i+1)*seg+(j+1)%seg,(i+1)*seg+j) for i in range(len(pts)-1) for j in range(seg)]
    return mesh(name,v,f,key,True)

def bounds(objects):
    deps=bpy.context.evaluated_depsgraph_get();v=[]
    for ob in objects:
        ev=ob.evaluated_get(deps);me=ev.to_mesh();v.extend(ev.matrix_world @ p.co for p in me.vertices);ev.to_mesh_clear()
    return {'min':[min(p[i] for p in v) for i in range(3)],'max':[max(p[i] for p in v) for i in range(3)]}

def camera(loc,target,scale):
    me=bpy.data.cameras.new('Rooftop sheet camera');ob=bpy.data.objects.new('Rooftop sheet camera',me)
    bpy.context.scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    me.type='ORTHO';me.ortho_scale=scale;bpy.context.scene.camera=ob;return ob

def light(name,loc,power,size,target=(0,0,2)):
    me=bpy.data.lights.new(name,'AREA');me.energy=power;me.shape='DISK';me.size=size
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
