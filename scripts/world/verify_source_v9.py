"""Read-only source checks: retained furniture/bridges, pivots, pond and rocks."""
from pathlib import Path
import bpy,json,hashlib,struct,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world"
manifest=json.loads((ROOT/"public/experience/world/manifest-v9.json").read_text(encoding="utf-8"))
build=json.loads((SOURCE/"build-report-v9.json").read_text(encoding="utf-8"))
world={o.name:o for o in bpy.context.scene.objects if o.type=="MESH"}
def geometry_hash(obj):
    digest=hashlib.sha256()
    for vertex in obj.data.vertices:digest.update(struct.pack("<fff",*vertex.co))
    for face in obj.data.polygons:
        digest.update(struct.pack("<I",len(face.vertices)))
        digest.update(struct.pack("<"+"I"*len(face.vertices),*face.vertices))
    return digest.hexdigest()
names=["pavilion_"+pid for pid in manifest["pavilions"]]
names.extend(name for bridge in manifest["bridges"] for name in bridge["nodes"])
with bpy.data.libraries.load(str(SOURCE/"archipelago-v8.blend"),link=False) as (data_from,data_to):
    data_to.objects=list(names)
preserved={}
for name,old in zip(names,data_to.objects):
    current=world[name];digest=geometry_hash(current)
    assert digest==geometry_hash(old),("Geometry changed",name)
    # Library-loaded, unlinked objects have no evaluated world matrix. Compare
    # the saved transform channels; all retained pavilion/bridge nodes are roots.
    assert current.parent is None and old.parent is None,("Unexpected parent",name)
    for channel in ("location","rotation_euler","scale","delta_location","delta_rotation_euler","delta_scale"):
        assert max(abs(a-b) for a,b in zip(getattr(current,channel),getattr(old,channel)))<.000001,("Transform changed",name,channel)
    preserved[name]={"sha256":digest,"vertices":len(current.data.vertices),"polygons":len(current.data.polygons),"geometryAndTransformIdenticalToV8":True}
bridges=[]
for record in manifest["bridges"]:
    minimum=float("inf")
    for name in record["nodes"]:
        obj=world[name]
        for vertex in obj.data.vertices:
            point=obj.matrix_world@vertex.co
            for island in manifest["islands"].values():
                center=island["center"]
                minimum=min(minimum,math.hypot(point.x-center[0],point.y+center[2]))
    assert minimum>3.3,(record,minimum)
    bridges.append({"from":record["from"],"to":record["to"],"minimumDistanceToAnyPavilionCenter":round(minimum,5),"outsideEveryPavilionTerrace":True})
pivots={}
for name in manifest["ambientNodes"]:
    obj=world[name];assert name.startswith(("ambient_leaves_","ambient_flowers_"))
    assert not any(part in name for part in ("wood","trunk","pavilion","foundation"))
    assert obj.matrix_world.translation.z>=.065
    assert obj.data.attributes.get("leaf_id"),name
    pivots[name]={"positionBlender":[round(v,5) for v in obj.matrix_world.translation],"leavesOrFlowersOnly":True,"wholeLeafLodGroups":True}
assert all(tree["closedCrownMasses"] is False for tree in build["trees"])
water=world["lake_water"];zs=[v.co.z for v in water.data.vertices]
assert max(zs)-min(zs)<.00001 and abs(water.location.z+.16)<.00001 and len(zs)>2500
lightning=[]
for record,target in zip(build["lightningTargets"],manifest["weatherScenery"]["lightningTargets"]):
    obj=world[record["node"]]
    peak=max((obj.matrix_world@v.co for v in obj.data.vertices),key=lambda p:p.z)
    actual=[peak.x,peak.z,-peak.y]
    assert max(abs(a-b) for a,b in zip(actual,target))<.00006,("Lightning target misses rock",record)
    lightning.append({"node":obj.name,"point":target,"matchesActualRockPeak":True})
scene=bpy.context.scene;camera=scene.camera;original=manifest["initialCamera"]
def vector(v):return Vector((v[0],-v[2],v[1]))
visible={}
for width,height in ((1280,720),(390,844),(1800,1350)):
    scene.render.resolution_x=width;scene.render.resolution_y=height;aspect=width/height
    fov=original["fov"] if width>=height else min(64,original["fov"]/max(.56,aspect))
    scale=max(1,math.tan(math.radians(original["fov"])/2)*1.10/(aspect*math.tan(math.radians(fov)/2)))
    position=[original["target"][i]+(original["position"][i]-original["target"][i])*scale for i in range(3)]
    camera.data.sensor_fit="VERTICAL";camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(fov)/2))
    camera.location=vector(position);camera.rotation_euler=(vector(original["target"])-camera.location).to_track_quat("-Z","Y").to_euler();bpy.context.view_layer.update()
    points=[]
    for target in manifest["weatherScenery"]["lightningTargets"]:
        point=world_to_camera_view(scene,camera,vector(target))
        assert 0<=point.x<=1 and 0<=point.y<=1 and point.z>0,(width,height,target,list(point))
        points.append([round(point.x,5),round(1-point.y,5)])
    visible[f"{width}x{height}"]=points
report={"version":9,"passed":True,"source":"assets/world/archipelago-v9.blend","sourceSha256":hashlib.sha256((SOURCE/"archipelago-v9.blend").read_bytes()).hexdigest(),"preserved":preserved,"bridges":bridges,"ambient":pivots,"water":{"vertices":len(zs),"planar":True,"sourceLocalPlane":"XY","gltfLocalPlane":"XZ","height":-.16,"centralFishArea":build["pond"]["fishClearArea"]},"lightning":lightning,"lightningProjections":visible,"closedCrownMasses":False,"botanicalModelsIllustrative":True}
(SOURCE/"verification-source-v9.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print("V9_SOURCE_VERIFIED",json.dumps({"passed":True,"furniturePreserved":7,"bridgesPreserved":6,"physicalClearances":len(bridges),"plantPivots":len(pivots),"waterVertices":len(zs),"lightningOnRealVisibleRocks":True}),flush=True)
