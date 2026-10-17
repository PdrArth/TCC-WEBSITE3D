"""Render the actual v8 Blender source; retain framing measurements.

blender --background --threads 4 assets/world/archipelago-v8.blend --python scripts/world/render_archipelago_v8.py
"""
from pathlib import Path
import bpy, json, math, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
manifest = json.loads((ROOT / "public/experience/world/manifest-v8.json").read_text(encoding="utf-8"))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
preview = "--preview" in args
scene = bpy.context.scene
camera = scene.camera
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 32 if preview else 96
scene.eevee.use_raytracing = True
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.frame_set(1)

def vector(v): return Vector((v[0], -v[2], v[1]))
def pose(data):
    camera.data.sensor_fit = "VERTICAL"
    camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(data["fov"]) / 2))
    camera.location = vector(data["position"])
    camera.rotation_euler = (vector(data["target"]) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()

pose(manifest["initialCamera"])
if "--framing-only" not in args:
    scene.render.resolution_x = 1280 if preview else 1800
    scene.render.resolution_y = 960 if preview else 1350
    scene.render.filepath = str(SOURCE / ("poster-v8-preview.png" if preview else "poster-v8-render.png"))
    bpy.ops.render.render(write_still=True)
    print("V8_POSTER_RENDERED", scene.render.filepath, flush=True)

records = {}
for width, height in ((1280, 720), (390, 844), (1800, 1350)):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    aspect = width / height
    original = manifest["initialCamera"]
    base = math.radians(original["fov"])
    fov = original["fov"] if width >= height else min(64, original["fov"] / max(.56, aspect))
    distance_scale = max(1, math.tan(base / 2) * 1.10 / (aspect * math.tan(math.radians(fov) / 2)))
    position = [original["target"][i] + (original["position"][i] - original["target"][i]) * distance_scale for i in range(3)]
    pose({**original, "position": position, "fov": fov})
    points = {}
    for pid, pavilion in manifest["pavilions"].items():
        p = world_to_camera_view(scene, camera, vector(pavilion["focus"]))
        points[pid] = [round(p.x, 5), round(1 - p.y, 5)]
    content, water = [], []
    for obj in scene.objects:
        if obj.type != "MESH" or obj.name == "Poster shadow ground": continue
        destination = water if obj.name.startswith("lake_") else content
        for corner in obj.bound_box:
            p = world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
            destination.append((p.x, 1 - p.y))
    def bounds(items):
        return [round(min(p[0] for p in items), 5), round(min(p[1] for p in items), 5), round(max(p[0] for p in items), 5), round(max(p[1] for p in items), 5)]
    content_bounds = bounds(content)
    all_focus = all(.015 <= v <= .985 for p in points.values() for v in p)
    all_content = content_bounds[0] >= -.015 and content_bounds[1] >= -.015 and content_bounds[2] <= 1.015 and content_bounds[3] <= 1.015
    records[f"{width}x{height}"] = {"fov": round(fov, 5), "distanceScale": round(distance_scale, 5), "focusPoints": points, "contentBounds": content_bounds, "lakeBounds": bounds(water), "allFocusVisible": all_focus, "allContentVisible": all_content, "passed": all_focus and all_content}
framing = {"version": 8, "source": "assets/world/archipelago-v8.blend", "camera": manifest["initialCamera"], "projections": records, "passed": all(r["passed"] for r in records.values()), "note": "Actual geometry projection; runtime CSS/labels require separate browser QA"}
(SOURCE / "framing-v8.json").write_text(json.dumps(framing, indent=2), encoding="utf-8")
print("V8_FRAMING", json.dumps(framing), flush=True)

if "--poster-only" not in args and "--framing-only" not in args:
    for pid, pavilion in manifest["pavilions"].items():
        for obj in scene.objects:
            if obj.type != "MESH" or obj.name == "Poster shadow ground": continue
            if obj.name.startswith("lake_"):
                obj.hide_render = False
            else:
                obj.hide_render = obj.get("v8_island") != pid
        pose(pavilion["camera"])
        scene.render.resolution_x = 800 if preview else 1200
        scene.render.resolution_y = 520 if preview else 780
        scene.render.filepath = str(SOURCE / ("editorial-v8-" + pid + ".png"))
        bpy.ops.render.render(write_still=True)
        print("V8_EDITORIAL_RENDERED", pid, flush=True)
print("V8_RENDERS_COMPLETE", flush=True)
