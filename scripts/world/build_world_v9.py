"""v9: organic foliage and a richer entry garden, preserving the v8 world.

Original procedural geometry; retained local CC0 textures. The botanical forms
are ornamental illustrations, not a habitat/species simulation. No downloaded
plant models, image planes or static fish are exported; fish live in the runtime.

blender --background --threads 4 --python scripts/world/build_world_v9.py
"""
from pathlib import Path
import ast, json, math, random, hashlib, sys
import bpy, bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"assets/world"; OUT=ROOT/"public/experience/world"
TEX=SOURCE/"textures/derived"
ARGS=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
IDS=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
R=random.Random(99173); QUICK=False; WORLD=[]; MATS={}; AMBIENT=[]
TREES=[]; PERCHES=[]; PLANTS=[]; FLOWER_UID=0
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/"archipelago-v8.blend"))
scene=bpy.context.scene
MATS={mat.name:mat for mat in bpy.data.materials}
manifest=json.loads((OUT/"manifest-v8.json").read_text(encoding="utf-8"))
old_report=json.loads((SOURCE/"build-report-v8.json").read_text(encoding="utf-8"))
helper=Path(__file__).with_name("build_world.py")
tree=ast.parse(helper.read_text(encoding="utf-8"))
names={"color","material","own","assign","apply_modifiers","mesh","cube","cylinder","segment","sphere","join"}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),str(helper),"exec"),globals())
tree_nodes={name for record in old_report["trees"] for name in (record["wood"],record["canopy"])}
for obj in list(scene.objects):
    if obj.name.startswith("ambient_") or obj.name in tree_nodes or "_planted_garden" in obj.name or "_shore_rocks" in obj.name:
        bpy.data.objects.remove(obj,do_unlink=True)
WORLD.extend(o for o in scene.objects if o.type=="MESH" and o.name!="Poster shadow ground")

PALETTE={"Garden olive dark":"477246","Garden sage":"668852","Garden olive light":"91A76B","Garden leaf deep":"2D563B","Garden dry tip":"B6A578","Flower ivory":"E9DFCC","Flower blue":"8BAFCE","Flower ipe gold":"EAC251","Flower quaresmeira":"9C6AB1","Flower ipe rose":"CF8FAF","Flower coral":"D9957D","Palm leaf":"5B7D4C","Banana leaf":"7D9957","Grass reed":"72845C"}
NEW=[]
for name,hexval in {**PALETTE,"v9 leaf glossy":"3B694C","v9 leaf young":"7FA569","v9 heliconia red":"B8553D","v9 heliconia gold":"D7A44A","v9 bromelia coral":"BE735A","v9 bark dark":"72634D","v9 bark light":"93816A","v9 bark warm":"8A6046","v9 forest soil":"6F7151","v9 mulched earth":"8A795D","v9 jabuticaba fruit":"3B323D","v9 stone warm":"BEB49B","v9 flower throat":"B4973D"}.items():
    if name not in MATS:
        material(name,hexval,rough=.78 if "leaf" in name else .91);NEW.append(MATS[name])
    else:
        mat=MATS[name];mat.diffuse_color=(*color(hexval),1)
        bsdf=mat.node_tree.nodes.get("Principled BSDF");base=bsdf.inputs["Base Color"]
        if base.links and base.links[0].from_node.type=="MIX":
            node=base.links[0].from_node
            if not node.inputs[6].links:node.inputs[6].default_value=(*color(hexval),1)
        elif not base.links:base.default_value=(*color(hexval),1)
for name in ("Garden olive dark","Garden sage","Garden olive light","Garden leaf deep","Palm leaf","Banana leaf","v9 leaf glossy","v9 leaf young"):
    bsdf=MATS[name].node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value=.62
    bsdf.inputs["Coat Weight"].default_value=.12

def set_origin(obj,point):
    scene.cursor.location=point;bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR");obj.select_set(False)
    return obj

def shade(obj,force=False):
    attr=obj.data.color_attributes.get("Col")
    if attr and not force:return
    if not attr:attr=obj.data.color_attributes.new(name="Col",type="BYTE_COLOR",domain="CORNER")
    obj.data.color_attributes.active_color=attr;obj.data.color_attributes.render_color_index=obj.data.color_attributes.find("Col")
    for loop in obj.data.loops:
        v=obj.data.vertices[loop.vertex_index]
        value=.93+.055*math.sin(v.co.x*2.6+v.co.y*2.1+v.co.z*3.8)
        attr.data[loop.index].color=(value,value,value,1)

