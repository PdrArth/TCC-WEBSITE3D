"""Author the four-island archipelago from the original furnished pavilions.

Blender 4.5 LTS, no external add-ons. Coordinates here are Blender Z-up. The
glTF exporter converts (x,y,z) into the manifest's metre/Y-up (x,z,-y).
All modelling functions are deterministic. The poster is rendered from the
same scene and camera recorded in manifest.json, not from a separate image.

Usage: blender --background --factory-startup --python scripts/world/build_world.py -- [--quick] [--skip-render]
"""
import bpy, math, random, json, sys, os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/experience/world"
SOURCE = ROOT / "assets/world"
TEX = SOURCE / "textures/derived"
OUT.mkdir(parents=True,exist_ok=True)
SOURCE.mkdir(parents=True,exist_ok=True)
ARGS = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
QUICK = "--quick" in ARGS
SKIP_RENDER = "--skip-render" in ARGS
R = random.Random(1729)
WORLD = []
AVATAR = []
AMBIENT = []
MATS = {}
PAVILIONS = {}

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.fps = 24
scene.world.color = (.75,.69,.59)
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (.75,.69,.60,1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value = .65

def color(hexval):
    # Material colors entered in sRGB are converted into Blender's linear space.
    v = hexval.lstrip("#")
    s = [int(v[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in s)

def material(name, hexval, rough=.82, metal=0, texture=None, normal=None, normal_strength=.18):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    base=color(hexval)
    mat.diffuse_color=(*base,1)
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*base,1)
    bsdf.inputs["Roughness"].default_value=rough
    bsdf.inputs["Metallic"].default_value=metal
    if texture:
        node=mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image=bpy.data.images.load(str(TEX/texture),check_existing=True)
        mat.node_tree.links.new(node.outputs["Color"],bsdf.inputs["Base Color"])
    if normal:
        image=mat.node_tree.nodes.new("ShaderNodeTexImage")
        image.image=bpy.data.images.load(str(TEX/normal),check_existing=True)
        image.image.colorspace_settings.name="Non-Color"
        normal_node=mat.node_tree.nodes.new("ShaderNodeNormalMap")
        normal_node.inputs["Strength"].default_value=normal_strength
        mat.node_tree.links.new(image.outputs["Color"],normal_node.inputs["Color"])
        mat.node_tree.links.new(normal_node.outputs["Normal"],bsdf.inputs["Normal"])
    MATS[name]=mat
    return mat

material("Limestone · island", "D2C7AF", texture="plaster_cream.jpg",normal="plaster_normal.jpg")
material("Warm stone · paths", "CFC2AA",texture="stone_paving.jpg",normal="stone_normal.jpg",normal_strength=.12)
material("Terracotta · specify", "A96243",texture="plaster_terracotta.jpg",normal="plaster_normal.jpg")
material("Sage · generate", "5E7063",texture="plaster_sage.jpg",normal="plaster_normal.jpg")
material("Slate blue · validate", "5B6F86",texture="plaster_blue.jpg",normal="plaster_normal.jpg")
material("Sand · evolve", "C1B291",texture="plaster_sand.jpg",normal="plaster_normal.jpg")
material("Olive · evolve beam", "727853",texture="plaster_olive.jpg",normal="plaster_normal.jpg")
material("Oak · furniture", "A77C4F",rough=.65,texture="oak_veneer.jpg",normal="oak_normal.jpg",normal_strength=.14)
material("Oak endgrain", "98704B",rough=.77)
material("Dark steel", "39423E",rough=.56,metal=.55)
material("Brushed brass", "A99561",rough=.46,metal=.62)
material("Charcoal screen", "222C2E",rough=.36)
material("Display · code green", "BCD4BC",rough=.5)
material("Display · code ochre", "E1C38D",rough=.5)
material("Display · code blue", "9AAECC",rough=.5)
material("Paper warm", "E6DDC7")
material("Graphite ink", "566057")
material("Terracotta pot", "967055")
material("Ceramic cream", "D1CBB9")
material("Soil", "494D36")
material("Rock limestone", "A8A28F")
material("Bark", "716447")
material("Garden olive dark", "4E5E40")
material("Garden sage", "72845A")
material("Garden olive light", "929B69")
material("Garden leaf deep", "374F3A")
material("Garden dry tip", "B2AA7A")
material("Flower ivory", "DDD2A9")
material("Flower blue", "8C97AA")
material("Visitor skin", "AF8F73",rough=.8)
material("Visitor shirt", "D4D1C3",rough=.86)
material("Visitor trousers", "424D51",rough=.83)
material("Visitor shoes", "685D4B",rough=.75)
material("Visitor hair", "332F29",rough=.82)
material("Visitor backpack", "677062",rough=.82)
material("Poster warm backdrop", "EDE1CD",rough=.92)

def own(o, dest=WORLD):
    dest.append(o)
    return o

def assign(o, mat):
    o.data.materials.append(MATS[mat] if isinstance(mat,str) else mat)
    return o

def apply_modifiers(o):
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)

def mesh(name, verts, faces, mat=None, dest=WORLD, smooth=False, uv=True):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    if mat: assign(obj,mat)
    if smooth:
        for p in data.polygons: p.use_smooth=True
    if uv:
        # Face-oriented metre coordinates avoid stretching across vertical walls.
        layer=data.uv_layers.new(name="UVMap")
        for p in data.polygons:
            axis=max(range(3),key=lambda a:abs(p.normal[a]))
            for li in p.loop_indices:
                v=data.vertices[data.loops[li].vertex_index].co
                layer.data[li].uv=(v.y/2,v.z/2) if axis==0 else ((v.x/2,v.z/2) if axis==1 else (v.x/2,v.y/2))
    return own(obj,dest)

def cube(name, loc, dims, mat, bevel=.025, dest=WORLD, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object
    o.name=name
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    assign(o,mat)
    if bevel>0:
        mod=o.modifiers.new("Soft worked edges","BEVEL")
        mod.width=min(bevel,min(dims)*.4)
        mod.segments=2 if not QUICK else 1
        apply_modifiers(o)
    if rot: o.rotation_euler=rot
    # UV primitives retain sane per-face mapping; scaled furniture grain is intentional.
    return own(o,dest)

def cylinder(name, loc, radius, depth, mat, vertices=40, bevel=.016, dest=WORLD, top_radius=None):
    if top_radius is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=top_radius,depth=depth,location=loc)
    o=bpy.context.object
    o.name=name
    assign(o,mat)
    if bevel:
        mod=o.modifiers.new("Rounded rim","BEVEL");mod.width=bevel;mod.segments=2
        apply_modifiers(o)
    for p in o.data.polygons:
        if abs(p.normal.z)<.5: p.use_smooth=True
    return own(o,dest)

def segment(name,a,b,r,mat,r2=None,dest=WORLD,vertices=8):
    a,b=Vector(a),Vector(b)
    o=cylinder(name,(a+b)/2,r,(b-a).length,mat,vertices,0,dest,top_radius=r2)
    o.rotation_euler=(b-a).to_track_quat("Z","Y").to_euler()
    return o

def sphere(name, loc, scale, mat, dest=WORLD, segments=14, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    assign(o,mat)
    for p in o.data.polygons:p.use_smooth=True
    return own(o,dest)

def arc_wall(name,center,radius,thickness,z0,height,start,end,mat,steps=48):
    cx,cy=center
    verts=[]
    for i in range(steps+1):
        t=math.radians(start+(end-start)*i/steps)
        for z in (z0,z0+height):
            for r in (radius-thickness/2,radius+thickness/2):
                verts.append((cx+r*math.cos(t),cy+r*math.sin(t),z))
    faces=[]
    for i in range(steps):
        n=i*4;m=n+4
        faces.extend([(n,m,m+2,n+2),(n+1,n+3,m+3,m+1),(n+2,m+2,m+3,n+3),(n,n+1,m+1,m)])
    faces.extend([(0,2,3,1),(steps*4,steps*4+1,steps*4+3,steps*4+2)])
    o=mesh(name,verts,faces,mat)
    mod=o.modifiers.new("Plaster eased edges","BEVEL");mod.width=.04;mod.segments=2
    mod.angle_limit=.55
    apply_modifiers(o)
    # Smooth just the two continuous curved faces; cap/bevel normals stay crisp.
    for p in o.data.polygons:
        if abs(p.normal.z)<.2: p.use_smooth=True
    return o

def annulus(name, center, r0,r1,z0,height,mat,start=0,end=360,steps=96):
    cx,cy=center;verts=[];faces=[]
    for i in range(steps+1):
        a=math.radians(start+(end-start)*i/steps)
        for z in (z0,z0+height):
            for r in (r0,r1): verts.append((cx+math.cos(a)*r,cy+math.sin(a)*r,z))
    for i in range(steps):
        n=i*4;m=n+4
        faces.extend([(n+2,m+2,m+3,n+3),(n,n+1,m+1,m),(n,m,m+2,n+2),(n+1,n+3,m+3,m+1)])
    faces += [(0,2,3,1),(steps*4,steps*4+1,steps*4+3,steps*4+2)]
    return mesh(name,verts,faces,mat)

def line(name, pts, radius,mat,dest=WORLD):
    for i,(a,b) in enumerate(zip(pts,pts[1:])): segment(f"{name}_{i}",a,b,radius,mat,dest=dest)

def text(name,body,loc,size,mat,rotation=(math.pi/2,0,0),dest=WORLD):
    curve=bpy.data.curves.new(name,"FONT");curve.body=body;curve.size=size;curve.extrude=.0015;curve.bevel_depth=.0004
    curve.align_x="CENTER"
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=rotation
    assign(o,mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target="MESH");o.select_set(False)
    return own(o,dest)

def join(objects,name,dest=WORLD,origin=None):
    objects=[o for o in objects if o and o.name in bpy.data.objects and o.type=="MESH"]
    if not objects: return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    for o in objects:
        if o in dest:dest.remove(o)
    dest.append(obj)
    if origin:
        scene.cursor.location=origin;bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.select_set(False)
    return obj

def pot(x,y,z,scale=.7,tall=False):
    h=scale*(.65 if not tall else .92)
    cylinder("Planter ceramic",(x,y,z+h/2),scale*.32,h,"Ceramic cream",24,.012,top_radius=scale*.39)
    cylinder("Planter soil",(x,y,z+h+.002),scale*.345,.022,"Soil",20,0)
    leaf_fan(x,y,z+h,scale*1.05,tall)

def leaf_fan(x,y,z,size=1,tall=False):
    verts=[];faces=[]
    for i in range(11 if tall else 8):
        a=i*2.39996+R.random()*.25
        length=size*R.uniform(.62,1.2);spread=.25 if tall else .57
        w=size*.045
        origin=Vector((x,y,z));v=Vector((math.cos(a),math.sin(a),0));s=Vector((-math.sin(a),math.cos(a),0))
        points=[origin,origin+v*(length*spread*.45)+Vector((0,0,length*.6)),origin+v*(length*spread)+Vector((0,0,length*(1 if tall else .64)))]
        idx=len(verts)
        for j,p in enumerate(points):
            width=(.15 if j==0 else (1 if j==1 else .02))*w
            verts.extend([tuple(p+s*width),tuple(p-s*width)])
        faces.extend([(idx,idx+1,idx+3,idx+2),(idx+2,idx+3,idx+5,idx+4)])
    o=mesh("Leaf fan",verts,faces,"Garden olive dark",smooth=False)
    o.data.materials.append(MATS["Garden sage"])
    for p in o.data.polygons: p.material_index=1 if p.index%6==0 else 0

def foliage_cloud(name,clusters,leaf_count=700,scale=.11,origin=None):
    verts=[];faces=[];mi=[]
    for c,radius in clusters:
        c=Vector(c)
        count=int(leaf_count/max(1,len(clusters)))
        for j in range(count):
            az=R.random()*math.tau;u=R.uniform(-1,1);rad=radius*R.random()**.36
            p=c+Vector((math.cos(az)*math.sqrt(1-u*u),math.sin(az)*math.sqrt(1-u*u),u*.78))*rad
            theta=R.random()*math.tau
            length=scale*R.uniform(.6,1.45)
            direction=Vector((math.cos(theta),math.sin(theta),R.uniform(-.9,.9))).normalized()
            side=direction.cross(Vector((0,0,1))).normalized()
            if side.length<.01:side=Vector((1,0,0))
            n=side.cross(direction).normalized()
            start=len(verts)
            verts.extend([tuple(p-direction*length*.53),tuple(p+side*length*.34),tuple(p+n*length*.08),tuple(p-side*length*.34),tuple(p+direction*length*.53)])
            faces.extend([(start,start+1,start+2),(start,start+2,start+3),(start+1,start+4,start+2),(start+2,start+4,start+3)])
            mi.extend([R.choices([0,1,2,3],[.36,.3,.24,.1])[0]]*4)
    o=mesh(name,verts,faces,"Garden olive dark",uv=False)
    for mat in ("Garden sage","Garden olive light","Garden leaf deep"):o.data.materials.append(MATS[mat])
    for p,idx in zip(o.data.polygons,mi):p.material_index=idx
    if origin:
        scene.cursor.location=origin
        bpy.ops.object.select_all(action="DESELECT");o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.origin_set(type="ORIGIN_CURSOR");o.select_set(False)
    return o

def tree(name,x,y,h=3.6,crown=1.5,ambient=False):
    begin=len(WORLD)
    z=.05
    base=Vector((x,y,z));top=Vector((x+.15,y+.04,h*.74))
    segment(name+"_trunk",base,top,.12,"Bark",r2=.045,vertices=10)
    clusters=[]
    for i in range(11):
        a=i*2.4+R.uniform(-.3,.3)
        length=crown*R.uniform(.45,.92)
        start=base.lerp(top,R.uniform(.45,.83))
        end=Vector((x+math.cos(a)*length,y+math.sin(a)*length,h*R.uniform(.65,.94)))
        segment(name+"_branch",start,end,.044,"Bark",r2=.014,vertices=7)
        for j in range(2):
            twig=end+Vector((R.uniform(-.32,.32),R.uniform(-.32,.32),R.uniform(.12,.38)))
            segment(name+"_twig",start.lerp(end,.8),twig,.014,"Bark",r2=.006,vertices=5)
        clusters.append((end,crown*.38))
    canopy=foliage_cloud(name+"_canopy",clusters,leaf_count=2200 if not QUICK else 650,scale=.145,origin=(x,y,h*.52))
    if ambient:
        canopy.name="ambient_canopy_"+name
        AMBIENT.append(canopy.name)
    join([o for o in WORLD[begin:] if o is not canopy],name+"_wood",origin=(x,y,0))
    return canopy

def cypress(name,x,y,height):
    before=len(WORLD)
    segment(name+"_stem",(x,y,0),(x,y,height*.97),.055,"Bark",r2=.013)
    # Individual small leaf sprays form a tapered crown, without solid cones.
    clusters=[]
    tiers=14 if not QUICK else 9
    for level in range(tiers):
        fraction=level/tiers
        z=height*(.12+.83*fraction)
        radius=height*.105*(1-fraction)**.7+.028
        a=level*2.39996
        clusters.append(((x+math.cos(a)*radius*.18,y+math.sin(a)*radius*.18,z),radius))
    foliage_cloud(name+"_leaf_sprays",clusters,leaf_count=1450 if not QUICK else 450,scale=height*.023)
    join(WORLD[before:],name)

def shrub(x,y,r=.3):
    return foliage_cloud("Low planting",[((x,y,.10+r*.82),r)],leaf_count=180 if not QUICK else 52,scale=.103)

def grass(x,y,scale=.5):
    leaf_fan(x,y,.045,scale,False)

def rock(x,y,z=.06,size=.65):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+size*.32))
    o=bpy.context.object;o.name="Weathered limestone"
    for v in o.data.vertices:
        n=R.uniform(.85,1.15);v.co.x*=size*n;v.co.y*=size*.78*n;v.co.z*=size*.58*n
    assign(o,"Rock limestone")
    bevel=o.modifiers.new("Stone edge","BEVEL");bevel.width=.014;bevel.segments=1;apply_modifiers(o)
    return own(o)

