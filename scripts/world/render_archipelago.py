"""Render the actual four-island scene and four focused editorial views.
blender --background assets/world/archipelago-v6.blend --python scripts/world/render_archipelago.py
All frames use the preserved model, embedded local textures and manifest cameras.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
manifest = json.loads((ROOT / "public/experience/world/manifest.json").read_text(encoding="utf-8"))
scene = bpy.context.scene
camera = scene.camera
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 64
scene.eevee.use_raytracing = True
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.frame_set(1)
# Keep the large studio ground continuous beyond the focused frame's horizon.
bpy.data.objects["Poster shadow ground"].scale.x = 10
bpy.data.objects["Poster shadow ground"].scale.y = 10

for obj in scene.objects:
    if obj.type == "ARMATURE":
        obj.hide_render = True
        for child in obj.children_recursive: child.hide_render = True

def pose_camera(pose):
    camera.data.sensor_fit = "VERTICAL"
    camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(pose["fov"]) / 2))
    camera.location = Vector((pose["position"][0], -pose["position"][2], pose["position"][1]))
    target = Vector((pose["target"][0], -pose["target"][2], pose["target"][1]))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()

pose_camera(manifest["initialCamera"])
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200
scene.render.filepath = str(SOURCE / "poster-v6-render.png")
bpy.ops.render.render(write_still=True)
print("POSTER_V6_RENDERED", scene.render.filepath, flush=True)

centers = {pid: Vector((data["center"][0], -data["center"][2], 0)) for pid, data in manifest["islands"].items()}
island_objects = {}
for obj in scene.objects:
    if obj.type != "MESH" or obj.name == "Poster shadow ground" or obj.hide_render: continue
    center = sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8
    nearest = min(centers, key=lambda pid: (Vector((center.x, center.y, 0)) - centers[pid]).length_squared)
    island_objects[obj.name] = nearest

for pid, pavilion in manifest["pavilions"].items():
    for name, island_id in island_objects.items(): bpy.data.objects[name].hide_render = island_id != pid
    pose_camera(pavilion["camera"])
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 650
    scene.render.filepath = str(SOURCE / ("editorial-" + pid + ".png"))
    bpy.ops.render.render(write_still=True)
    print("EDITORIAL_RENDERED", pid, scene.render.filepath, flush=True)

print("ARCHIPELAGO_RENDERS_COMPLETE", flush=True)
