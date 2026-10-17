"""Finish v7 export contracts from the retained source, without rebuilding geometry.

blender --background --threads 4 assets/world/archipelago-v7.blend --python scripts/world/refine_exports_v7.py
"""
from pathlib import Path
import bpy, bmesh, json, math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world";OUT=ROOT/"public/experience/world"
scene=bpy.context.scene
world=[obj for obj in scene.objects if obj.type=="MESH" and obj.name!="Poster shadow ground"]

for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    # Blender 4.5 glTF gathers modern Mix RGBA; legacy MixRGB is not supported.
    for old in list(mat.node_tree.nodes):
        if old.type!="MIX_RGB" or old.blend_type!="MULTIPLY":continue
        destinations=[link.to_socket for link in old.outputs[0].links]
        node=mat.node_tree.nodes.new("ShaderNodeMix");node.data_type="RGBA";node.blend_type="MULTIPLY";node.inputs[0].default_value=1
        for src,dst in ((old.inputs[1],node.inputs[6]),(old.inputs[2],node.inputs[7])):
            dst.default_value=src.default_value
            if src.links:mat.node_tree.links.new(src.links[0].from_socket,dst)
        for socket in destinations:mat.node_tree.links.new(node.outputs[2],socket)
        mat.node_tree.nodes.remove(old)
for obj in [*world,bpy.data.objects["Poster shadow ground"]]:
    layer=obj.data.color_attributes.get("Col")
    if layer is None:layer=obj.data.color_attributes.new(name="Col",type="BYTE_COLOR",domain="CORNER")
    obj.data.color_attributes.active_color=layer
    obj.data.color_attributes.render_color_index=obj.data.color_attributes.find("Col")
    for face in obj.data.polygons:
        normal=(obj.matrix_world.to_3x3() @ face.normal).normalized()
        shade=.86+.13*max(0,normal.z)-.07*max(0,-normal.z)
        if obj.name=="Poster shadow ground":shade=1
        for li in face.loop_indices:
            if layer.data[li].color[3]<.1 or obj.name=="Poster shadow ground":layer.data[li].color=(shade,shade,shade,1)
    leaf_ids=obj.data.attributes.get("leaf_id")
    if leaf_ids is not None and (obj.get("v7_foliage") or "groundcover" in obj.name):
        lo=min(v.co.z for v in obj.data.vertices);hi=max(v.co.z for v in obj.data.vertices)
        # Continuous shades on closed leaf masses share vertices, reducing bytes
        # and preserving a natural gradient instead of making every face a seam.
        for face in obj.data.polygons:
            name=obj.data.materials[face.material_index].name
            if leaf_ids.data[face.index].value!=0 or not name.startswith("Garden"):continue
            for li in face.loop_indices:
                vertex=obj.data.vertices[obj.data.loops[li].vertex_index]
                shade=.77+.21*max(0,min(1,(vertex.co.z-lo)/max(.01,hi-lo)))
                layer.data[li].color=(shade,shade,shade,1)
    obj.data.update()
for filename in ("manifest.json","manifest-v7.json"):
    path=OUT/filename;manifest=json.loads(path.read_text(encoding="utf-8"))
    for pid,pavilion in manifest["pavilions"].items():
        pavilion["entry"][1]=.629
        manifest["navigation"]["nodes"][pid+"_entry"]["position"]=pavilion["entry"]
    path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding="utf-8")
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v7.blend"),compress=True)

def selected():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in world:obj.select_set(True)
    bpy.context.view_layer.objects.active=world[0]
common=dict(export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format="JPEG",export_jpeg_quality=86,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_vertex_color="NAME",export_vertex_color_name="Col",export_all_vertex_colors=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=8,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8)
selected();bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v7.glb"),**common)
print("REFINED_HIGH",(OUT/"archipelago-v7.glb").stat().st_size,flush=True)
original={}
for obj in world:
    original[obj.name]=obj.data;obj.data=obj.data.copy()
    if obj.get("v7_foliage"):
        # Distribute a subset of complete leaves through every canopy cluster.
        # Retain all closed crown cores and their proportions, without decimation.
        bm=bmesh.new();bm.from_mesh(obj.data)
        layer=bm.faces.layers.int.get("leaf_id")
        if layer:
            remove=[face for face in bm.faces if face[layer]>0 and (face[layer]*2654435761)%10>=3]
            bmesh.ops.delete(bm,geom=remove,context="FACES")
            bm.to_mesh(obj.data)
        bm.free();obj.data.update()
        continue
    ratio=.27 if "groundcover" in obj.name else (.56 if "foundation" in obj.name else (.52 if "_wood" in obj.name else .27))
    if len(obj.data.polygons)>100:
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new("V7 low architectural detail","DECIMATE");mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.data.validate(verbose=False);obj.data.update()
low_common={**common,"export_jpeg_quality":74,"export_draco_mesh_compression_level":10,"export_draco_position_quantization":12,"export_draco_normal_quantization":8,"export_draco_texcoord_quantization":10,"export_draco_color_quantization":7}
selected();bpy.ops.export_scene.gltf(filepath=str(OUT/"archipelago-v7-low.glb"),**low_common)
low_bytes=(OUT/"archipelago-v7-low.glb").stat().st_size
print("REFINED_LOW",low_bytes,flush=True)
low_polygons=sum(len(obj.data.polygons) for obj in world)
for name,data in original.items():bpy.data.objects[name].data=data
report_path=SOURCE/"build-report-v7.json";report=json.loads(report_path.read_text(encoding="utf-8"))
report["worldBytes"]=(OUT/"archipelago-v7.glb").stat().st_size;report["lowBytes"]=low_bytes
report["lowPolygons"]=low_polygons
report["lod"]="All crown cores preserved; evenly distributed whole leaves; reduced furniture bevels; Draco 12/8/10/7"
report_path.write_text(json.dumps(report,indent=2),encoding="utf-8")
assert report["worldBytes"]<=8_000_000,report["worldBytes"]
assert low_bytes<=4_000_000,low_bytes
print("V7_EXPORT_REFINEMENT_COMPLETE",flush=True)
