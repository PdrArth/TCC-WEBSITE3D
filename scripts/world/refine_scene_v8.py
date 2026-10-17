"""Correct observed foliage density without rebuilding the approved v8 layout."""
from pathlib import Path
import bpy, json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
changed = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH": continue
    if obj.name.startswith("ambient_leaves_") and "palmeira" in obj.name and not obj.get("v8_palm_blade_refined"):
        attribute = obj.data.attributes.get("leaf_id")
        groups = {}
        if attribute:
            for face in obj.data.polygons:
                value = attribute.data[face.index].value
                if value > 0: groups.setdefault(value, set()).update(face.vertices)
            corrected = 0
            for indices in groups.values():
                if len(indices) != 4: continue
                indices = sorted(indices)
                left = obj.data.vertices[indices[1]]
                right = obj.data.vertices[indices[3]]
                center = (left.co + right.co) / 2
                left.co = center + (left.co - center) * 2.4
                right.co = center + (right.co - center) * 2.4
                corrected += 1
            obj.data.update()
            obj["v8_palm_blade_refined"] = True
            changed.append({"node": obj.name, "wholeLeafletsWidened": corrected, "factor": 2.4, "polygonsAdded": 0})
    if obj.name.startswith("ambient_flowers_") and any(word in obj.name for word in ("ipe_amarelo", "ipe_roxo", "quaresmeira")):
        material_name = "Flower ipe gold" if "ipe_amarelo" in obj.name else ("Flower ipe rose" if "ipe_roxo" in obj.name else "Flower quaresmeira")
        for slot in obj.material_slots:
            if slot.material and slot.material.name == "Flower ivory": slot.material = bpy.data.materials[material_name]
        changed.append({"node": obj.name, "flowerMaterial": material_name})
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "archipelago-v8.blend"), compress=True)
path = SOURCE / "build-report-v8.json"
report = json.loads(path.read_text(encoding="utf-8"))
report["visualRefinement"] = changed
report["render"] = "Full source rerender pending after observed palm blade density refinement"
path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("V8_FOLIAGE_REFINED", json.dumps(changed), flush=True)
