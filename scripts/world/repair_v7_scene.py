"""One-time visual QA correction to the retained lighthouse doorway depth."""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]
obj=bpy.data.objects["pavilion_perspectivas"]
if not obj.get("v7_door_adjusted"):
    affected=set()
    materials={"Oak · furniture","Oak endgrain","Dark steel","Brushed brass","Warm stone · paths"}
    for face in obj.data.polygons:
        if obj.data.materials[face.material_index].name not in materials:continue
        for vi in face.vertices:
            vertex=obj.data.vertices[vi]
            if abs(vertex.co.x-.20)<.43 and -.65<vertex.co.y<-.25 and .70<vertex.co.z<2.0:
                affected.add(vi)
    for vi in affected:obj.data.vertices[vi].co.y-=.10
    obj.data.update();obj["v7_door_adjusted"]=True
    print("V7_DOOR_DEPTH_CORRECTED",len(affected),flush=True)
else:print("V7_DOOR_DEPTH_ALREADY_CORRECTED",flush=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"assets/world/archipelago-v7.blend"))
