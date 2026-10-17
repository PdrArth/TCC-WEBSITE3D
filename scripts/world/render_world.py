"""Render the preserved authoring scene. EEVEE first; CPU Cycles is explicit fallback.
blender --background assets/world/island.blend --python scripts/world/render_world.py -- [--cycles] [--preview]
"""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
scene=bpy.context.scene
preview="--preview" in args
manifest_path=ROOT/"public/experience/world/manifest.json"
manifest=json.loads(manifest_path.read_text(encoding="utf-8-sig"))
pose=manifest["initialCamera"]
camera=scene.camera
camera.data.sensor_fit="VERTICAL"
camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(pose["fov"])/2))
camera.location=(pose["position"][0],-pose["position"][2],pose["position"][1])
target=Vector((pose["target"][0],-pose["target"][2],pose["target"][1]))
camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
bpy.context.view_layer.update()
backdrop=bpy.data.materials.get("Poster warm backdrop")
if backdrop is None:
    backdrop=bpy.data.materials.new("Poster warm backdrop")
    backdrop.use_nodes=True
    rgb=[237/255,225/255,205/255]
    linear=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    backdrop.diffuse_color=(*linear,1)
    bsdf=backdrop.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*linear,1)
    bsdf.inputs["Roughness"].default_value=.92
    bpy.data.objects["Poster shadow ground"].data.materials[0]=backdrop
scene.render.resolution_x=1200 if preview else 1600
scene.render.resolution_y=900 if preview else 1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.filepath=str(ROOT/"assets/world/poster-preview.png" if preview else ROOT/"assets/world/poster-render.png")
for pavilion in manifest["pavilions"].values():
    focus=pavilion["focus"]
    point=world_to_camera_view(scene,camera,Vector((focus[0],-focus[2],focus[1])))
    pavilion["posterPoint"]=[round(point.x,5),round(1-point.y,5)]
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
if "--cycles" in args:
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=20 if preview else 64
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=5
else:
    scene.render.engine="BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples=48 if preview else 96
    scene.eevee.use_raytracing=True
scene.frame_set(1)
if not preview:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"assets/world/island.blend"))
bpy.ops.render.render(write_still=True)
print("POSTER_RENDERED",scene.render.filepath,scene.render.engine,flush=True)