def rail_arc(cx,cy,r,start,end,z=.58):
    angles=[math.radians(start+(end-start)*i/18) for i in range(19)]
    line("Guardrail top",[(cx+r*math.cos(a),cy+r*math.sin(a),z+.83) for a in angles],.024,"Dark steel")
    line("Guardrail middle",[(cx+r*math.cos(a),cy+r*math.sin(a),z+.44) for a in angles],.014,"Dark steel")
    for i in range(0,19,3):
        a=angles[i];segment("Guardrail upright",(cx+r*math.cos(a),cy+r*math.sin(a),z),(cx+r*math.cos(a),cy+r*math.sin(a),z+.85),.022,"Dark steel")

def books(x,y,z,width=1.4,depth=.25,count=13):
    cur=x-width/2
    choices=["Paper warm","Terracotta · specify","Sage · generate","Slate blue · validate","Olive · evolve beam","Oak endgrain"]
    for i in range(count):
        w=width/count*R.uniform(.56,1.04);h=R.uniform(.27,.46)
        cube("Book spine",(cur+w/2,y,z+h/2),(w,depth,h),R.choice(choices),.006)
        cube("Book label",(cur+w/2,y-depth/2-.002,z+h*.67),(w*.59,.005,.027),"Paper warm",.001)
        cur+=width/count

