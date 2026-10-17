"""Render the preserved seven-island scene, overview, editorial views and LOD QA.

blender --background assets/world/archipelago-v7.blend --python scripts/world/render_archipelago_v7.py -- [--preview] [--poster-only]
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"assets/world"
manifest=json.loads((ROOT/"public/experience/world/manifest-v7.json").read_text(encoding="utf-8"))
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
preview="--preview" in args
scene=bpy.context.scene;camera=scene.camera
scene.render.engine="BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples=40 if preview else 96
scene.eevee.use_raytracing=True
scene.render.image_settings.file_format="PNG";scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.frame_set(1)
# Focused cameras can see far along the plane; prevent an artificial studio edge.
bpy.data.objects["Poster shadow ground"].scale.x=10
bpy.data.objects["Poster shadow ground"].scale.y=10

def pose(pose_data):
    camera.data.sensor_fit="VERTICAL"
    camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(pose_data["fov"])/2))
    camera.location=Vector((pose_data["position"][0],-pose_data["position"][2],pose_data["position"][1]))
    target=Vector((pose_data["target"][0],-pose_data["target"][2],pose_data["target"][1]))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    bpy.context.view_layer.update()

pose(manifest["initialCamera"])
scene.render.resolution_x=1280 if preview else 1800
scene.render.resolution_y=960 if preview else 1350
scene.render.filepath=str(SOURCE/("poster-v7-preview.png" if preview else "poster-v7-render.png"))
bpy.ops.render.render(write_still=True)
print("V7_POSTER_RENDERED",scene.render.filepath,flush=True)

# Separately recorded projections make desktop/mobile framing reviewable.
records={}
for width,height in ((1280,720),(390,844),(1800,1350)):
    scene.render.resolution_x=width;scene.render.resolution_y=height
    # Same portrait rule as the site, including its responsive camera distance.
    aspect=width/height
    base=math.radians(manifest["initialCamera"]["fov"])
    fov=manifest["initialCamera"]["fov"] if width>=height else min(64,manifest["initialCamera"]["fov"]/max(.56,aspect))
    distance_scale=max(1,math.tan(base/2)*1.05/(aspect*math.tan(math.radians(fov)/2)))
    original=manifest["initialCamera"]
    position=[original["target"][i]+(original["position"][i]-original["target"][i])*distance_scale for i in range(3)]
    p={**original,"position":position,"fov":fov};pose(p)
    points={}
    for pid,pavilion in manifest["pavilions"].items():
        v=pavilion["focus"]
        projected=world_to_camera_view(scene,camera,Vector((v[0],-v[2],v[1])))
        points[pid]=[round(projected.x,5),round(1-projected.y,5)]
    foundation_bounds=[]
    for obj in scene.objects:
        if obj.type=="MESH" and (obj.name.startswith("island_") or obj.name.startswith("ambient_canopy_") or obj.name.startswith("pavilion_")):
            for corner in obj.bound_box:
                projected=world_to_camera_view(scene,camera,obj.matrix_world @ Vector(corner))
                foundation_bounds.append((projected.x,1-projected.y))
    bounds=[round(min(p[0] for p in foundation_bounds),4),round(min(p[1] for p in foundation_bounds),4),round(max(p[0] for p in foundation_bounds),4),round(max(p[1] for p in foundation_bounds),4)]
    records[f"{width}x{height}"]={"fov":round(fov,5),"distanceScale":round(distance_scale,5),"focusPoints":points,"sceneBounds":bounds}
(SOURCE/"framing-v7.json").write_text(json.dumps(records,indent=2),encoding="utf-8")

if "--poster-only" not in args:
    centers={pid:Vector((data["center"][0],-data["center"][2],0)) for pid,data in manifest["islands"].items()}
    ownership={}
    for obj in scene.objects:
        if obj.type!="MESH" or obj.name=="Poster shadow ground":continue
        center=sum((obj.matrix_world @ Vector(c) for c in obj.bound_box),Vector())/8
        ownership[obj.name]=min(centers,key=lambda pid:(Vector((center.x,center.y,0))-centers[pid]).length_squared)
    for pid,pavilion in manifest["pavilions"].items():
        for name,island_id in ownership.items():bpy.data.objects[name].hide_render=island_id!=pid
        pose(pavilion["camera"])
        scene.render.resolution_x=800 if preview else 1200
        scene.render.resolution_y=520 if preview else 780
        scene.render.filepath=str(SOURCE/("editorial-v7-"+pid+".png"))
        bpy.ops.render.render(write_still=True)
        print("V7_EDITORIAL_RENDERED",pid,flush=True)
print("V7_RENDERS_COMPLETE",flush=True)