class Batch:
    def __init__(self,materials):
        self.materials=materials;self.verts=[];self.faces=[];self.indices=[];self.ids=[];self.uid=0
    def add(self,verts,faces,mi=0,leaf=False):
        start=len(self.verts);self.verts.extend(tuple(v) for v in verts)
        self.faces.extend(tuple(start+i for i in f) for f in faces)
        self.indices.extend([mi]*len(faces))
        if leaf:self.uid+=1
        self.ids.extend([self.uid if leaf else 0]*len(faces))
    def tube(self,points,r0,r1,mi=0,sides=7,rough=.035):
        points=[Vector(p) for p in points];verts=[];faces=[]
        for i,p in enumerate(points):
            tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
            side=tangent.cross(Vector((0,0,1)))
            if side.length<.1:side=tangent.cross(Vector((0,1,0)))
            side.normalize();up=side.cross(tangent).normalized()
            radius=r0+(r1-r0)*i/(len(points)-1)
            for j in range(sides):
                a=j*math.tau/sides
                variation=1+rough*math.sin(j*2.9+i*.7)
                verts.append(p+(side*math.cos(a)+up*math.sin(a))*radius*variation)
            if i:
                for j in range(sides):faces.append(((i-1)*sides+j,(i-1)*sides+(j+1)%sides,i*sides+(j+1)%sides,i*sides+j))
        faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
        self.add(verts,faces,mi)
    def blade(self,base,direction,length,width,mi=0,segments=3,curl=.12,tilt=.12,split=False):
        base=Vector(base);d=Vector(direction).normalized();side=d.cross(Vector((0,0,1)))
        if side.length<.15:side=d.cross(Vector((0,1,0)))
        side.normalize();normal=side.cross(d).normalized();verts=[];faces=[]
        for i in range(segments+1):
            t=i/segments
            profile=math.sin(math.pi*t)**.74
            w=width*profile*(1+.075*math.sin(i*2.5+self.uid))+.0015
            center=base+d*length*t+normal*length*(curl*math.sin(t*math.pi)-tilt*t*t)
            # Curved lamina, raised midrib, tapered tip and mildly wavy margins.
            verts.extend([center-side*w+normal*length*.018*math.sin(i*2.2),center+normal*length*.026*profile,center+side*w-normal*length*.018*math.sin(i*1.8)])
            if i:
                row=(i-1)*3
                if not(split and i in (3,7)):faces.append((row,row+3,row+4,row+1))
                if not(split and i in (5,8)):faces.append((row+1,row+4,row+5,row+2))
        self.add(verts,faces,mi,leaf=True)
    def monstera(self,base,direction,length,width,mi=0):
        base=Vector(base);d=Vector(direction).normalized();side=d.cross(Vector((0,0,1))).normalized();normal=side.cross(d).normalized()
        verts=[];faces=[];rows=13;cols=(-1,-.60,-.28,0,.28,.60,1)
        for i in range(rows):
            t=i/(rows-1);w=width*math.sin(t*math.pi)**.61*(1.04-.16*t)+.005
            center=base+d*length*t+normal*length*(.13*math.sin(t*math.pi)-.12*t*t)
            for fraction in cols:
                verts.append(center+side*w*fraction+normal*(1-abs(fraction))*length*.035)
        for i in range(rows-1):
            for j in range(len(cols)-1):
                # Actual edge cuts and internal fenestrations, not black paint.
                if j in (0,5) and i in (3,6,9):continue
                if j in (1,4) and i in (4,7):continue
                a=i*len(cols)+j;b=a+len(cols)
                faces.append((a,b,b+1,a+1))
        self.add(verts,faces,mi,leaf=True)
    def trumpet(self,point,direction,length=.19,width=.08,mi=0):
        point=Vector(point);d=Vector(direction).normalized();side=d.cross(Vector((0,0,1)))
        if side.length<.1:side=d.cross(Vector((0,1,0)))
        side.normalize();up=side.cross(d).normalized();verts=[];faces=[]
        for ring,(t,r) in enumerate(((0,.19),(.50,.28),(.84,.84),(1,1))):
            for j in range(10):
                a=j*math.tau/10;lobes=1+.17*math.cos(a*5) if ring==3 else 1
                verts.append(point+d*(length*t+(.008*math.cos(a*5) if ring==3 else 0))+(side*math.cos(a)+up*math.sin(a))*width*r*lobes)
            if ring:
                for j in range(10):faces.append(((ring-1)*10+j,(ring-1)*10+(j+1)%10,ring*10+(j+1)%10,ring*10+j))
        self.add(verts,faces,mi,leaf=True)
    def blossom(self,point,size=.09,mi=0):
        p=Vector(point)
        for i in range(5):
            a=i*math.tau/5;d=Vector((math.cos(a),math.sin(a),.18));s=Vector((-math.sin(a),math.cos(a),0));verts=[];faces=[]
            for row in range(4):
                t=row/3;w=size*.49*math.sin(math.pi*t)**.57+.002
                c=p+d*size*t+Vector((0,0,size*.16*math.sin(t*math.pi)))
                verts.extend([c-s*w,c+Vector((0,0,size*.07)),c+s*w])
                if row:
                    n=(row-1)*3;faces.extend([(n,n+3,n+4,n+1),(n+1,n+4,n+5,n+2)])
            self.add(verts,faces,mi,leaf=True)
    def object(self,name,pivot=None,pid=None,ambient=False):
        obj=mesh(name,self.verts,self.faces,self.materials[0],uv=False,smooth=True)
        for mat in self.materials[1:]:obj.data.materials.append(MATS[mat])
        for face,index in zip(obj.data.polygons,self.indices):face.material_index=index
        if self.uid:
            attribute=obj.data.attributes.new("leaf_id","INT","FACE")
            for slot,value in zip(attribute.data,self.ids):slot.value=value
            obj["v9_foliage"]=True
        if pivot:set_origin(obj,pivot)
        if pid:obj["v8_island"]=pid;obj["v9_island"]=pid
        shade(obj)
        if ambient:AMBIENT.append(obj.name)
        return obj