def shelving(cx,cy,floor,wide=1.35,tall=1.8,mat="Oak · furniture"):
    for x in (cx-wide/2,cx+wide/2):cube("Shelf side",(x,cy,floor+tall/2),(.075,.35,tall),mat,.014)
    cube("Shelf back",(cx,cy+.17,floor+tall/2),(wide,.04,tall),"Oak endgrain",.007)
    for row in range(5):
        z=floor+.06+row*(tall-.08)/4
        cube("Shelf",(cx,cy,z),(wide,.4,.045),mat,.01)
        if row<4:books(cx,cy-.025,z+.025,wide-.1,.24,12)

def desk(cx,cy,floor,mat="Oak · furniture",wide=2.0):
    h=floor+.84
    cube("Desk top",(cx,cy,h),(wide,.82,.1),mat,.035)
    for x in (cx-wide*.42,cx+wide*.42):
        for y in (cy-.29,cy+.29):cube("Desk leg",(x,y,floor+.39),(.075,.075,.78),mat,.012)
    cube("Desk stretcher",(cx,cy+.24,floor+.2),(wide*.85,.055,.06),mat,.01)
    return h+.06

def stool(x,y,floor,mat="Sage · generate"):
    cylinder("Stool padded seat",(x,y,floor+.56),.22,.075,mat,24,.016)
    for dx,dy in ((-.15,-.13),(.15,-.13),(-.15,.13),(.15,.13)):
        segment("Stool steel leg",(x+dx*1.26,y+dy*1.26,floor+.02),(x+dx,y+dy,floor+.53),.019,"Dark steel")
    annulus("Stool foot ring",(x,y),.18,.20,floor+.19,.018,"Dark steel",steps=24)

def lamp(x,y,z,shade="Sage · generate"):
    cylinder("Lamp weighted base",(x,y,z+.025),.13,.05,"Dark steel",24,.01)
    a=(x,y,z+.05);b=(x+.025,y+.04,z+.42);c=(x+.34,y-.03,z+.74)
    line("Task lamp joints",[a,b,c],.016,"Brushed brass")
    for p in (b,c):sphere("Lamp hinge",p,(.027,.027,.027),"Dark steel",segments=10,rings=6)
    hood=cylinder("Lamp shade",(x+.35,y-.035,z+.71),.14,.14,shade,24,.008,top_radius=.055)
    hood.rotation_euler[1]=-.4
    cylinder("Lamp pale diffuser",(x+.375,y-.035,z+.655),.10,.012,"Paper warm",20,0)

def keyboard(cx,cy,z,width=.64):
    cube("Keyboard tray",(cx,cy,z+.02),(width,.22,.034),"Dark steel",.016)
    for row in range(4):
        for col in range(11):cube("Keyboard key",(cx-width*.45+col*width*.085,cy-.07+row*.043,z+.045),(.039,.029,.006),"Paper warm",.002)

