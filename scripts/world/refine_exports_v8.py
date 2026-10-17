"""Optimize exports without altering the saved high-detail v8 authoring scene.

Candidates replace public assets only after both decimal budgets pass.
blender --background --threads 4 assets/world/archipelago-v8.blend --python scripts/world/refine_exports_v8.py
"""
from pathlib import Path
import bpy, bmesh, json, hashlib

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
OUT = ROOT / "public/experience/world"
world = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name != "Poster shadow ground"]

def selected():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in world: obj.select_set(True)
    bpy.context.view_layer.objects.active = world[0]

common = dict(export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format="JPEG", export_jpeg_quality=84, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_vertex_color="NAME", export_vertex_color_name="Col", export_all_vertex_colors=False, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10, export_draco_position_quantization=13, export_draco_normal_quantization=8, export_draco_texcoord_quantization=10, export_draco_color_quantization=7)
high = OUT / "candidate-high-v8.glb"
low = OUT / "candidate-low-v8.glb"
selected()
bpy.ops.export_scene.gltf(filepath=str(high), **common)
print("V8_CANDIDATE_HIGH", high.stat().st_size, flush=True)
original = {}
for obj in world:
    original[obj.name] = obj.data
    obj.data = obj.data.copy()
    if obj.get("v8_foliage"):
        bm = bmesh.new(); bm.from_mesh(obj.data)
        layer = bm.faces.layers.int.get("leaf_id")
        has_leaves = layer is not None
        if has_leaves:
            remove = [face for face in bm.faces if face[layer] > 0 and (face[layer] * 2654435761) % 10 >= 3]
            bmesh.ops.delete(bm, geom=remove, context="FACES")
            bm.to_mesh(obj.data)
        bm.free()
        if has_leaves: continue
    if obj.name.startswith("pavilion_"): ratio = .24
    elif "planted_garden" in obj.name or "shore_pebbles" in obj.name: ratio = .29
    elif "foundation" in obj.name or "bank" in obj.name: ratio = .56
    elif "_wood" in obj.name: ratio = .49
    else: ratio = .36
    if len(obj.data.polygons) > 140:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new("V8 optimized low detail", "DECIMATE")
        mod.ratio = ratio; mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.data.validate(verbose=False); obj.data.update()
low_polygons = sum(len(o.data.polygons) for o in world)
selected()
low_common = {**common, "export_jpeg_quality": 73, "export_draco_position_quantization": 11, "export_draco_normal_quantization": 7, "export_draco_texcoord_quantization": 9, "export_draco_color_quantization": 6}
bpy.ops.export_scene.gltf(filepath=str(low), **low_common)
print("V8_CANDIDATE_LOW", low.stat().st_size, flush=True)
assert high.stat().st_size <= 8000000, high.stat().st_size
assert low.stat().st_size <= 4000000, low.stat().st_size
high.replace(OUT / "archipelago-v8.glb")
low.replace(OUT / "archipelago-v8-low.glb")
for name, data in original.items(): bpy.data.objects[name].data = data
path = SOURCE / "build-report-v8.json"
report = json.loads(path.read_text(encoding="utf-8"))
report.update({"worldBytes": (OUT / "archipelago-v8.glb").stat().st_size, "lowBytes": (OUT / "archipelago-v8-low.glb").stat().st_size, "lowPolygons": low_polygons, "lod": "All closed crown cores retained; evenly sampled whole leaves; simplified garden pebbles and furniture bevels", "compression": {"high": "Draco 13/8/10/7; same full source geometry", "low": "Draco 11/7/9/6; reduced small details"}})
report["assetSha256"] = {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ("archipelago-v8.glb", "archipelago-v8-low.glb")}
path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("V8_EXPORT_REFINEMENT_COMPLETE", report["worldBytes"], report["lowBytes"], flush=True)