def curve(a,b,steps=6,bend=.11):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();side=axis.cross(Vector((0,0,1)))
    if side.length<.1:side=Vector((1,0,0))
    side.normalize();return [a.lerp(b,t)+side*bend*math.sin(t*math.pi)+Vector((0,0,bend*.40*math.sin(t*math.pi))) for t in [i/steps for i in range(steps+1)]]

def organic_tree(record):
    pid=record["island"];kind=record["kind"];old_wood_name=record["wood"]
    island=manifest["islands"][pid]["center"]
    left="ipe_" in kind or kind in ("quaresmeira","araucaria") or (kind=="pau_brasil" and pid=="especificar")
    x=island[0]+(-2.99 if left else 2.98);y=-island[2]+1.60
    h=record["height"]-.08;spread=1.20 if left else .97
    wood=Batch(["v9 bark dark","v9 bark light","v9 bark warm"])
    leaves=Batch(["Garden olive dark","Garden sage","Garden leaf deep"])
    flowers=Batch(["Flower ipe gold" if kind=="ipe_amarelo" else("Flower quaresmeira" if kind=="quaresmeira" else "Flower ipe rose")])
    base=Vector((x,y,.08));top=Vector((x+.17,y+.08,h*.69))
    path=curve(base,top,steps=11,bend=.09)
    wood.tube(path,.19,.054,mi=2 if kind=="pau_brasil" else 0,sides=11,rough=.065)
    for i in range(7):
        a=i*math.tau/7+.31;foot=base+Vector((math.cos(a)*.66,math.sin(a)*.53,-.015))
        wood.tube(curve(foot,base+Vector((.015,0,.61)),4,.08),.055,.10,mi=0,sides=7)
    ends=[]
    if kind=="araucaria":
        for tier in range(3):
            for branch in range(7):
                a=branch*math.tau/7+tier*.31
                start=base+Vector((.12,.04,h*(.59+.16*tier)-.30))
                end=Vector((x+math.cos(a)*(1.42-.25*tier),y+math.sin(a)*(1.42-.25*tier),h*(.60+.17*tier)))
                wood.tube(curve(start,end,7,.15),.049,.014,sides=7)
                for j in range(47):
                    angle=R.uniform(0,math.tau);r=R.uniform(.02,.33)
                    p=end+Vector((math.cos(angle)*r,math.sin(angle)*r,R.uniform(-.11,.20)))
                    leaves.blade(p,(math.cos(angle),math.sin(angle),R.uniform(.0,.55)),.15,.018,mi=j%3,segments=2,curl=.06,tilt=.07)
                ends.append(end)
    else:
        for i in range(9):
            a=i*2.39996+R.uniform(-.17,.17)
            end=Vector((x+math.cos(a)*spread*R.uniform(.54,.98),y+math.sin(a)*spread*R.uniform(.56,1.0),h*R.uniform(.71,.97)))
            start=base.lerp(top,R.uniform(.63,.94))
            branch=curve(start,end,7,.12);wood.tube(branch,.070,.015,mi=0,sides=8)
            ends.append(end)
            for sprig in range(9 if "ipe" not in kind else 7):
                angle=R.uniform(0,math.tau);offset=Vector((math.cos(angle)*R.uniform(.25,.63),math.sin(angle)*R.uniform(.25,.59),R.uniform(-.15,.31)))
                tip=end+offset
                wood.tube(curve(end,tip,3,.024),.009,.003,sides=5)
                direction=offset.normalized();side=Vector((-direction.y,direction.x,0)).normalized()
                if "ipe" in kind:
                    for station in (.48,.95):
                        junction=end.lerp(tip,station)
                        for leaflet in range(5):
                            leaf_angle=angle+(leaflet-2)*.51
                            leaves.blade(junction,(math.cos(leaf_angle),math.sin(leaf_angle),R.uniform(-.08,.40)),R.uniform(.18,.26),R.uniform(.044,.058),mi=R.randrange(3),segments=3,curl=.14,tilt=.08)
                elif kind=="pau_brasil":
                    for station in range(5):
                        p=end.lerp(tip,.15+.17*station)
                        for sign in (-1,1):leaves.blade(p,side*sign+direction*.35+Vector((0,0,.18)),.135,.029,mi=R.randrange(3),segments=2,curl=.11,tilt=.12)
                else:
                    for station in range(5):
                        p=end.lerp(tip,.12+.19*station)
                        for sign in (-1,1):leaves.blade(p,side*sign+direction*.28+Vector((0,0,R.uniform(-.12,.40))),R.uniform(.19,.27),R.uniform(.050,.072),mi=R.randrange(3),segments=3,curl=.14,tilt=.12)
                if "ipe" in kind:
                    for j in range(3):
                        p=tip+Vector((R.uniform(-.12,.12),R.uniform(-.12,.12),R.uniform(-.04,.11)))
                        flowers.trumpet(p,(math.cos(angle+j*.5)*.44,math.sin(angle+j*.5)*.44,.76),length=R.uniform(.16,.21),width=R.uniform(.063,.083))
                elif kind=="quaresmeira" and sprig%2==0:
                    for j in range(3):flowers.blossom(tip+Vector((R.uniform(-.1,.1),R.uniform(-.1,.1),R.uniform(0,.1))),size=.11)
    wooden=wood.object(old_wood_name,(x,y,.08),pid)
    leafy=leaves.object(record["canopy"],(x,y,h*.56),pid,ambient=True)
    flower=None
    if flowers.faces:flower=flowers.object("ambient_flowers_"+pid+"_"+kind,(x,y,h*.60),pid,ambient=True)
    if kind=="jabuticabeira":
        begin=len(WORLD)
        for j in range(25):
            t=R.uniform(.25,.94);p=base.lerp(top,t);a=R.random()*math.tau
            sphere("Jabuticaba trunk fruit",p+Vector((math.cos(a)*.15,math.sin(a)*.15,0)),(.033,.033,.033),"v9 jabuticaba fruit",segments=7,rings=5)
        fruit=join(WORLD[begin:],"island_"+pid+"_jabuticaba_fruit",origin=(x,y,.08));fruit["v8_island"]=pid;fruit["v9_island"]=pid
    perch=ends[2]+Vector((0,0,.07))
    PERCHES.append({"position":[round(perch.x,4),round(perch.z,4),round(-perch.y,4)],"island":pid})
    TREES.append({"island":pid,"kind":kind,"canopy":leafy.name,"wood":wooden.name,"height":h,"leafSurfaces":leaves.uid,"closedCrownMasses":False,"flowerSurfaces":flowers.uid,"illustrative":True})