def monitor(x,y,z,width=1.2):
    cube("Monitor shell",(x,y,z+.49),(width,.07,.70),"Dark steel",.035)
    cube("Monitor screen",(x,y-.042,z+.49),(width-.075,.008,.60),"Charcoal screen",.01)
    cube("Monitor stand",(x,y,z+.10),(.065,.065,.26),"Dark steel",.01)
    cube("Monitor base",(x,y-.015,z+.012),(.43,.25,.035),"Dark steel",.014)
    # Actual geometry remains legible when zooming in; code is abstract, not a claimed quotation.
    for row in range(13):
        yy=y-.049;zz=z+.73-row*.038
        indent=(row%4)*.035
        for j in range(2 if row%3 else 3):
            left=x-width*.41+indent+j*.21
            w=R.uniform(.09,.20)
            cube("Abstract code line",(left+w/2,yy,zz),(w,.004,.008),["Display · code green","Display · code ochre","Display · code blue"][(row+j)%3],.0007)

def paper_diagram(x,y,z,width=.75,rotation=None):
    o=cube("Working paper",(x,y,z),(width,width*.67,.016),"Paper warm",.008,rot=rotation)
    # For horizontal pages place marks as a coherent diagram.
    if rotation is None:
        for dx,dy in ((-.18,.08),(.14,.08),(-.18,-.10),(.14,-.10)):
            cube("Diagram block",(x+dx*width,y+dy*width,z+.01),(width*.21,width*.12,.002),"Graphite ink",.001)
        line("Diagram connector",[(x-width*.05,y+width*.08,z+.011),(x+width*.12,y+width*.08,z+.011)],.002,"Graphite ink")
    return o

