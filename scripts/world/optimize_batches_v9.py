"""Group v9 understory by the existing ground pivot, preserving plant geometry."""
from pathlib import Path
import bpy,json

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world";OUT=ROOT/"public/experience/world"
manifest=json.loads((OUT/"manifest-v9.json").read_text(encoding="utf-8"))
changes=[]
for pid in manifest["pavilions"]:
    for kind,suffixes in (("leaves",("fern_understory","folhagem_tropical","grasses")),("flowers",("garden","heliconia","bromelia"))):
        names=["ambient_"+kind+"_"+pid+"_"+suffix for suffix in suffixes]
        objects=[bpy.data.objects.get(name) for name in names]
        if not all(objects):continue
        for obj in objects:
            for slot in obj.material_slots:
                if slot.material and slot.material.name=="v9 leaf glossy":slot.material=bpy.data.materials["Garden leaf deep"]
                elif slot.material and slot.material.name=="v9 leaf young":slot.material=bpy.data.materials["Garden sage"]
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        vertex_count=sum(len(obj.data.vertices) for obj in objects)
        polygon_count=sum(len(obj.data.polygons) for obj in objects)
        bpy.ops.object.join();obj=bpy.context.object
        obj.name="ambient_"+kind+"_"+pid+"_understory"
        obj["v9_foliage"]=True;obj["v8_island"]=pid;obj["v9_island"]=pid
        assert len(obj.data.vertices)==vertex_count and len(obj.data.polygons)==polygon_count
        changes.append({"island":pid,"from":names,"node":obj.name,"sharedGroundPivot":[round(v,4) for v in obj.location],"geometryCountsPreserved":True,"materials":[slot.material.name for slot in obj.material_slots if slot.material]})
for pid in manifest["pavilions"]:
    names=["ambient_leaves_"+pid+"_understory","ambient_flowers_"+pid+"_understory"]
    objects=[bpy.data.objects.get(name) for name in names]
    if not all(objects):continue
    assert all((obj.location-objects[0].location).length<.00001 for obj in objects)
    vertex_count=sum(len(obj.data.vertices) for obj in objects)
    polygon_count=sum(len(obj.data.polygons) for obj in objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();obj=bpy.context.object
    obj.name="ambient_leaves_"+pid+"_understory"
    obj["v9_foliage"]=True;obj["v8_island"]=pid;obj["v9_island"]=pid
    assert len(obj.data.vertices)==vertex_count and len(obj.data.polygons)==polygon_count
    changes.append({"island":pid,"from":names,"node":obj.name,"sharedGroundPivot":[round(v,4) for v in obj.location],"geometryCountsPreserved":True,"combinedLeavesAndFlowers":True})
manifest["ambientNodes"]=[o.name for o in bpy.context.scene.objects if o.type=="MESH" and o.name.startswith(("ambient_leaves_","ambient_flowers_"))]
(OUT/"manifest-v9.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
contract_path=SOURCE/"nodes-contract-v9.json";contract=json.loads(contract_path.read_text(encoding="utf-8"))
contract["foliageNodes"]=manifest["ambientNodes"];contract["batching"]="Tree pivots retained; leaves and flowers grouped by material per island at their existing common ground pivot"
contract_path.write_text(json.dumps(contract,ensure_ascii=False,indent=2),encoding="utf-8")
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v9.blend"),compress=True)
path=SOURCE/"build-report-v9.json";report=json.loads(path.read_text(encoding="utf-8"))
report.setdefault("batchOptimization",[]).extend(changes);report["ambientNodes"]=len(manifest["ambientNodes"])
report["worldMeshes"]=sum(o.type=="MESH" and o.name!="Poster shadow ground" for o in bpy.context.scene.objects)
report["render"]="Rerender pending after shader material grouping"
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("V9_BATCHES_OPTIMIZED",json.dumps({"groups":len(changes),"ambientNodes":len(manifest["ambientNodes"]),"worldMeshes":report["worldMeshes"]}),flush=True)