def organic_palm(record):
    pid=record["island"];kind=record["kind"];island=manifest["islands"][pid]["center"]
    x=island[0]+(-2.94 if pid=="gerar" else 3.0);y=-island[2]+1.52;h=record["height"]-.03
    wood=Batch(["v9 bark light","v9 bark dark"]);leaves=Batch(["Palm leaf","Garden sage","Garden leaf deep"])
    base=Vector((x,y,.08));top=Vector((x+.16,y+.06,h));points=curve(base,top,14,.09)
    wood.tube(points,.135,.09,mi=0,sides=11,rough=.045)
    for i in range(13):
        p=points[i+1];ring=[p+Vector((math.cos(j*math.tau/12)*(.14-i*.003),math.sin(j*math.tau/12)*(.14-i*.003),0)) for j in range(13)]
        wood.tube(ring,.008,.008,mi=1,sides=4,rough=0)
    for i in range(19):
        a=i*2.39996;d=Vector((math.cos(a),math.sin(a),0));s=Vector((-d.y,d.x,0));length=R.uniform(1.25,1.73)
        lift=.35 if i%3 else .58
        rachis=[top+d*length*t+Vector((0,0,lift*math.sin(math.pi*t)-.45*t*t)) for t in [j/16 for j in range(17)]]
        leaves.tube(rachis,.013,.004,mi=2,sides=5,rough=0)
        for j in range(1,16):
            p=rachis[j];t=j/16;blade_length=.33*math.sin(t*math.pi)+.10
            for sign in (-1,1):leaves.blade(p,s*sign+d*.35+Vector((0,0,-.25)),blade_length,.036,mi=(i+j)%3,segments=3,curl=.08,tilt=.19)
    wooden=wood.object(record["wood"],(x,y,.08),pid)
    canopy=leaves.object(record["canopy"],top,pid,ambient=True)
    PERCHES.append({"position":[top.x,top.z+.025,-top.y],"island":pid})
    TREES.append({"island":pid,"kind":kind,"canopy":canopy.name,"wood":wooden.name,"height":h,"leafSurfaces":leaves.uid,"closedCrownMasses":False,"illustrative":True})