# --------------------- Architecture and authored walking surfaces ---------------------
def pavilion(pid,cx,cy,mat,kind):
    begin=len(WORLD);floor=.58;radius=2.53
    cylinder(pid+"_plinth",(cx,cy,floor/2),radius,floor,"Limestone · island",72,.04)
    cylinder(pid+"_floor",(cx,cy,floor+.02),radius-.055,.045,"Warm stone · paths",72,.02)
    if kind=="spec":
        cylinder("Terracotta inset floor",(cx,cy,floor+.049),2.10,.023,"Terracotta · specify",64,.016)
    # Split left return leaves a true architectural opening instead of an opaque full cylinder.
    arc_wall(pid+"_rear_wall",(cx,cy),2.13,.24,floor,3.02,8,150,mat,44)
    arc_wall(pid+"_left_return",(cx,cy),2.13,.24,floor,3.02,169,210,mat,16)
    # Left window lintel and sill, with open void beneath the top beam.
    arc_wall(pid+"_window_lintel",(cx,cy),2.13,.24,floor+2.5,.52,150,169,mat,8)
    arc_wall(pid+"_window_sill",(cx,cy),2.13,.24,floor,.6,150,169,mat,8)
    for a in (153,165):
        theta=math.radians(a)
        cube("Window oak mullion",(cx+2.13*math.cos(theta),cy+2.13*math.sin(theta),floor+1.55),(.055,.06,1.9),"Oak · furniture",.009)
    # Front porch and three treads, leaving a 1.35-m clear path.
    for i in range(3):
        h=(i+1)*floor/3
        cube(pid+"_step_"+str(i),(cx,cy-2.6+.28*i,h/2),(1.44,.76-.17*i,h),"Limestone · island",.028)
    rail_arc(cx,cy,radius-.08,216,252,floor)
    rail_arc(cx,cy,radius-.08,288,344,floor)
    # Deep opening, asymmetric beam and full-height side posts make a readable room.
    beam_mat="Olive · evolve beam" if kind=="evolve" else (mat if kind=="generate" else "Oak · furniture")
    cube("Portal overhead",(cx-.28,cy-.23,floor+2.91),(3.85,.19,.23),beam_mat,.035)
    cube("Portal side pier",(cx-1.94,cy-.27,floor+1.43),(.20,.23,2.86),beam_mat,.027)
    if kind=="evolve":
        # Pergola is open real geometry above a reading and architecture studio.
        for yy in (.33,1.07):cube("Pergola ridge",(cx,cy+yy,floor+3.0),(4.15,.17,.21),"Oak · furniture",.025)
        for xx in (-1.65,-.8,.05,.9,1.72):cube("Pergola rafter",(cx+xx,cy+.65,floor+3.12),(.12,2.52,.17),"Oak · furniture",.02)
    # Interior colour identities support the four themes without spelling a tutorial.
    if kind=="spec":
        h=desk(cx-.19,cy-.14,floor,wide=2.12)
        # Inclined drafting board and paper: rotate the whole authored assembly.
        board=cube("Drafting board",(cx-.2,cy-.14,h+.18),(1.60,.75,.065),"Oak · furniture",.018,rot=(math.radians(18),0,0))
        page=cube("Drawing sheet",(cx-.2,cy-.17,h+.217),(1.48,.66,.014),"Paper warm",.004,rot=(math.radians(18),0,0))
        for dx,dy in ((-.50,.15),(.05,.15),(.45,.15),(-.50,-.18),(.05,-.18),(.45,-.18)):
            q=(cx-.2+dx,cy-.17+dy*math.cos(math.radians(18)),h+.232+dy*math.sin(math.radians(18)))
            cube("Draft schematic box",q,(.26,.16,.004),"Graphite ink",.002,rot=(math.radians(18),0,0))
            cube("Draft inset",(q[0],q[1]-.002,q[2]+.003),(.23,.135,.003),"Paper warm",.001,rot=(math.radians(18),0,0))
        lamp(cx-.90,cy+.20,h,"Terracotta · specify")
        stool(cx+.45,cy-1.10,floor)
        shelving(cx+.87,cy+1.14,floor,wide=1.35,tall=1.25)
        # Pinned specifications: diagrams, criteria and annotations are individually modelled.
        cube("Specification board oak",(cx-.34,cy+1.64,floor+1.77),(2.36,.06,1.31),"Oak endgrain",.018)
        for col in range(3):
            for row in range(2):
                px=cx-.99+col*.64;pz=floor+1.46+row*.59
                cube("Pinned sketch",(px,cy+1.601,pz),(.58,.009,.48),"Paper warm",.005)
                for j in range(4):cube("Sketch notation",(px,cy+1.593,pz-.13+j*.07),(.37-j*.04,.004,.007),"Graphite ink",.0005)
                cylinder("Brass pin",(px,cy+1.584,pz+.20),.012,.018,"Brushed brass",10,0).rotation_euler[0]=math.pi/2
        pot(cx+1.66,cy+.33,floor,.85,True)
        pot(cx-1.60,cy+.07,floor,.55)
    elif kind=="generate":
        h=desk(cx+.10,cy+.02,floor,mat="Sage · generate",wide=2.28)
        cube("Stone desktop",(cx+.10,cy+.02,h-.015),(2.27,.80,.055),"Limestone · island",.025)
        monitor(cx+.12,cy+.18,h,1.4)
        keyboard(cx+.12,cy-.25,h)
        sphere("Computer mouse",(cx+.80,cy-.28,h+.04),(.064,.088,.027),"Ceramic cream",segments=12,rings=6)
        cube("Workstation tower",(cx+1.03,cy+.18,floor+.36),(.29,.48,.67),"Sage · generate",.025)
        for z in (.15,.19,.23,.27):cube("Tower grille",(cx+1.03,cy-.067,floor+z),(.21,.004,.007),"Dark steel",.001)
        stool(cx+.11,cy-1.06,floor,"Ceramic cream")
        # Stacked modules indicate generated artefacts, with worked, bevelled surfaces.
        for i,(x,y,z) in enumerate([(-1.4,.15,.24),(-1.45,.7,.22),(-1.28,.20,.69),(-1.42,.65,1.14),(-.97,.96,.22),(-.82,.81,.65)]):
            cube("Modular artefact",(cx+x,cy+y,floor+z),(.52,.47,.43),"Sage · generate" if i%2 else "Limestone · island",.045)
            cube("Artefact brass tab",(cx+x,cy+y-.24,floor+z),(.035,.006,.075),"Brushed brass",.003)
        pot(cx-1.35,cy+.75,floor+1.48,.5)
        lamp(cx+.94,cy+.26,h,"Ceramic cream")
        pot(cx+1.58,cy+.76,floor,.58)
        cube("Generate wall plaque",(cx+.57,cy+1.66,floor+2.06),(1.55,.055,.35),"Sage · generate",.02)
        text("Generate studio mark","IDEIAS EM SOFTWARE",(cx+.57,cy+1.621,floor+2.04),.103,"Paper warm")
    elif kind=="validate":
        h=desk(cx-.1,cy-.08,floor,mat="Slate blue · validate",wide=2.43)
        cube("Validation worktop",(cx-.10,cy-.08,h-.012),(2.4,.84,.045),"Limestone · island",.022)
        lamp(cx-.97,cy+.15,h,"Sage · generate")
        paper_diagram(cx-.20,cy-.07,h+.02,.7)
        cube("Open notebook page",(cx+.42,cy+.04,h+.18),(.49,.05,.38),"Paper warm",.016,rot=(math.radians(18),0,0))
        cube("Notebook leather hinge",(cx+.16,cy+.04,h+.18),(.023,.055,.38),"Oak endgrain",.005,rot=(math.radians(18),0,0))
        for i in range(5):cube("Notebook notes",(cx+.42,cy-.005,h+.06+i*.046),(.34,.006,.006),"Graphite ink",.0006)
        stool(cx-.35,cy-1.08,floor,"Ceramic cream")
        cube("Validation cabinet",(cx+1.33,cy+.15,floor+.48),(.64,.58,.95),"Slate blue · validate",.035)
        for i in range(3):
            cube("Drawer front",(cx+1.33,cy-.159,floor+.18+i*.28),(.55,.024,.22),"Slate blue · validate",.01)
            cube("Drawer brass pull",(cx+1.33,cy-.187,floor+.18+i*.28),(.16,.025,.023),"Brushed brass",.004)
        pot(cx+1.35,cy+.14,floor+.98,.45)
        for i in range(2):
            xx=cx-.65+i*1.10
            cube("Validation frame",(xx,cy+1.55,floor+1.96),(.90,.058,.87),"Oak · furniture",.017)
            cube("Validation display paper",(xx,cy+1.509,floor+1.96),(.79,.011,.76),"Paper warm",.006)
            if i==1:
                line("Human review check",[(xx-.21,cy+1.497,floor+1.95),(xx-.06,cy+1.497,floor+1.79),(xx+.23,cy+1.497,floor+2.14)],.027,"Sage · generate")
            else:
                for j in range(4):cube("Review note",(xx,cy+1.497,floor+1.72+j*.14),(.55,.005,.008),"Graphite ink",.001)
        pot(cx-1.60,cy+.61,floor,.52)
    else:
        h=desk(cx-.30,cy-.47,floor,wide=2.23)
        # A small real scale maquette of architecture and greenery, rather than coloured cubes.
        cube("Architecture maquette base",(cx-.3,cy-.44,h+.016),(1.45,.54,.035),"Paper warm",.011)
        for xx in (-.55,.0,.46):
            cube("Maquette slab",(cx-.3+xx,cy-.41,h+.16),(.29,.28,.23),"Sand · evolve",.025)
            cube("Maquette lintel",(cx-.3+xx,cy-.41,h+.30),(.34,.3,.04),"Oak · furniture",.01)
        pot(cx+.59,cy-.38,h,.24)
        cube("Studio drawer unit",(cx+.34,cy-.48,floor+.39),(.70,.60,.76),"Oak · furniture",.025)
        for zz in (.19,.46,.66):cube("Drawer carved pull",(cx+.34,cy-.79,floor+zz),(.20,.018,.02),"Oak endgrain",.004)
        shelving(cx+.85,cy+1.06,floor,wide=1.36,tall=2.16)
        shelving(cx-1.25,cy+.70,floor,wide=.68,tall=1.69)
        # Architectural drawing on an easel.
        for xx in (-.38,.38):segment("Easel leg",(cx+xx,cy+.41,floor),(cx+xx*.65,cy+.60,floor+1.8),.028,"Oak · furniture")
        cube("Easel paper",(cx,cy+.43,floor+1.58),(.74,.035,1.08),"Paper warm",.015)
        line("Decision tree sketch",[(cx,cy+.404,floor+1.14),(cx,cy+.404,floor+1.95)],.003,"Graphite ink")
        for i in range(6):
            zz=floor+1.24+i*.10;side=1 if i%2 else -1
            line("Architecture sketch branch",[(cx,cy+.403,zz),(cx+side*.20,cy+.403,zz+.11)],.003,"Graphite ink")
        pot(cx+1.78,cy-.30,floor,.78,True)
        pot(cx-1.64,cy-.47,floor,.63)
        stool(cx-.72,cy-1.24,floor,"Olive · evolve beam")
        # Leaning ladder and a small storage case add the inhabited-study character.
        for xx in (cx+1.8,cx+2.15):segment("Library ladder",(xx,cy+.86,floor),(xx-.18,cy+1.35,floor+2.7),.027,"Oak · furniture")
        for i in range(7):segment("Ladder rung",(cx+1.79-.18*i/7,cy+.87+.49*i/7,floor+.15+i*.34),(cx+2.15-.18*i/7,cy+.87+.49*i/7,floor+.15+i*.34),.023,"Oak · furniture")
    # Small porch marker is readable in close view, without baking web UI into the model.
    cube("Studio porch marker",(cx-1.20,cy-1.83,floor+.14),(.46,.07,.28),"Limestone · island",.025)
    text("Studio number",{"spec":"01","generate":"02","validate":"03","evolve":"04"}[kind],(cx-1.20,cy-1.875,floor+.08),.14,"Graphite ink")
    obj=join(WORLD[begin:],"pavilion_"+pid,origin=(cx,cy,0))
    PAVILIONS[pid]={"x":cx,"y":cy,"floor":floor,"object":obj}

