"""Author the seven-island v7 garden archipelago in Blender 4.5 LTS.

The v6 model, exports and poster remain preserved. Shared modelling helpers and
the local CC0 texture palette are reused from build_world.py; no network assets,
avatar, addon or web runtime are required. All public images are real renders.

blender --background --factory-startup --python scripts/world/build_world_v7.py -- --skip-render
"""
from pathlib import Path
import json, math, random, sys, hashlib
import bpy
import bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HELPER = Path(__file__).with_name("build_world.py")
base_source = HELPER.read_text(encoding="utf-8")
prelude = base_source[:base_source.index("# --------------------- Architecture and authored walking surfaces")]
exec(compile(prelude, str(HELPER), "exec"), globals())
original_pavilion = base_source[base_source.index("def pavilion("):base_source.index("ISLAND_LAYOUT =")]
original_pavilion = original_pavilion.replace('{"spec":"01","generate":"02","validate":"03","evolve":"04"}', '{"spec":"05","generate":"02","validate":"04","evolve":"06"}')
exec(compile(original_pavilion, str(HELPER), "exec"), globals())
v6_pavilion = pavilion
R = random.Random(73173)
WORLD.clear(); AVATAR.clear(); AMBIENT.clear(); PAVILIONS.clear()
QUICK = False
IDS = ("pesquisa", "gerar", "comparar", "validar", "especificar", "evoluir", "perspectivas")
ISLAND_LAYOUT = [
    ("pesquisa", -9.6, 9.4, 0),
    ("gerar", 0.0, 9.8, 1),
    ("comparar", 9.6, 9.4, 2),
    ("validar", -9.6, 0.0, 3),
    ("especificar", 0.0, .15, 4),
    ("evoluir", 9.6, 0.0, 5),
    ("perspectivas", 0.0, -9.7, 6),
]
FOLIAGE_PALETTE = {
    "Garden olive dark": "467446", "Garden sage": "668B50",
    "Garden olive light": "86A559", "Garden leaf deep": "244E35",
    "Garden dry tip": "C2AF77", "Flower ivory": "F3E2BC", "Flower blue": "A4B2D0",
}
for name, hexval in {**FOLIAGE_PALETTE, "Bark": "66523B", "Rock limestone": "B1A58B", "Soil": "554E35"}.items():
    mat = MATS[name]
    mat.diffuse_color = (*color(hexval), 1)
    mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*color(hexval), 1)