def organic_banana(record):
    pid=record["island"];island=manifest["islands"][pid]["center"];x=island[0]-3.03;y=-island[2]+1.64;h=record["height"]-.05
    wood=Batch(["v9 bark light","Garden sage"]);leaves=Batch(["Banana leaf","Garden olive dark","Garden sage"])
    for stem in range(3):
        a=stem*2.4;foot=Vector((x+math.cos(a)*.16,y+math.sin(a)*.16,.08));top=Vector((x+.06*stem,y+.05*stem,h-.15*stem))
        wood.tube(curve(foot,top,9,.045),.14,.058,mi=0,sides=10)
        for i in range(5):
            angle=a+i*2.39996;d=Vector((math.cos(angle),math.sin(angle),-.19))
            leaves.blade(top,d,R.uniform(1.19,1.66),R.uniform(.26,.35),mi=(i+stem)%3,segments=10,curl=.12,tilt=.29,split=True)
    wooden=wood.object(record["wood"],(x,y,.08),pid)
    canopy=leaves.object(record["canopy"],(x,y,h*.85),pid,ambient=True)
    PERCHES.append({"position":[x,h,-y],"island":pid})
    TREES.append({"island":pid,"kind":"banana","canopy":canopy.name,"wood":wooden.name,"height":h,"leafSurfaces":leaves.uid,"closedCrownMasses":False,"illustrative":True})

def soft_rock(name,point,size,mat="v9 stone warm",pid=None):
    obj=sphere(name,point,(size,size*R.uniform(.65,.91),size*.43),mat,segments=10,rings=6)
    for v in obj.data.vertices:v.co*=1+.07*math.sin(v.co.x*11+v.co.y*13)+.05*math.cos(v.co.z*19)
    obj.data.update()
    if pid:obj["v8_island"]=pid;obj["v9_island"]=pid
    return obj

def soil_patch(batch,cx,cy,rx,ry,seed):
    verts=[(cx,cy,.075)];n=32
    for i in range(n):
        a=i*math.tau/n;rad=1+.14*math.sin(a*3+seed)+.07*math.cos(a*5)
        verts.append((cx+math.cos(a)*rx*rad,cy+math.sin(a)*ry*rad,.076))
    batch.add(verts,[(0,i+1,1+(i+1)%n) for i in range(n)])