ISLAND_LAYOUT = [
    ("especificar",-5.05,4.70,"Terracotta · specify","spec",0),
    ("gerar",5.05,4.70,"Sage · generate","generate",1),
    ("validar",-5.05,-4.70,"Slate blue · validate","validate",2),
    ("evoluir",5.05,-4.70,"Sand · evolve","evolve",3),
]

def island_foundation(pid,cx,cy,index):
    """An irregular stratified rock island with a masonry terrace, never a disk shared by rooms."""
    before=len(WORLD)
    steps=80
    rings=[(1,.035),(.995,-.16),(.94,-.48),(.81,-.98),(.62,-1.62),(.33,-2.03)]
    verts=[];faces=[]
    for ring,(scale,z) in enumerate(rings):
        for i in range(steps):
            a=i*math.tau/steps
            radius=3.57*(1+.04*math.sin(a*3+index)+.025*math.cos(a*5+index*.8))
            # Quiet terraces above, weathered strata and asymmetrical roots below.
            rough=0 if ring<2 else .08*math.sin(a*7+ring*1.8+index)
            verts.append((cx+math.cos(a)*radius*scale,cy+math.sin(a)*radius*scale*.96,z+rough))
    faces.append(tuple(range(steps)))
    for ring in range(len(rings)-1):
        for i in range(steps):
            j=(i+1)%steps
            faces.append((ring*steps+i,(ring+1)*steps+i,(ring+1)*steps+j,ring*steps+j))
    faces.append(tuple((len(rings)-1)*steps+i for i in range(steps-1,-1,-1)))
    obj=mesh(pid+"_stratified_cliff",verts,faces,"Rock limestone")
    obj.data.materials.append(MATS["Limestone · island"])
    obj.data.materials.append(MATS["Warm stone · paths"])
    for polygon in obj.data.polygons:
        polygon.material_index=2 if polygon.index==0 else (1 if polygon.index<=steps+1 else 0)
    # The rim is worked limestone around a natural footprint. Each joint is real geometry.
    for i in range(40):
        a=i*math.tau/40
        radius=3.57*(1+.04*math.sin(a*3+index)+.025*math.cos(a*5+index*.8))
        line(pid+" stone edge joint",[(cx+math.cos(a)*(radius-.14),cy+math.sin(a)*(radius-.14)*.96,.041),(cx+math.cos(a)*radius,cy+math.sin(a)*radius*.96,.041)],.002,"Oak endgrain")
    join(WORLD[before:],"island_"+pid+"_foundation",origin=(cx,cy,0))

for pid,cx,cy,mat,kind,index in ISLAND_LAYOUT:
    island_foundation(pid,cx,cy,index)
    pavilion(pid,cx,cy,mat,kind)
    before=len(WORLD)
    annulus(pid+"_garden_bed",(cx,cy),2.65,3.22,.04,.02,"Soil",start=-15,end=225,steps=56)
    for i in range(32):
        a=math.radians(-10+i*7.0);rad=R.uniform(2.74,3.18)
        xx=cx+math.cos(a)*rad;yy=cy+math.sin(a)*rad
        shrub(xx,yy,R.uniform(.20,.31))
        if i%2==0:grass(xx+.1,yy-.08,.35)
        if i%4==0:
            # Small five-petal blossoms share a material for seasonal visibility.
            for petal in range(5):
                pa=petal*math.tau/5
                sphere("seasonal_blossom_"+pid,(xx+math.cos(pa)*.057,yy+math.sin(pa)*.057,.32),(.05,.025,.018),"Flower blue" if index%2 else "Flower ivory",segments=6,rings=4)
    for side in (-1,1):
        for i in range(4):shrub(cx+side*(1.45+i*.18),cy-2.50-i*.04,.19)
    rock(cx-2.72,cy-.65,.05,.44)
    rock(cx+2.86,cy+.22,.05,.34)
    join(WORLD[before:],"island_"+pid+"_groundcover",origin=(cx,cy,0))
    # Branches and thousands of individual leaves keep the real authored vegetation.
    side=-1 if index%2==0 else 1
    tree(pid+"_garden_tree",cx+side*2.55,cy+1.22,3.28+index*.16,.85,ambient=True)
    cypress("cypress_"+pid,cx-side*2.68,cy+.94,2.38+index*.14)
    before=len(WORLD)
    # A small terrace at the entrance remains on its own island; there are no cross-island paths.
    for xx in (-.52,0,.52):line("Entrance paving joint",[(cx+xx,cy-3.22,.042),(cx+xx,cy-2.73,.042)],.002,"Limestone · island")
    join(WORLD[before:],"island_"+pid+"_porch_joints")

# The visitor asset stays preserved as an original source, but v6 visitation is direct.

