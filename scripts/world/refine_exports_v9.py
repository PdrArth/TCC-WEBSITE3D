"""Export v9 GLBs with retained foliage silhouettes and decimal budget gates."""
from pathlib import Path
import bpy,bmesh,json,hashlib

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world";OUT=ROOT/"public/experience/world"
world=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name!="Poster shadow ground"]
for obj in world:obj.hide_render=False
def selected():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in world:obj.select_set(True)
    bpy.context.view_layer.objects.active=world[0]
common=dict(export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format="JPEG",export_jpeg_quality=82,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_vertex_color="NAME",export_vertex_color_name="Col",export_all_vertex_colors=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=13,export_draco_normal_quantization=8,export_draco_texcoord_quantization=10,export_draco_color_quantization=7)
high=OUT/"candidate-high-v9.glb";low=OUT/"candidate-low-v9.glb"
selected();bpy.ops.export_scene.gltf(filepath=str(high),**common)
print("V9_CANDIDATE_HIGH",high.stat().st_size,flush=True)
assert high.stat().st_size<=8000000,high.stat().st_size
original={}
for obj in world:
    original[obj.name]=obj.data;obj.data=obj.data.copy()
    if obj.get("v9_foliage"):
        bm=bmesh.new();bm.from_mesh(obj.data);layer=bm.faces.layers.int.get("leaf_id")
        if layer:
            remove=[face for face in bm.faces if face[layer]>0 and (face[layer]*2654435761)%100>=68]
            bmesh.ops.delete(bm,geom=remove,context="FACES");bm.to_mesh(obj.data)
        bm.free();obj.data.update()
        # Retain whole curved blades and petals, not random individual faces.
        continue
    if obj.name=="lake_water":continue
    ratio=.24 if obj.name.startswith("pavilion_") else(.53 if "_wood" in obj.name else .42)
    if len(obj.data.polygons)>150:
        bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new("V9 reduced stone and furniture details","DECIMATE");mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name);obj.data.validate(verbose=False);obj.data.update()
low_polygons=sum(len(obj.data.polygons) for obj in world)
selected();bpy.ops.export_scene.gltf(filepath=str(low),**{**common,"export_jpeg_quality":72,"export_draco_position_quantization":11,"export_draco_normal_quantization":7,"export_draco_texcoord_quantization":9,"export_draco_color_quantization":6})
print("V9_CANDIDATE_LOW",low.stat().st_size,flush=True)
assert low.stat().st_size<=4000000,low.stat().st_size
high.replace(OUT/"archipelago-v9.glb");low.replace(OUT/"archipelago-v9-low.glb")
for name,data in original.items():bpy.data.objects[name].data=data
path=SOURCE/"build-report-v9.json";report=json.loads(path.read_text(encoding="utf-8"))
report.update({"worldBytes":(OUT/"archipelago-v9.glb").stat().st_size,"lowBytes":(OUT/"archipelago-v9-low.glb").stat().st_size,"lowPolygons":low_polygons,"lod":"68 percent evenly sampled whole leaf/petal surfaces; branches and water grid retained; smaller furniture/stone details reduced","compression":{"high":"Draco13/8/10/7","low":"Draco11/7/9/6"}})
report["assetSha256"]={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in ("archipelago-v9.glb","archipelago-v9-low.glb")}
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("V9_EXPORTS_READY",report["worldBytes"],report["lowBytes"],flush=True)