def ground_garden(pid,index):
    c=manifest["islands"][pid]["center"];cx=c[0];cy=-c[2]
    soil=Batch(["v9 mulched earth"]);ferns=Batch(["Garden leaf deep","Garden sage","Garden olive dark"])
    broad=Batch(["v9 leaf glossy","v9 leaf young","Garden leaf deep"])
    blooms=Batch(["Flower coral","Flower ivory","Flower blue","Flower quaresmeira","Garden leaf deep"])
    grass=Batch(["Grass reed","Garden sage"]);heliconia=Batch(["v9 heliconia red","v9 heliconia gold"])
    bromelia=Batch(["Garden olive dark","v9 bromelia coral","Garden sage"])
    beds=[(-3.02,-.47,.60,1.14),(3.04,.49,.65,1.02),(-.32,3.43,1.56,.39),(-2.45,-2.63,.63,.43),(2.36,-2.68,.60,.43)]
    for bi,(dx,dy,rx,ry) in enumerate(beds):soil_patch(soil,cx+dx,cy+dy,rx,ry,index+bi*.7)
    # Rounded stones, irregular spacing and recessed mulch replace repeated
    # faceted boulders/green balls. They share one material and one island mesh.
    begin=len(WORLD)
    for i in range(38):
        a=i*math.tau/38+.13*math.sin(i*1.7+index);r=R.uniform(3.81,4.07)
        soft_rock("Garden worn shore stone",(cx+math.cos(a)*r,cy+math.sin(a)*r,.005),R.uniform(.12,.25),pid=pid)
    for bi,(dx,dy,rx,ry) in enumerate(beds):
        for i in range(8):
            a=i*math.tau/8+.1
            soft_rock("Garden mulch edging",(cx+dx+math.cos(a)*rx,cy+dy+math.sin(a)*ry,.087),R.uniform(.065,.11),pid=pid)
    stones=join(WORLD[begin:],"island_"+pid+"_shore_rocks",origin=(cx,cy,.06));stones["v8_island"]=pid;stones["v9_island"]=pid
    soil.object("island_"+pid+"_planted_garden",(cx,cy,.07),pid)
    for patch in range(8 if pid=="pesquisa" else 5):
        a=.08+patch*.42+R.uniform(-.10,.10);r=R.uniform(3.36,3.82)
        x=cx+math.cos(a)*r;y=cy+math.sin(a)*r
        for frond in range(7):
            fa=frond*2.39996;d=Vector((math.cos(fa),math.sin(fa),0));s=Vector((-d.y,d.x,0));base=Vector((x,y,.08));length=R.uniform(.38,.61)
            spine=[base+d*length*t*.73+Vector((0,0,length*math.sin(t*2.0)*.54)) for t in [j/7 for j in range(8)]]
            ferns.tube(spine,.006,.001,mi=0,sides=4,rough=0)
            for j in range(1,7):
                for sign in (-1,1):ferns.blade(spine[j],s*sign+d*.15+Vector((0,0,.12)),length*.22*(1-j/8),.023,mi=(j+frond)%3,segments=2,curl=.07)
    for bi in (0,1):
        dx,dy,rx,ry=beds[bi]
        for plant in range(4 if pid=="pesquisa" else 3):
            x=cx+dx+R.uniform(-.24,.24);y=cy+dy+R.uniform(-.45,.45);base=Vector((x,y,.08))
            for leaf in range(5 if pid=="pesquisa" else 3):
                a=leaf*2.39996+plant*.73
                tip=base+Vector((math.cos(a)*.28,math.sin(a)*.28,R.uniform(.48,.78)))
                broad.tube(curve(base,tip,4,.028),.017,.007,mi=2,sides=5)
                direction=Vector((math.cos(a),math.sin(a),R.uniform(.16,.43)))
                if (index+plant)%2==0 or pid=="pesquisa":broad.monstera(tip,direction,R.uniform(.52,.71),R.uniform(.21,.29),mi=plant%2)
                else:broad.blade(tip,direction,R.uniform(.50,.69),.18,mi=plant%2,segments=7,curl=.17,tilt=.23)
            for blade in range(8):
                a=blade*2.39996;grass.blade(base,(math.cos(a)*.45,math.sin(a)*.45,1),R.uniform(.35,.67),.018,mi=blade%2,segments=4,curl=.07,tilt=.32)
    for bi in (3,4):
        dx,dy,rx,ry=beds[bi]
        for flower in range(24 if pid=="pesquisa" else 17):
            a=R.random()*math.tau;r=R.random()**.5
            base=Vector((cx+dx+math.cos(a)*rx*r*.91,cy+dy+math.sin(a)*ry*r*.90,.08))
            top=base+Vector((R.uniform(-.05,.05),R.uniform(-.05,.05),R.uniform(.22,.46)))
            blooms.tube(curve(base,top,3,.013),.004,.002,mi=4,sides=4,rough=0)
            blooms.blossom(top,size=R.uniform(.07,.105),mi=(index+flower//8)%4)
            grass.blade(base,(.4,.1,.7),.17,.025,mi=1,segments=3)
    for plant in range(4 if pid=="pesquisa" else 2):
        # Alternating curved bracts on an upright spike; banana-like leaves.
        sign=-1 if plant%2 else 1;x=cx+sign*3.21;y=cy-.56+.30*plant
        base=Vector((x,y,.08));top=base+Vector((.08,.03,.93+.12*(plant%2)))
        heliconia.tube(curve(base,top,5,.015),.016,.008,mi=1,sides=6)
        for j in range(4):
            station=base.lerp(top,.42+j*.16);direction=Vector((sign*(-1 if j%2 else 1),.15,.35))
            heliconia.blade(station,direction,.23,.062,mi=j%2,segments=5,curl=.28,tilt=.05)
            if j<2:broad.blade(station,(-sign,.33,.65),.52,.12,mi=1,segments=6,curl=.20,tilt=.23)
    for plant in range(6 if pid=="pesquisa" else 4):
        a=.20+plant*.65;r=R.uniform(3.48,3.82);base=Vector((cx+math.cos(a)*r,cy+math.sin(a)*r,.08))
        for leaf in range(13):
            angle=leaf*2.39996
            bromelia.blade(base,(math.cos(angle)*.8,math.sin(angle)*.8,.66),R.uniform(.29,.45),.039,mi=0 if leaf%3 else 2,segments=5,curl=.10,tilt=.24)
        spike=base+Vector((.02,0,.43));bromelia.tube(curve(base,spike,3,.015),.009,.004,mi=1,sides=5)
        for j in range(4):bromelia.blade(base.lerp(spike,.57+j*.10),(math.cos(j*2.4),math.sin(j*2.4),.85),.12,.037,mi=1,segments=3,curl=.28)
    ferns.object("ambient_leaves_"+pid+"_fern_understory",(cx,cy,.08),pid,ambient=True)
    broad.object("ambient_leaves_"+pid+"_folhagem_tropical",(cx,cy,.08),pid,ambient=True)
    grass.object("ambient_leaves_"+pid+"_grasses",(cx,cy,.08),pid,ambient=True)
    blooms.object("ambient_flowers_"+pid+"_garden",(cx,cy,.08),pid,ambient=True)
    heliconia.object("ambient_flowers_"+pid+"_heliconia",(cx,cy,.08),pid,ambient=True)
    bromelia.object("ambient_flowers_"+pid+"_bromelia",(cx,cy,.08),pid,ambient=True)
    PLANTS.append({"island":pid,"entryDetailPriority":pid=="pesquisa","forms":["compound/ovate tree leaves","pinnate palm fronds","fenestrated ornamental aroid leaves","fern fronds","heliconia-inspired bracts","bromeliad rosettes","rounded petals"],"leafyMeshesGroupedByPivot":True})

def subdivided_pond():
    old=bpy.data.objects["lake_water"];location=old.location.copy()
    boundary=[v.co.copy() for v in old.data.vertices[1:]]
    verts=[(0,0,0)];faces=[];rings=23;n=len(boundary)
    for ring in range(1,rings+1):
        fraction=ring/rings
        verts.extend((v.x*fraction,v.y*fraction,0) for v in boundary)
        if ring==1:
            faces.extend((0,i+1,1+(i+1)%n) for i in range(n))
        else:
            lower=1+(ring-2)*n;upper=1+(ring-1)*n
            faces.extend((lower+i,upper+i,upper+(i+1)%n,lower+(i+1)%n) for i in range(n))
    WORLD.remove(old);bpy.data.objects.remove(old,do_unlink=True)
    obj=mesh("lake_water",verts,faces,"Shallow lake water",smooth=True)
    obj.location=location;obj["v9_water_grid"]=True;obj["runtime_animated"]=True
    # Keep the authoring render's reflection surface subtle; the runtime owns
    # animation and transparency for fish underneath it.
    bsdf=MATS["Shallow lake water"].node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value=.14
    bsdf.inputs["Coat Weight"].default_value=.42
    return {"name":"lake_water","plane":"XZ in glTF","localY":0,"worldY":-.16,"vertices":len(verts),"radialStepMeters":round(20/rings,3),"fishClearArea":{"x":[-6,6],"z":[-7,5],"y":-.20}}

def lightning_rocks():
    targets=[];records=[]
    for name,x,z,size in (("left",-19,-7,.57),("right",19,-7,.57),("front",0,17.5,.63)):
        begin=len(WORLD)
        center=soft_rock("Visible storm margin stone",(x,-z,.07),size)
        for i in range(4):
            a=i*2.39996;soft_rock("Storm margin stone shoulder",(x+math.cos(a)*size*.65,-z+math.sin(a)*size*.64,-.03),size*.47)
        obj=join(WORLD[begin:],"scenic_lightning_rock_"+name,origin=(x,-z,0))
        high=max((obj.matrix_world@v.co for v in obj.data.vertices),key=lambda p:p.z)
        target=[round(high.x,4),round(high.z,4),round(-high.y,4)]
        targets.append(target);records.append({"node":obj.name,"point":target})
    return targets,records

print("V9_REBUILD_FOLIAGE",flush=True)
for record in old_report["trees"]:
    print("V9_TREE",record["island"],record["kind"],flush=True)
    if "palmeira" in record["kind"]:organic_palm(record)
    elif record["kind"]=="banana":organic_banana(record)
    else:organic_tree(record)
for index,pid in enumerate(IDS):
    print("V9_GARDEN",pid,flush=True);ground_garden(pid,index)
pond=subdivided_pond();targets,target_records=lightning_rocks()
for obj in WORLD:
    obj.data.validate(verbose=False);obj.data.update();shade(obj)
for mat in NEW:
    bsdf=mat.node_tree.nodes.get("Principled BSDF");base=bsdf.inputs["Base Color"];constant=base.default_value[:]
    vertex=mat.node_tree.nodes.new("ShaderNodeVertexColor");vertex.layer_name="Col"
    mix=mat.node_tree.nodes.new("ShaderNodeMix");mix.data_type="RGBA";mix.blend_type="MULTIPLY";mix.inputs[0].default_value=1;mix.inputs[6].default_value=constant
    mat.node_tree.links.new(vertex.outputs["Color"],mix.inputs[7]);mat.node_tree.links.new(mix.outputs[2],base)

manifest["version"]=9;manifest["schemaVersion"]=2
manifest["assets"].update({"world":"/experience/world/archipelago-v9.glb","worldLow":"/experience/world/archipelago-v9-low.glb","poster":"/experience/world/poster-v9.webp"})
manifest["ambientNodes"]=AMBIENT;manifest["birdPerches"]=PERCHES
manifest["foliagePalette"]={**manifest.get("foliagePalette",{}),**PALETTE}
manifest["weatherScenery"]["lightningTargets"]=targets
for pid in IDS:
    manifest["pavilions"][pid]["editorial"]="/experience/editorial/v9/"+pid+".webp"
    manifest["pavilions"][pid]["thumbnail"]="/experience/world/thumb-v9-"+pid+".webp"
(OUT/"manifest-v9.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
contract={"version":9,"pond":pond,"foliageNodes":AMBIENT,"fish":"Six animated fish supplied by runtime; no duplicate static fish export","lightningTargets":target_records,"idsAndCamerasPreserved":True}
(SOURCE/"nodes-contract-v9.json").write_text(json.dumps(contract,ensure_ascii=False,indent=2),encoding="utf-8")
camera=scene.camera;pose=manifest["initialCamera"]
def vector(v):return Vector((v[0],-v[2],v[1]))
camera.data.sensor_fit="VERTICAL";camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(pose["fov"])/2))
camera.location=vector(pose["position"]);camera.rotation_euler=(vector(pose["target"])-camera.location).to_track_quat("-Z","Y").to_euler()
scene.render.resolution_x=1800;scene.render.resolution_y=1350;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG";scene.render.film_transparent=False
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v9.blend"),compress=True)
print("V9_SOURCE_AND_CONTRACT_READY",flush=True)

if "--skip-preview" not in ARGS:
    scene.render.engine="BLENDER_EEVEE_NEXT";scene.eevee.taa_render_samples=32;scene.eevee.use_raytracing=True
    scene.render.resolution_x=1280;scene.render.resolution_y=960
    scene.render.filepath=str(SOURCE/"poster-v9-preview.png");bpy.ops.render.render(write_still=True)
    print("V9_FIRST_POSTER",scene.render.filepath,flush=True)
    # Inspect the entrance at the same v8 camera, not at an artificially closer
    # camera that could disguise the size/shape difference.
    data=manifest["pavilions"]["pesquisa"]["camera"]
    camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(data["fov"])/2));camera.location=vector(data["position"])
    camera.rotation_euler=(vector(data["target"])-camera.location).to_track_quat("-Z","Y").to_euler()
    for obj in WORLD:
        obj.hide_render=not(obj.get("v8_island")=="pesquisa" or obj.name.startswith("lake_"))
    scene.render.resolution_x=1000;scene.render.resolution_y=650
    scene.render.filepath=str(SOURCE/"entry-v9-preview.png");bpy.ops.render.render(write_still=True)
    for obj in WORLD:obj.hide_render=False
    print("V9_ENTRY_PREVIEW",scene.render.filepath,flush=True)