# --------------------- Rigged visitor, neutral clothes, root on the floor ---------------------
def avatar_geometry():
    bone_parts={}
    def part(bone,obj):bone_parts.setdefault(bone,[]).append(obj);return obj
    part("hips",sphere("Visitor pelvis",(0,0,.93),(.18,.12,.14),"Visitor trousers",AVATAR,18,10))
    part("spine",sphere("Visitor shirt torso",(0,0,1.22),(.23,.135,.30),"Visitor shirt",AVATAR,20,12))
    part("spine",cube("Shirt hem",(0,0,1.02),(.36,.235,.07),"Visitor shirt",.03,AVATAR))
    part("spine",segment("Visitor neck",(0,0,1.45),(0,0,1.55),.067,"Visitor skin",dest=AVATAR,vertices=14))
    part("head",sphere("Visitor head",(0,-.002,1.66),(.105,.09,.135),"Visitor skin",AVATAR,20,12))
    # Hair cap is an ellipsoid over the scalp, cut visually by the face underneath.
    part("head",sphere("Visitor hair cap",(0,.018,1.73),(.11,.092,.070),"Visitor hair",AVATAR,18,10))
    part("head",sphere("Visitor nose",(0,-.093,1.655),(.020,.022,.030),"Visitor skin",AVATAR,10,7))
    for side in (-1,1):
        part("head",sphere("Visitor ear",(side*.106,0,1.65),(.018,.021,.031),"Visitor skin",AVATAR,10,6))
        part("head",sphere("Visitor eye",(side*.037,-.082,1.684),(.005,.004,.005),"Visitor hair",AVATAR,8,5))
        name="L" if side==1 else "R"
        hip=(side*.112,0,.94);knee=(side*.115,-.003,.52);ankle=(side*.115,0,.10)
        part("upper_leg_"+name,segment("Trouser upper leg",hip,knee,.086,"Visitor trousers",r2=.067,dest=AVATAR,vertices=16))
        part("lower_leg_"+name,segment("Trouser lower leg",knee,ankle,.064,"Visitor trousers",r2=.046,dest=AVATAR,vertices=16))
        part("lower_leg_"+name,sphere("Trouser knee",knee,(.068,.067,.075),"Visitor trousers",AVATAR,14,8))
        part("foot_"+name,cube("Visitor shoe",(side*.115,-.067,.052),(.118,.247,.10),"Visitor shoes",.035,AVATAR))
        part("foot_"+name,cube("Shoe sole",(side*.115,-.066,.018),(.124,.25,.028),"Visitor hair",.008,AVATAR))
        shoulder=(side*.215,0,1.41);elbow=(side*.275,.014,1.16);wrist=(side*.27,-.012,.94)
        part("upper_arm_"+name,segment("Shirt upper arm",shoulder,elbow,.072,"Visitor shirt",r2=.057,dest=AVATAR,vertices=16))
        part("lower_arm_"+name,segment("Bare forearm",elbow,wrist,.045,"Visitor skin",r2=.034,dest=AVATAR,vertices=14))
        part("lower_arm_"+name,sphere("Visitor hand",(side*.27,-.013,.91),(.038,.032,.062),"Visitor skin",AVATAR,12,8))
        # Cloth straps sit over each shoulder and have explicit geometry.
        part("spine",cube("Backpack front strap",(side*.12,-.119,1.25),(.035,.021,.36),"Visitor backpack",.009,AVATAR,rot=(0,side*.1,side*.10)))
        part("spine",segment("Backpack shoulder strap",(side*.12,-.11,1.43),(side*.12,.15,1.45),.022,"Visitor backpack",dest=AVATAR,vertices=10))
    part("spine",cube("Backpack main pack",(0,.19,1.25),(.295,.16,.39),"Visitor backpack",.055,AVATAR))
    part("spine",cube("Backpack front pocket",(0,.286,1.18),(.255,.06,.19),"Visitor trousers",.033,AVATAR))
    part("spine",cube("Backpack zipper",(0,.318,1.255),(.21,.005,.007),"Brushed brass",.002,AVATAR))
    return bone_parts

parts=avatar_geometry()
arm_data=bpy.data.armatures.new("Visitor skeleton")
arm=bpy.data.objects.new("AvatarRig",arm_data);scene.collection.objects.link(arm);AVATAR.append(arm)
bpy.ops.object.select_all(action="DESELECT");arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode="EDIT")
bone_specs=[
    ("root",(0,0,0),(0,0,.20),None),
    ("hips",(0,0,.91),(0,0,1.04),"root"),
    ("spine",(0,0,1.04),(0,0,1.45),"hips"),
    ("head",(0,0,1.45),(0,0,1.79),"spine"),
]
for side in (-1,1):
    n="L" if side==1 else "R"
    bone_specs.extend([
        ("upper_leg_"+n,(side*.112,0,.94),(side*.115,-.003,.52),"hips"),
        ("lower_leg_"+n,(side*.115,-.003,.52),(side*.115,0,.10),"upper_leg_"+n),
        ("foot_"+n,(side*.115,0,.10),(side*.115,-.15,.06),"lower_leg_"+n),
        ("upper_arm_"+n,(side*.215,0,1.41),(side*.275,.014,1.16),"spine"),
        ("lower_arm_"+n,(side*.275,.014,1.16),(side*.27,-.012,.94),"upper_arm_"+n),
    ])
for name,head,tail,parent in bone_specs:
    b=arm_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT");arm.select_set(False)
for bone,objects in parts.items():
    for obj in objects:
        group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,"REPLACE")
avatar_mesh=join([o for o in AVATAR if o.type=="MESH"],"Visitor",AVATAR,origin=(0,0,0))
avatar_mesh.parent=arm
mod=avatar_mesh.modifiers.new("Visitor skinning","ARMATURE");mod.object=arm
for b in arm.pose.bones:b.rotation_mode="XYZ"
arm.animation_data_create()

def reset_pose():
    for b in arm.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)

def make_action(name,start,end,walk=False):
    action=bpy.data.actions.new(name)
    arm.animation_data.action=action
    for f in range(start,end+1,3):
        reset_pose();phase=(f-start)/(end-start)*math.tau
        if walk:
            swing=math.sin(phase)
            arm.pose.bones["hips"].location.y=.014*(1-math.cos(phase*2))
            arm.pose.bones["spine"].rotation_euler[1]=swing*.045
            for n,sign in (("L",1),("R",-1)):
                s=swing*sign
                arm.pose.bones["upper_leg_"+n].rotation_euler[0]=s*.40
                arm.pose.bones["lower_leg_"+n].rotation_euler[0]=max(0,-s)*.52
                arm.pose.bones["foot_"+n].rotation_euler[0]=-s*.13
                arm.pose.bones["upper_arm_"+n].rotation_euler[0]=-s*.29
                arm.pose.bones["lower_arm_"+n].rotation_euler[0]=-.08-max(0,s)*.16
        else:
            arm.pose.bones["spine"].rotation_euler[0]=math.sin(phase)*.008
            arm.pose.bones["head"].rotation_euler[2]=math.sin(phase)*.022
            arm.pose.bones["upper_arm_L"].rotation_euler[0]=math.sin(phase)*.012
            arm.pose.bones["upper_arm_R"].rotation_euler[0]=-math.sin(phase)*.012
        for b in arm.pose.bones:
            b.keyframe_insert(data_path="rotation_euler",frame=f,group=b.name)
            b.keyframe_insert(data_path="location",frame=f,group=b.name)
    arm.animation_data.action=None
    track=arm.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,start,action);strip.name=name
    return action

make_action("Idle",1,49,False)
make_action("Walk",61,85,True)
reset_pose();scene.frame_set(1)

