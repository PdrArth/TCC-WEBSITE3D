"""Render the untouched v9 scene as the transparent v17 entrance poster.

Run from the repository root:
  .sites-runtime/tools/blender/blender-4.5.14-windows-x64/blender.exe \
    --background --threads 4 assets/world/archipelago-v9.blend \
    --python scripts/world/render_poster_v17.py -- --compress-python <python-with-pillow>

The saved blend, public models and original poster are never rewritten. Pillow
only compresses the untouched Blender PNG; no bitmap cleanup or compositing occurs.
"""
from array import array
from pathlib import Path
import hashlib
import json
import math
import argparse
import subprocess
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world/archipelago-v9.blend"
OUTPUT = ROOT / "public/experience/world/poster-v17.webp"
RENDER = ROOT / "assets/world/poster-v17-render.png"
REPORT = ROOT / "assets/world/poster-v17-report.json"
MANIFEST = ROOT / "public/experience/world/manifest-v14.json"
PRESERVED = (
    SOURCE,
    ROOT / "public/experience/world/archipelago-v9.glb",
    ROOT / "public/experience/world/archipelago-v9-low.glb",
    ROOT / "public/experience/world/poster-v9.webp",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def vector(values):
    return Vector((values[0], -values[2], values[1]))


assert Path(bpy.data.filepath).resolve() == SOURCE.resolve(), "Load the actual v9 source first"
parser = argparse.ArgumentParser()
parser.add_argument("--compress-python", required=True, help="Python executable with Pillow installed")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
original_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in PRESERVED}
manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
authored = manifest["initialCamera"]
position = [authored["target"][axis] + (authored["position"][axis] - authored["target"][axis]) * 1.05 for axis in range(3)]

scene = bpy.context.scene
camera = scene.camera
camera.data.sensor_fit = "VERTICAL"
camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(authored["fov"]) / 2))
camera.location = vector(position)
camera.rotation_euler = (vector(authored["target"]) - camera.location).to_track_quat("-Z", "Y").to_euler()
ground = bpy.data.objects.get("Poster shadow ground")
assert ground is not None, "The source should contain its original poster backdrop"
ground.hide_render = True
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 96
scene.eevee.use_raytracing = True
scene.render.film_transparent = True
scene.render.resolution_x = 1800
scene.render.resolution_y = 1350
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.frame_set(1)
bpy.context.view_layer.update()

focus_points = {}
for pavilion_id, pavilion in manifest["pavilions"].items():
    projected = world_to_camera_view(scene, camera, vector(pavilion["focus"]))
    focus_points[pavilion_id] = [round(projected.x, 5), round(1 - projected.y, 5)]
assert all(.015 <= coordinate <= .985 for point in focus_points.values() for coordinate in point), focus_points

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)
compression = subprocess.run([args.compress_python, "-c", """
from pathlib import Path
from PIL import Image
import json, sys
source, destination = map(Path, sys.argv[1:])
image = Image.open(source)
assert image.mode == "RGBA"
for quality in (86, 83, 80, 77, 74, 71, 68):
    image.save(destination, "WEBP", quality=quality, method=6, exact=True)
    if destination.stat().st_size <= 160000:
        break
with Image.open(destination) as encoded:
    assert encoded.getchannel("A").tobytes() == image.getchannel("A").tobytes(), "Compression changed alpha"
print(json.dumps({"quality": quality, "alphaPreservedExactly": True}))
""", str(RENDER), str(OUTPUT)], check=True, capture_output=True, text=True)
compressed = json.loads(compression.stdout)
quality = compressed["quality"]
assert OUTPUT.stat().st_size <= 160000, ("Poster exceeds the 160 KB budget", OUTPUT.stat().st_size)

image = bpy.data.images.load(str(OUTPUT), check_existing=False)
width, height = image.size
assert (width, height) == (1800, 1350)
assert image.channels == 4, "The exported WebP must retain alpha"
pixels = array("f", [0.0]) * (width * height * 4)
image.pixels.foreach_get(pixels)
corner_alphas = [pixels[(y * width + x) * 4 + 3] for x, y in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))]
assert corner_alphas == [0, 0, 0, 0], corner_alphas
visible_pixels = sum(pixels[index] > .01 for index in range(3, len(pixels), 4))
opaque_pixels = sum(pixels[index] > .99 for index in range(3, len(pixels), 4))
assert width * height * .05 < visible_pixels < width * height * .9, "Expected visible geometry surrounded by transparency"
assert opaque_pixels > width * height * .01, "The model must remain visible"
bpy.data.images.remove(image)

for path in PRESERVED:
    assert digest(path) == original_hashes[path.relative_to(ROOT).as_posix()], ("Protected asset changed", path)
report = {
    "version": 17,
    "source": SOURCE.relative_to(ROOT).as_posix(),
    "render": RENDER.relative_to(ROOT).as_posix(),
    "renderSha256": digest(RENDER),
    "blender": bpy.app.version_string,
    "poster": OUTPUT.relative_to(ROOT).as_posix(),
    "dimensions": [width, height],
    "bytes": OUTPUT.stat().st_size,
    "quality": quality,
    "compression": {"encoder": "Pillow WebP", "method": 6, "alphaPreservedExactly": compressed["alphaPreservedExactly"]},
    "sha256": digest(OUTPUT),
    "filmTransparent": scene.render.film_transparent,
    "hiddenBackdrop": ground.name,
    "camera": {"position": position, "target": authored["target"], "fov": authored["fov"], "introDistanceScale": 1.05},
    "focusPoints": focus_points,
    "alpha": {"corners": corner_alphas, "visiblePixels": visible_pixels, "opaquePixels": opaque_pixels},
    "preservedAssetHashes": original_hashes,
    "note": "Fresh Blender PNG render and Pillow WebP compression only; no bitmap editing. Browser composition needs separate QA.",
}
REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("V17_POSTER_READY", json.dumps(report), flush=True)