material("Limestone stratum pale", "D2C2A3", rough=.94)
material("Limestone stratum deep", "8F826D", rough=.98)
material("Meadow moss", "81865B", rough=1)
material("Bark ridge", "8F7752", rough=.94)
material("Porcelain laboratory", "D8DFCD", rough=.76)
material("Teal laboratory", "537F7B", rough=.7)
material("Observatory bronze", "7E8061", rough=.48, metal=.55)
material("Lantern glass", "D7E7CC", rough=.21)
material("Beacon ivory", "FFF1BF", rough=.35)
MATS["Beacon ivory"].node_tree.nodes.get("Principled BSDF").inputs["Emission Color"].default_value=(*color("FFF1BF"),1)
MATS["Beacon ivory"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=.25

def vertex_colors(obj, values=None):
    """Exported COLOR_0 carries gentle cavity/organic variation into both LODs."""
    if obj.type != "MESH": return
    layer = obj.data.color_attributes.get("Col")
    new_layer=layer is None
    if layer is None: layer = obj.data.color_attributes.new(name="Col",type="BYTE_COLOR",domain="CORNER")
    obj.data.color_attributes.active_color=layer
    obj.data.color_attributes.render_color_index=obj.data.color_attributes.find("Col")
    for face in obj.data.polygons:
        normal = (obj.matrix_world.to_3x3() @ face.normal).normalized()
        height = sum((obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co).z for li in face.loop_indices)/len(face.loop_indices)
        shade = .86 + .13*max(0,normal.z) - .07*max(0,-normal.z)
        if "foundation" in obj.name:
            shade = (.67+.25*max(0,min(1,(height+2.6)/2.6))) * (.93+.07*max(0,normal.z))
        if values is not None: shade = values[face.index]
        for li in face.loop_indices:
            if new_layer or values is not None or layer.data[li].color[3]<.1:
                layer.data[li].color=(shade,shade,shade,1)

def link_vertex_materials():
    for mat in MATS.values():
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        base=bsdf.inputs["Base Color"]
        previous=base.links[0].from_socket if base.links else None
        constant=base.default_value[:]
        for link in list(base.links): mat.node_tree.links.remove(link)
        vertex=mat.node_tree.nodes.new("ShaderNodeVertexColor");vertex.layer_name="Col"
        multiply=mat.node_tree.nodes.new("ShaderNodeMix");multiply.data_type="RGBA";multiply.blend_type="MULTIPLY";multiply.inputs[0].default_value=1
        multiply.inputs[6].default_value=constant
        if previous:mat.node_tree.links.new(previous,multiply.inputs[6])
        mat.node_tree.links.new(vertex.outputs["Color"],multiply.inputs[7])
        mat.node_tree.links.new(multiply.outputs[2],base)

def clump(name, center, radius, mat, elongation=(1,1,.8)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=8,radius=1,location=center)
    obj=bpy.context.object;obj.name=name
    for vertex in obj.data.vertices:
        n=vertex.co.normalized()
        irregular=1+.085*math.sin(n.x*8+n.y*4)+.055*math.cos(n.z*13+n.x*5)
        vertex.co=Vector((n.x*radius*elongation[0],n.y*radius*elongation[1],n.z*radius*elongation[2]))*irregular
    obj.data.update()
    assign(obj,mat)
    for face in obj.data.polygons:face.use_smooth=True
    own(obj)
    layer=obj.data.color_attributes.new(name="Col",type="BYTE_COLOR",domain="CORNER")
    obj.data.color_attributes.active_color=layer;obj.data.color_attributes.render_color_index=obj.data.color_attributes.find("Col")
    for face in obj.data.polygons:
        for li in face.loop_indices:
            vertex=obj.data.vertices[obj.data.loops[li].vertex_index]
            shade=.77+.21*max(0,min(1,(vertex.co.z+radius*elongation[2])/(2*radius*elongation[2])))
            layer.data[li].color=(shade,shade,shade,1)
    return obj

def foliage_cloud(name,clusters,leaf_count=700,scale=.14,origin=None,cores=True):
    """Closed sculpted crown volumes plus whole, ridged leaves at the surface.

    The solid leaf masses retain silhouette and shade at low detail. Leaves are
    distributed per cluster; LOD removes complete leaves evenly, never drawRange.
    """
    begin=len(WORLD)
    if cores:
        for ci,(center,radius) in enumerate(clusters):
            clump(name+"_core",center,radius*.87,"Garden olive dark" if ci%3 else "Garden sage")
    verts=[];faces=[];indices=[];shades=[];leaf_ids=[]
    for ci,(center,radius) in enumerate(clusters):
        center=Vector(center)
        count=max(8,int(leaf_count/max(1,len(clusters))))
        for j in range(count):
            az=R.random()*math.tau;u=R.uniform(-.93,1)
            rad=radius*R.uniform(.76,1.13)
            n=Vector((math.cos(az)*math.sqrt(1-u*u),math.sin(az)*math.sqrt(1-u*u),u*.80))
            point=center+n*rad
            theta=az+R.uniform(-.75,.75)
            length=scale*R.uniform(.75,1.42)
            direction=Vector((math.cos(theta),math.sin(theta),R.uniform(-.4,.72))).normalized()
            side=direction.cross(Vector((0,0,1))).normalized()
            ridge=side.cross(direction).normalized()
            start=len(verts)
            verts.extend([tuple(point-direction*length*.51),tuple(point+side*length*.30),tuple(point+ridge*length*.105),tuple(point-side*length*.30),tuple(point+direction*length*.51)])
            faces.extend([(start,start+1,start+2),(start,start+2,start+3),(start+1,start+4,start+2),(start+2,start+4,start+3)])
            mi=R.choices([0,1,2,3],[.35,.30,.18,.17])[0]
            indices.extend([mi]*4)
            shade=.77+.19*max(0,u)+R.uniform(-.05,.05)
            shades.extend([shade]*4)
            leaf_ids.extend([ci*10000+j+1]*4)
    obj=mesh(name+"_outline",verts,faces,"Garden olive dark",uv=False)
    for mat in ("Garden sage","Garden olive light","Garden leaf deep"):obj.data.materials.append(MATS[mat])
    for face,index in zip(obj.data.polygons,indices):face.material_index=index
    vertex_colors(obj,shades)
    # Face-domain stable leaf ID is retained in the authoring scene for LOD.
    attribute=obj.data.attributes.new("leaf_id","INT","FACE")
    for slot,value in zip(attribute.data,leaf_ids):slot.value=value
    obj["v7_leaf_outline"]=True
    obj["v7_cluster_count"]=len(clusters)
    canopy=join(WORLD[begin:],name,origin=origin)
    canopy["v7_foliage"]=True
    return canopy

def living_tree(name,x,y,height=4.4,crown=1.1,shape="broad",ambient=True):
    begin=len(WORLD)
    base=Vector((x,y,.075));top=Vector((x+.14,y-.06,height*.78))
    # Buttress roots and tapered, articulated trunk connect the plant to its soil.
    for i in range(6):
        a=i*math.tau/6+R.uniform(-.18,.18)
        end=base+Vector((math.cos(a)*.39,math.sin(a)*.39,.005))
        segment(name+"_root",end,base+Vector((0,0,.48)),.075,"Bark",r2=.040,vertices=9)
    segment(name+"_lower_trunk",base,base.lerp(top,.52),.17,"Bark",r2=.12,vertices=12)
    segment(name+"_trunk",base.lerp(top,.46),top,.125,"Bark",r2=.044,vertices=11)
    clusters=[]
    if shape=="upright":
        for i in range(12):
            t=i/12;z=height*(.33+.6*t);rad=crown*(.83-.61*t)
            a=i*2.39996
            end=Vector((x+math.cos(a)*rad*.31,y+math.sin(a)*rad*.31,z))
            segment(name+"_branch",base.lerp(top,.35+.58*t),end,.044,"Bark",r2=.014,vertices=7)
            clusters.append((end,rad))
    else:
        for i in range(13):
            a=i*2.39996+R.uniform(-.27,.27)
            horizontal=crown*R.uniform(.38,.87)
            h=height*R.uniform(.66,.91)
            end=Vector((x+math.cos(a)*horizontal,y+math.sin(a)*horizontal,h))
            start=base.lerp(top,R.uniform(.42,.85))
            elbow=start.lerp(end,.59)+Vector((0,0,.13))
            segment(name+"_branch",start,elbow,.06,"Bark",r2=.036,vertices=9)
            segment(name+"_branch_tip",elbow,end,.036,"Bark",r2=.013,vertices=7)
            for j in range(2):
                tip=end+Vector((R.uniform(-.32,.32),R.uniform(-.32,.32),R.uniform(.05,.3)))
                segment(name+"_twig",elbow.lerp(end,.64),tip,.014,"Bark",r2=.006,vertices=6)
            clusters.append((end,crown*R.uniform(.42,.54)))
        clusters.append(((x+.06,y-.1,height*.98),crown*.50))
    canopy=foliage_cloud("ambient_canopy_"+name,clusters,leaf_count=1550 if shape=="broad" else 1050,scale=.165 if shape=="broad" else .115,origin=(x,y,height*.80))
    if ambient:AMBIENT.append(canopy.name)
    wood=join([o for o in WORLD[begin:] if o is not canopy],name+"_wood",origin=(x,y,.075))
    return canopy

def shrub(x,y,r=.31):
    clusters=[((x,y,.12+r*.55),r*.83),((x+r*.22,y-r*.18,.12+r*.94),r*.62)]
    return foliage_cloud("Garden shrub",clusters,leaf_count=84,scale=.11)

def fern(x,y,size=.48):
    verts=[];faces=[]
    for i in range(7):
        a=i*2.4
        direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
        origin=Vector((x,y,.06))
        pts=[origin+direction*(size*t*.63)+Vector((0,0,size*(math.sin(t*2.1)*.66+.03))) for t in [j/6 for j in range(7)]]
        line("Fern rachis",pts,.008,"Garden leaf deep")
        for j in range(1,6):
            width=size*.18*(1-j/7)
            p=pts[j];tip=pts[j+1]
            for sign in (-1,1):
                start=len(verts)
                verts.extend([tuple(p),tuple(p+side*(width*sign)+direction*.03),tuple(tip)])
                faces.append((start,start+1,start+2))
    return mesh("Garden fern fronds",verts,faces,"Garden sage",uv=False)

def bed(name,x,y,rx,ry,seed):
    steps=32;verts=[(x,y,.062)];faces=[]
    for i in range(steps):
        a=math.tau*i/steps
        wiggle=1+.13*math.sin(a*3+seed)+.07*math.cos(a*5)
        verts.append((x+math.cos(a)*rx*wiggle,y+math.sin(a)*ry*wiggle,.056))
    for i in range(steps):faces.append((0,i+1,1+(i+1)%steps))
    return mesh(name,verts,faces,"Soil")

def organic_foundation(pid,cx,cy,index):
    steps=88;verts=[];faces=[];face_mats=[]
    profiles=[(1,.06),(1.015,-.16),(.975,-.42),(.91,-.76),(.965,-.92),(.79,-1.44),(.72,-1.93),(.43,-2.45),(.20,-2.63)]
    radii=[]
    for ring,(size,z) in enumerate(profiles):
        for i in range(steps):
            a=i*math.tau/steps
            radius=3.52*(1+.070*math.sin(a*3+index*.8)+.055*math.cos(a*5-index*.7)+.025*math.sin(a*9))
            if ring==0:radii.append(radius)
            rough=.013*math.sin(a*6) if ring<2 else .095*math.sin(a*7+ring*1.4+index)+.036*math.cos(a*13+ring)
            verts.append((cx+math.cos(a)*radius*size,cy+math.sin(a)*radius*size*.98,z+rough))
    center=len(verts);verts.append((cx,cy,.06))
    for i in range(steps):faces.append((center,i,(i+1)%steps));face_mats.append(3)
    for ring in range(len(profiles)-1):
        for i in range(steps):
            j=(i+1)%steps
            faces.append((ring*steps+i,(ring+1)*steps+i,(ring+1)*steps+j,ring*steps+j))
            face_mats.append(1 if ring in (0,3) else (2 if ring in (2,5,7) else 0))
    faces.append(tuple((len(profiles)-1)*steps+i for i in range(steps-1,-1,-1)));face_mats.append(2)
    obj=mesh("island_"+pid+"_foundation",verts,faces,"Rock limestone",smooth=False)
    for name in ("Limestone stratum pale","Limestone stratum deep","Meadow moss"):obj.data.materials.append(MATS[name])
    for face,matindex in zip(obj.data.polygons,face_mats):face.material_index=matindex
    vertex_colors(obj)
    # Craggy shoulders and chips interrupt the regular strata silhouette.
    begin=len(WORLD)
    for i in range(10):
        a=(i+.28)*math.tau/10+index*.24;r=3.30
        rock(cx+math.cos(a)*r,cy+math.sin(a)*r*.98,-.65, R.uniform(.30,.49))
    join([obj]+WORLD[begin:],"island_"+pid+"_foundation",origin=(cx,cy,0))

def terrace(pid,cx,cy,shape="round",height=.58):
    if shape=="round":
        cylinder(pid+"_plinth",(cx,cy,height/2),2.46,height,"Limestone · island",64,.045)
        cylinder(pid+"_paving",(cx,cy,height+.025),2.42,.045,"Warm stone · paths",64,.018)
    else:
        cube(pid+"_plinth",(cx,cy,height/2),(4.55,3.94,height),"Limestone · island",.16)
        cube(pid+"_paving",(cx,cy,height+.025),(4.49,3.89,.048),"Warm stone · paths",.075)
        for x in (-1.45,-.48,.48,1.45):
            line("Terrace stone joint",[(cx+x,cy-1.85,height+.051),(cx+x,cy+1.85,height+.051)],.003,"Limestone stratum deep")
    for i in range(3):
        h=(i+1)*height/3
        cube(pid+"_entry_step",(cx,cy-2.53+.22*i,h/2),(1.35,.71-.12*i,h),"Limestone · island",.026)
    for i in range(3):
        x=cx+.07*math.sin(i*1.1)
        cube("Garden stepping stone",(x,cy-2.90-i*.25,.073),(.83,.20,.06),"Warm stone · paths",.023)
    return height+.049

def porch_number(pid,cx,cy,floor):
    cube("Porch number stone",(cx-1.25,cy-1.77,floor+.15),(.39,.068,.29),"Limestone · island",.025)
    text("Porch number",f"{IDS.index(pid)+1:02d}",(cx-1.25,cy-1.808,floor+.085),.145,"Graphite ink")

def arch(name,x,y,z,width,height,depth,mat):
    radius=width/2;inner=radius-.23;spring=z+height-radius
    for side in (-1,1):cube(name+"_pier",(x+side*(radius-.115),y,(z+spring)/2),(.23,depth,spring-z+.012),mat,.025)
    verts=[];faces=[];steps=38
    for i in range(steps+1):
        a=i*math.pi/steps
        for yy in (y-depth/2,y+depth/2):
            for r in (inner,radius):verts.append((x+math.cos(a)*r,yy,spring+math.sin(a)*r))
    for i in range(steps):
        n=i*4;m=n+4
        faces.extend([(n,m,m+1,n+1),(n+2,n+3,m+3,m+2),(n+1,m+1,m+3,n+3),(n,n+2,m+2,m)])
    faces.extend([(0,1,3,2),(steps*4,steps*4+2,steps*4+3,steps*4+1)])
    obj=mesh(name+"_arch",verts,faces,mat)
    mod=obj.modifiers.new("Worked stone arch edge","BEVEL");mod.width=.022;mod.segments=2;apply_modifiers(obj)
    return obj

def register_pavilion(pid,cx,cy,begin,floor=.629):
    obj=join(WORLD[begin:],"pavilion_"+pid,origin=(cx,cy,0))
    PAVILIONS[pid]={"x":cx,"y":cy,"floor":floor,"object":obj}
    return obj

def research_pavilion(cx,cy):
    pid="pesquisa";begin=len(WORLD);floor=terrace(pid,cx,cy)
    # A real open arch gives the starting point an immediately distinct outline.
    arch("Research entry arch",cx-.20,cy+.77,floor,3.25,3.60,.32,"Limestone · island")
    for side in (-1,1):
        cube("Archive side niche",(cx+side*1.75,cy+.8,floor+1.04),(.39,1.15,2.08),"Limestone · island",.035)
    shelving(cx-1.09,cy+.77,floor,wide=.83,tall=1.83)
    h=desk(cx-.70,cy-.39,floor,wide=1.56)
    paper_diagram(cx-.70,cy-.36,h+.015,.76)
    for i in range(3):cube("Archive document",(cx-.18,cy-.23,h+.02+i*.028),(.26,.32,.025),"Paper warm",.006)
    lamp(cx-1.2,cy-.16,h,"Observatory bronze");stool(cx-.74,cy-1.20,floor,"Ceramic cream")
    # Observatory telescope: tapered optical tube, lens, equatorial hinge and tripod.
    center=Vector((cx+1.11,cy-.30,floor+1.53))
    direction=Vector((.05,.45,.68)).normalized()
    segment("Telescope optical tube",center-direction*.44,center+direction*.52,.17,"Observatory bronze",r2=.19,vertices=28)
    segment("Telescope objective rim",center+direction*.48,center+direction*.57,.21,"Brushed brass",vertices=28)
    segment("Telescope objective",center+direction*.571,center+direction*.581,.177,"Charcoal screen",vertices=28)
    sphere("Telescope mount",center-direction*.07,(.22,.19,.19),"Dark steel",segments=16,rings=10)
    segment("Telescope tripod stem",(cx+1.11,cy-.30,floor+.65),center,.051,"Dark steel",vertices=12)
    for i in range(3):
        a=i*math.tau/3
        segment("Telescope tripod foot",(cx+1.11+math.cos(a)*.43,cy-.30+math.sin(a)*.43,floor+.035),(cx+1.11,cy-.30,floor+.91),.032,"Dark steel",vertices=9)
    annulus("Research compass",(cx+.6,cy+.65),.36,.40,floor+.004,.007,"Brushed brass",steps=48)
    for i in range(8):
        a=i*math.pi/4
        segment("Compass notch",(cx+.6+math.cos(a)*.29,cy+.65+math.sin(a)*.29,floor+.01),(cx+.6+math.cos(a)*.34,cy+.65+math.sin(a)*.34,floor+.01),.006,"Brushed brass")
    pot(cx+1.71,cy+.15,floor,.65,True);porch_number(pid,cx,cy,floor)
    register_pavilion(pid,cx,cy,begin,floor)

def comparison_pavilion(cx,cy):
    pid="comparar";begin=len(WORLD);floor=terrace(pid,cx,cy,"rectangle")
    # Split laboratory with two workstations and a shared evidence wall.
    for side in (-1,1):
        cube("Laboratory pier",(cx+side*2.05,cy+.68,floor+1.33),(.28,2.19,2.66),"Teal laboratory",.048)
        cube("Laboratory clerestory side",(cx+side*1.07,cy+1.5,floor+2.48),(1.96,.22,.37),"Porcelain laboratory",.025)
    cube("Evidence low wall",(cx,cy+1.55,floor+.69),(4.25,.22,1.38),"Porcelain laboratory",.033)
    cube("Laboratory lintel",(cx,cy+.58,floor+2.88),(4.40,.23,.19),"Teal laboratory",.033)
    for i in range(8):cube("Laboratory roof rib",(cx-1.95+i*.55,cy+.90,floor+2.96),(.065,1.53,.15),"Oak · furniture",.012)
    for side in (-1,1):
        x=cx+side*1.02
        h=desk(x,cy-.15,floor,mat="Porcelain laboratory",wide=1.65)
        monitor(x,cy+.02,h,1.10);keyboard(x,cy-.43,h,.54)
        stool(x,cy-1.05,floor,"Teal laboratory")
        cube("Evidence pin board",(x,cy+1.406,floor+1.60),(1.47,.045,.75),"Oak endgrain",.018)
        cube("Evidence diagram",(x,cy+1.377,floor+1.6),(1.36,.008,.64),"Paper warm",.007)
        for j in range(4):
            height=.12+.09*(j+(1 if side>0 else 0))
            cube("Abstract comparison bar",(x-.44+j*.26,cy+1.366,floor+1.37+height/2),(.15,.004,height),"Sage · generate" if side<0 else "Slate blue · validate",.002)
        paper_diagram(x+.48,cy-.37,h+.023,.30)
    pot(cx-1.80,cy-.87,floor,.48);pot(cx+1.83,cy-.9,floor,.54)
    porch_number(pid,cx,cy,floor);register_pavilion(pid,cx,cy,begin,floor)

def validation_pavilion(cx,cy):
    pid="validar";begin=len(WORLD);floor=terrace(pid,cx,cy,"rectangle")
    # Open loggia: structural guides around the workbench mirror the harness theme.
    for side in (-1,1):
        for yy in (-.3,1.55):cube("Review loggia column",(cx+side*1.99,cy+yy,floor+1.37),(.26,.27,2.74),"Slate blue · validate",.040)
    cube("Review rear sill",(cx,cy+1.55,floor+.28),(4.19,.23,.56),"Slate blue · validate",.03)
    cube("Review rear lintel",(cx,cy+1.55,floor+2.75),(4.22,.25,.26),"Slate blue · validate",.035)
    for side in (-1,1):cube("Review side beam",(cx+side*2,cy+.58,floor+2.79),(.25,2.36,.25),"Slate blue · validate",.030)
    for i in range(7):cube("Review overhead slat",(cx-1.75+i*.58,cy+.59,floor+2.94),(.09,2.30,.13),"Oak · furniture",.012)
    h=desk(cx-.12,cy-.29,floor,mat="Slate blue · validate",wide=2.74)
    monitor(cx+.64,cy-.06,h,1.03);keyboard(cx+.63,cy-.50,h,.52)
    paper_diagram(cx-.61,cy-.33,h+.027,.88);lamp(cx-1.16,cy-.1,h,"Ceramic cream")
    stool(cx-.53,cy-1.18,floor,"Ceramic cream")
    cube("Harness verification panel",(cx-.65,cy+1.22,floor+1.72),(1.62,.07,1.70),"Oak endgrain",.027)
    cube("Harness test report",(cx-.65,cy+1.171,floor+1.72),(1.49,.014,1.55),"Paper warm",.012)
    for i in range(4):
        zz=floor+1.22+i*.31
        line("Harness checked criterion",[(cx-1.19,cy+1.155,zz+.065),(cx-1.10,cy+1.155,zz-.025),(cx-.98,cy+1.155,zz+.11)],.016,"Sage · generate")
        cube("Harness criterion line",(cx-.49,cy+1.153,zz+.035),(.62,.005,.012),"Graphite ink",.001)
    shelving(cx+1.36,cy+1.09,floor,wide=.69,tall=1.84)
    pot(cx+1.42,cy-.74,floor,.64,True);pot(cx-1.69,cy+.39,floor,.43)
    porch_number(pid,cx,cy,floor);register_pavilion(pid,cx,cy,begin,floor)

def future_pavilion(cx,cy):
    pid="perspectivas";begin=len(WORLD);floor=terrace(pid,cx,cy)
    # The final garden's lighthouse is a content landmark, not peripheral scenery.
    tower_x=cx+.20;tower_y=cy+.36
    cylinder("Lighthouse footing",(tower_x,tower_y,floor+.10),1.02,.20,"Limestone · island",48,.025)
    cylinder("Lighthouse taper",(tower_x,tower_y,floor+1.91),.83,3.58,"Limestone · island",48,.025,top_radius=.65)
    cylinder("Lighthouse sage belt",(tower_x,tower_y,floor+2.53),.707,.30,"Sage · generate",48,.016,top_radius=.695)
    # Recessed entry arch and oak door remain literal geometry rather than texture.
    arch("Lighthouse door surround",tower_x,tower_y-.844,floor+.05,.69,1.21,.13,"Warm stone · paths")
    cube("Lighthouse recessed doorway",(tower_x,tower_y-.841,floor+.61),(.43,.027,1.10),"Dark steel",.035)
    cube("Lighthouse oak door",(tower_x,tower_y-.868,floor+.59),(.365,.014,1.02),"Oak · furniture",.024)
    for i in range(4):cube("Lighthouse door grain",(tower_x-.135+i*.09,tower_y-.878,floor+.59),(.004,.004,.94),"Oak endgrain",.001)
    sphere("Lighthouse brass handle",(tower_x+.10,tower_y-.89,floor+.57),(.016,.022,.016),"Brushed brass",segments=8,rings=6)
    for zz in (1.56,2.22):
        cube("Lighthouse inset window",(tower_x,tower_y-.713,floor+zz),(.24,.052,.33),"Dark steel",.040)
        cube("Lighthouse pale window",(tower_x,tower_y-.745,floor+zz),(.18,.012,.25),"Lantern glass",.024)
    cylinder("Lighthouse balcony",(tower_x,tower_y,floor+3.72),1.13,.14,"Limestone · island",56,.025)
    annulus("Lighthouse balcony brass rail",(tower_x,tower_y),1.066,1.095,floor+4.33,.030,"Brushed brass",steps=56)
    for i in range(18):
        a=i*math.tau/18
        segment("Lighthouse balcony post",(tower_x+math.cos(a)*1.08,tower_y+math.sin(a)*1.08,floor+3.81),(tower_x+math.cos(a)*1.08,tower_y+math.sin(a)*1.08,floor+4.33),.013,"Dark steel",vertices=7)
    cylinder("Lighthouse lantern base",(tower_x,tower_y,floor+3.90),.68,.11,"Observatory bronze",48,.015)
    cylinder("Lighthouse lantern glass",(tower_x,tower_y,floor+4.27),.61,.68,"Lantern glass",32,.01)
    for i in range(8):
        a=i*math.tau/8
        segment("Lighthouse lantern mullion",(tower_x+math.cos(a)*.635,tower_y+math.sin(a)*.635,floor+3.92),(tower_x+math.cos(a)*.635,tower_y+math.sin(a)*.635,floor+4.67),.025,"Dark steel",vertices=8)
    sphere("Lighthouse beacon",(tower_x,tower_y-.38,floor+4.30),(.19,.15,.24),"Beacon ivory",segments=18,rings=10)
    cylinder("Lighthouse lantern cap",(tower_x,tower_y,floor+4.74),.77,.19,"Observatory bronze",48,.020,top_radius=.52)
    cylinder("Lighthouse roof",(tower_x,tower_y,floor+4.97),.59,.30,"Sage · generate",48,.016,top_radius=.06)
    segment("Lighthouse finial",(tower_x,tower_y,floor+5.10),(tower_x,tower_y,floor+5.36),.026,"Brushed brass",r2=.008,vertices=10)
    # Reading garden and empty lectern suggest a closing reflection, no extra destination.
    for side in (-1,1):
        cube("Garden bench seat",(cx+side*1.53,cy-.8,floor+.40),(.87,.45,.10),"Oak · furniture",.04)
        for yy in (-.96,-.65):cube("Garden bench support",(cx+side*1.53,cy+yy,floor+.19),(.63,.065,.35),"Observatory bronze",.012)
        cube("Garden bench back",(cx+side*1.53,cy-.56,floor+.72),(.87,.060,.31),"Oak · furniture",.025)
    cube("Conclusion lectern",(cx-1.15,cy+.36,floor+.70),(.39,.42,1.34),"Limestone · island",.045)
    paper_diagram(cx-1.15,cy+.36,floor+1.38,.47)
    pot(cx+1.72,cy+.54,floor,.74,True)
    porch_number(pid,cx,cy,floor);register_pavilion(pid,cx,cy,begin,floor)

def island_garden(pid,cx,cy,index):
    begin=len(WORLD)
    beds=[(-2.69,.46,.46,1.43),(2.68,.85,.48,1.31),(-.74,2.71,1.43,.36),(-1.98,-2.17,.49,.47),(2.05,-1.98,.52,.55)]
    for bi,(dx,dy,rx,ry) in enumerate(beds):bed("Island planted earth",cx+dx,cy+dy,rx,ry,index+bi)
    for i in range(17):
        a=math.radians(8+i*11.8)
        rad=R.uniform(2.83,3.21)
        x=cx+math.cos(a)*rad;y=cy+math.sin(a)*rad
        shrub(x,y,R.uniform(.25,.38))
        if i%3==0:fern(x-.1,y-.13,R.uniform(.34,.53))
        if i%4==0:
            for p in range(5):
                pa=p*math.tau/5
                sphere("seasonal_blossom_"+pid,(x+math.cos(pa)*.05,y+math.sin(pa)*.05,.40),(.045,.025,.02),"Flower ivory" if index%2 else "Flower blue",segments=7,rings=5)
    for side in (-1,1):
        for j in range(3):
            shrub(cx+side*(1.7+j*.28),cy-2.29+.13*j,R.uniform(.21,.3))
        rock(cx+side*2.85,cy-1.17,.048,.29)
    join(WORLD[begin:],"island_"+pid+"_groundcover",origin=(cx,cy,0))
    # Large, varied crowns rise above the architecture; planting stays within the footprint.
    tree_height=4.52+(.18 if index%3==1 else 0)
    living_tree(pid+"_canopy_main",cx-2.45,cy+1.12,tree_height,1.02,shape="broad")
    living_tree(pid+"_canopy_secondary",cx+2.57,cy+1.72,3.66+index*.055,.72,shape="upright" if index%2 else "broad")

for pid,cx,cy,index in ISLAND_LAYOUT:
    print("AUTHORING_ISLAND",pid,flush=True)
    organic_foundation(pid,cx,cy,index)
    if pid=="pesquisa":research_pavilion(cx,cy)
    elif pid=="comparar":comparison_pavilion(cx,cy)
    elif pid=="validar":validation_pavilion(cx,cy)
    elif pid=="perspectivas":future_pavilion(cx,cy)
    else:
        mat,kind={"gerar":("Sage · generate","generate"),"especificar":("Terracotta · specify","spec"),"evoluir":("Sand · evolve","evolve")}[pid]
        v6_pavilion(pid,cx,cy,mat,kind)
    island_garden(pid,cx,cy,index)

# Vertex shade is a weak multiplier; it remains compatible with live seasons/PBR lighting.
for obj in WORLD:
    if obj.type=="MESH":
        obj.data.validate(verbose=False);obj.data.update();vertex_colors(obj)
link_vertex_materials()

CAM_WORLD=[3.2,30.5,43.0]
TARGET_WORLD=[0,.80,-.45]
CAM_FOV=38
def to_blender(v):return Vector((v[0],-v[2],v[1]))
cam_data=bpy.data.cameras.new("V7 overview camera");cam_data.type="PERSP";cam_data.sensor_fit="VERTICAL"
cam_data.lens=cam_data.sensor_height/(2*math.tan(math.radians(CAM_FOV)/2))
camera=bpy.data.objects.new("V7 overview camera",cam_data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=to_blender(CAM_WORLD);camera.rotation_euler=(to_blender(TARGET_WORLD)-camera.location).to_track_quat("-Z","Y").to_euler()
scene.render.resolution_x=1800;scene.render.resolution_y=1350;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG";scene.render.film_transparent=False
scene.view_settings.view_transform="AgX";scene.view_settings.look="AgX - Medium High Contrast";scene.view_settings.exposure=.15
scene.world.node_tree.nodes.get("Background").inputs[0].default_value=(*color("E2EBDE"),1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value=.60
def area(name,loc,energy,size,hexval):
    data=bpy.data.lights.new(name,"AREA");data.energy=energy;data.shape="DISK";data.size=size;data.color=color(hexval)
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat("-Z","Y").to_euler()
area("V7 broad daylight",(-14,-11,21),2900,10,"FFF0D2")
area("V7 sky fill",(13,-2,19),1450,14,"DFEEE4")
sun_data=bpy.data.lights.new("V7 late morning sun","SUN");sun_data.energy=1.7;sun_data.angle=math.radians(10);sun_data.color=color("FFF1D8")
sun=bpy.data.objects.new("V7 late morning sun",sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.43,-.42,-.48)
ground=cube("Poster shadow ground",(0,0,-3.13),(250,250,.08),"Poster warm backdrop",0,dest=[])
vertex_colors(ground,[1]*len(ground.data.polygons))

spawn=[-9.6,.629,-7.65]
nodes={"spawn":{"position":spawn}};edges=[];destinations={};pavilion_data={}
for pid in IDS:
    p=PAVILIONS[pid];cx,cy=p["x"],p["y"]
    entry=[cx,round(max(p["floor"],.629),3),round(-cy+1.74,4)]
    nodes[pid+"_entry"]={"position":entry};edges.append(["spawn",pid+"_entry"]);destinations[pid]=pid+"_entry"
    focus=[cx,5.00 if pid=="perspectivas" else 4.12,round(-cy-.16,4)]
    projected=world_to_camera_view(scene,camera,to_blender(focus))
    target_height=1.58 if pid=="perspectivas" else 1.12
    position=[cx+4.80,7.05 if pid=="perspectivas" else 6.6,round(-cy+10.6,4)]
    pavilion_data[pid]={"entry":entry,"focus":focus,"hitNode":"pavilion_"+pid,
        "camera":{"position":position,"target":[cx,target_height,-cy],"fov":45},
        "posterPoint":[round(projected.x,5),round(1-projected.y,5)],"order":IDS.index(pid)+1,
        "editorial":"/experience/editorial/v7/"+pid+".webp","thumbnail":"/experience/world/thumb-v7-"+pid+".webp"}
manifest={"schemaVersion":1,"units":"meters","upAxis":"Y","version":7,
    "assets":{"world":"/experience/world/archipelago-v7.glb","worldLow":"/experience/world/archipelago-v7-low.glb","avatar":"/experience/world/avatar.glb","poster":"/experience/world/poster-v7.webp"},
    "initialCamera":{"position":CAM_WORLD,"target":TARGET_WORLD,"fov":CAM_FOV},
    "movingCamera":{"offset":[4.8,6.6,10.6],"targetOffset":[0,1.12,0],"damping":.095,"azimuthLock":True},
    "spawn":spawn,"pavilions":pavilion_data,"navigation":{"mode":"direct","nodes":nodes,"edges":edges,"destinations":destinations},
    "islands":{pid:{"center":[cx,0,-cy],"radius":4.15,"foundationNode":"island_"+pid+"_foundation"} for pid,cx,cy,index in ISLAND_LAYOUT},
    "weatherScenery":{"lightningTargets":[[-18.5,0,-17.8],[18.8,0,-17.3],[18.4,0,11.9]]},
    "avatar":{"speed":1.6,"scale":1},"ambientNodes":AMBIENT,"foliagePalette":FOLIAGE_PALETTE}
(OUT/"manifest-v7.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")

def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
common=dict(export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format="JPEG",export_jpeg_quality=86,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_vertex_color="NAME",export_vertex_color_name="Col",export_all_vertex_colors=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=8,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8)
select_only(WORLD)
bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v7.glb"),**common)
print("V7_HIGH_EXPORTED",(OUT/"archipelago-v7.glb").stat().st_size,flush=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v7.blend"),compress=True)

original_meshes={}
for obj in WORLD:
    if obj.type!="MESH":continue
    original_meshes[obj.name]=obj.data;obj.data=obj.data.copy()
    # Sculpted crown volume stays intact. The LOD selects whole leaves distributed
    # across every cluster, never a partial draw range or a decimated leaf card.
    if obj.get("v7_foliage"):
        bm=bmesh.new();bm.from_mesh(obj.data);layer=bm.faces.layers.int.get("leaf_id")
        if layer:
            remove=[face for face in bm.faces if face[layer]>0 and (face[layer]*2654435761)%10>=3]
            bmesh.ops.delete(bm,geom=remove,context="FACES");bm.to_mesh(obj.data)
        bm.free();obj.data.update()
        continue
    elif "groundcover" in obj.name:ratio=.27
    elif "foundation" in obj.name:ratio=.56
    elif "_wood" in obj.name:ratio=.52
    else:ratio=.27
    if len(obj.data.polygons)>120:
        modifier=obj.modifiers.new("V7 silhouette preserving LOD","DECIMATE");modifier.ratio=ratio;modifier.use_collapse_triangulate=True
        apply_modifiers(obj);obj.data.validate(verbose=False);obj.data.update()
select_only(WORLD)
low_common={**common,"export_jpeg_quality":74,"export_draco_mesh_compression_level":10,"export_draco_position_quantization":12,"export_draco_normal_quantization":8,"export_draco_texcoord_quantization":10,"export_draco_color_quantization":7}
bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v7-low.glb"),**low_common)
print("V7_LOW_EXPORTED",(OUT/"archipelago-v7-low.glb").stat().st_size,flush=True)
for name,data in original_meshes.items():bpy.data.objects[name].data=data
stats={"version":7,"worldBytes":(OUT/"archipelago-v7.glb").stat().st_size,"lowBytes":(OUT/"archipelago-v7-low.glb").stat().st_size,"worldMeshes":len(WORLD),"worldPolygons":sum(len(obj.data.polygons) for obj in WORLD),"blender":bpy.app.version_string,"camera":manifest["initialCamera"],"render":"pending","islands":7,"navigation":"direct","avatarLoaded":False,"source":"assets/world/archipelago-v7.blend","baseSource":"scripts/world/build_world.py","foliagePalette":FOLIAGE_PALETTE,"vertexShading":"COLOR_0, mild per-face cavity and crown shade; both LODs"}
(SOURCE/"build-report-v7.json").write_text(json.dumps(stats,indent=2),encoding="utf-8")
assert stats["worldBytes"]<=8*1024*1024,stats
assert stats["lowBytes"]<=4*1024*1024,stats
if "--skip-render" not in ARGS:
    scene.render.engine="BLENDER_EEVEE_NEXT";scene.eevee.taa_render_samples=64;scene.eevee.use_raytracing=True
    scene.render.resolution_x=1280;scene.render.resolution_y=960
    scene.render.filepath=str(SOURCE/"poster-v7-preview.png");bpy.ops.render.render(write_still=True)
print("V7_BUILD_COMPLETE",json.dumps(stats),flush=True)