# --------------------- Camera, light and frozen manifest ---------------------
CAM_WORLD=[3.3,19.5,28]
TARGET_WORLD=[0,.25,0]
CAM_FOV=34
def to_blender(v):return Vector((v[0],-v[2],v[1]))
def to_world(v):return [round(v[0],5),round(v[2],5),round(-v[1],5)]
cam_data=bpy.data.cameras.new("Island overview camera");cam_data.type="PERSP"
# Three.js uses a vertical FOV. Force the same fit/lens in the Blender poster.
cam_data.sensor_fit="VERTICAL"
cam_data.lens=cam_data.sensor_height/(2*math.tan(math.radians(CAM_FOV)/2))
camera=bpy.data.objects.new("Island overview camera",cam_data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=to_blender(CAM_WORLD);camera.rotation_euler=(to_blender(TARGET_WORLD)-camera.location).to_track_quat("-Z","Y").to_euler()
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.view_settings.exposure=.3
scene.view_settings.gamma=1

def area(name,loc,energy,size,hexval):
    data=bpy.data.lights.new(name,"AREA");data.energy=energy;data.shape="DISK";data.size=size;data.color=color(hexval)
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat("-Z","Y").to_euler()
area("Soft solar key",(-11,-10,18),2400,9,"FFF0D2")
area("Sky broad fill",(8,-3,13),1200,12,"E0E9E5")
sun_data=bpy.data.lights.new("Sun late morning","SUN");sun_data.energy=1.65;sun_data.angle=math.radians(18);sun_data.color=color("FFF1D9")
sun=bpy.data.objects.new("Sun late morning",sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.45,-.4,-.35)

# The poster-only plane catches the same scene's real shadows; excluded from GLBs.
ground=cube("Poster shadow ground",(0,0,-2.65),(200,200,.06),"Poster warm backdrop",0,dest=[])

navigation_nodes={"spawn":{"position":[0,.04,7.4]}}
edges=[]
destinations={};pavilion_data={}
for pid,p in PAVILIONS.items():
    cx,cy=p["x"],p["y"]
    coordinates={"entry":[cx,.62,-cy+1.78]}
    navigation_nodes[pid+"_entry"]={"position":coordinates["entry"]}
    # These compatibility edges represent direct selection, never pedestrian paths.
    edges.append(["spawn",pid+"_entry"])
    destinations[pid]=pid+"_entry"
    focus=[cx,3.7,-cy-.05]
    projected=world_to_camera_view(scene,camera,to_blender(focus))
    pavilion_data[pid]={
        "entry":coordinates["entry"],"focus":focus,"hitNode":"pavilion_"+pid,
        "camera":{"position":[cx+4.7,6.0,-cy+9.8],"target":[cx,1.25,-cy],"fov":42},
        "posterPoint":[round(projected.x,5),round(1-projected.y,5)],
    }

manifest={"schemaVersion":1,"units":"meters","upAxis":"Y",
    "assets":{"world":"/experience/world/archipelago-v6.glb","worldLow":"/experience/world/archipelago-v6-low.glb","avatar":"/experience/world/avatar.glb","poster":"/experience/world/poster-v6.webp"},
    "initialCamera":{"position":CAM_WORLD,"target":TARGET_WORLD,"fov":CAM_FOV},
    "movingCamera":{"offset":[4.5,5.6,8.2],"targetOffset":[0,1.1,0],"damping":.095,"azimuthLock":True},
    "spawn":[0,.04,7.4],"pavilions":pavilion_data,
    "navigation":{"mode":"direct","nodes":navigation_nodes,"edges":edges,"destinations":destinations},
    "islands":{pid:{"center":[cx,0,-cy],"radius":3.8,"foundationNode":"island_"+pid+"_foundation"} for pid,cx,cy,mat,kind,index in ISLAND_LAYOUT},
    "weatherScenery":{"lightningTargets":[[-15.2,3.42,-5.8],[15.7,2.58,-9.8],[3.6,.2,-19.3]]},
    "avatar":{"speed":1.6,"scale":1},"ambientNodes":AMBIENT}
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")

# --------------------- Export invariant assets, keep editable sources ---------------------
def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]

for o in WORLD:
    if o.type=="MESH":o.data.validate(verbose=False);o.data.update()
common=dict(export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format="JPEG",export_jpeg_quality=86,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
select_only([o for o in WORLD if o.name in bpy.data.objects])
bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v6.glb"),**common)
print("WORLD_EXPORTED",(OUT/"archipelago-v6.glb").stat().st_size,flush=True)

# Preserve the original archived visitor byte-for-byte. A clean asset rebuild
# can still reproduce its rig, although v6 never requests it at runtime.
if not (OUT/"avatar.glb").exists():
    select_only(AVATAR)
    avatar_common=common.copy();avatar_common.update(export_draco_mesh_compression_enable=False,export_animations=True,export_apply=False,export_animation_mode="NLA_TRACKS",export_nla_strips=True,export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/"avatar.glb"),**avatar_common)
print("AVATAR_PRESERVED",(OUT/"avatar.glb").stat().st_size,flush=True)

# Retain the high-detail source before making the derivative low asset.
arm.location=(0,-7.4,.04)
arm.rotation_euler[2]=math.pi
bpy.ops.file.pack_all()
arm.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v6.blend"))

# Low mesh uses the same objects, footprints, hit names and material colors.
# Decimating preserves authored navigation and each building's silhouette.
original_meshes={}
for o in WORLD:
    if o.name not in bpy.data.objects or o.type!="MESH":continue
    original_meshes[o.name]=o.data
    o.data=o.data.copy()
    if len(o.data.polygons)>100:
        modifier=o.modifiers.new("Low device simplification","DECIMATE")
        modifier.ratio=.18 if "canopy" in o.name or "groundcover" in o.name else (.26 if "cypress" in o.name else .46)
        modifier.use_collapse_triangulate=True
        apply_modifiers(o)
        o.data.validate(verbose=False);o.data.update()
select_only([o for o in WORLD if o.name in bpy.data.objects])
bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v6-low.glb"),**common)
print("LOW_EXPORTED",(OUT/"archipelago-v6-low.glb").stat().st_size,flush=True)
for name,data in original_meshes.items():bpy.data.objects[name].data=data

stats={"worldBytes":(OUT/"archipelago-v6.glb").stat().st_size,"lowBytes":(OUT/"archipelago-v6-low.glb").stat().st_size,"avatarBytes":(OUT/"avatar.glb").stat().st_size,"worldMeshes":len(WORLD),"worldPolygons":sum(len(o.data.polygons) for o in WORLD if o.type=="MESH"),"blender":bpy.app.version_string,"camera":manifest["initialCamera"],"render":"pending","islands":4,"navigation":"direct","source":"assets/world/archipelago-v6.blend"}
(SOURCE/"build-report-v6.json").write_text(json.dumps(stats,indent=2),encoding="utf-8")
if not SKIP_RENDER:
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=24 if QUICK else 48
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=5
    scene.render.filepath=str(SOURCE/"poster-v6-render.png")
    bpy.ops.render.render(write_still=True)
    stats["render"]="cycles CPU / same archipelago-v6.blend scene"
    (SOURCE/"build-report-v6.json").write_text(json.dumps(stats,indent=2),encoding="utf-8")
print("BUILD_COMPLETE",json.dumps(stats),flush=True)