report={"version":9,"blender":bpy.app.version_string,"source":"assets/world/archipelago-v9.blend","baseSource":"assets/world/archipelago-v8.blend","baseCommit":"4b713d9f18d6dde3e77499ae6b8341dd6a75edac","worldMeshes":len(WORLD),"worldPolygons":sum(len(o.data.polygons) for o in WORLD),"trees":TREES,"planting":PLANTS,"ambientNodes":len(AMBIENT),"pond":pond,"lightningTargets":target_records,"pavilionFurniture":"Geometry/positions retained from v8","layout":"Seven centers, hit nodes, bridges, cameras and IDs unchanged","botany":"Ornamental illustrations; no claim of a measured ecosystem or all-native planting","referenceMorphology":[{"feature":"Palmatelly compound Handroanthus leaves and trumpet flowers","source":"https://plantnet.rbgsyd.nsw.gov.au/cgi-bin/NSWfl.pl?lvl=gn&name=Handroanthus&page=nswfl"},{"feature":"Broadly ovate, cut and perforated Monstera foliage","source":"https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87478-1/general-information"}],"externalModelsUsed":False,"imagePlanesUsed":False,"fish":"Runtime instances; no duplicate static fish in GLB","budgets":{"world":8000000,"worldLow":4000000,"poster":160000},"render":"Preview; full real Blender renders pending"}
(SOURCE/"build-report-v9.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
# The dedicated exporter validates candidates before replacing any public model.
exporter=Path(__file__).with_name("refine_exports_v9.py")
if exporter.exists() and "--skip-export" not in ARGS:exec(compile(exporter.read_text(encoding="utf-8"),str(exporter),"exec"),globals())
print("V9_BUILD_COMPLETE",flush=True)
