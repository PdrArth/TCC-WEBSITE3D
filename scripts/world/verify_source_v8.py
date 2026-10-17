"""Read-only checks of preserved furniture, physical bridges and plant pivots."""
from pathlib import Path
import bpy, json, hashlib, struct, math
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
manifest = json.loads((ROOT / "public/experience/world/manifest-v8.json").read_text(encoding="utf-8"))
world = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}

def geometry_hash(obj):
    digest = hashlib.sha256()
    for v in obj.data.vertices: digest.update(struct.pack("<fff", *v.co))
    for face in obj.data.polygons:
        digest.update(struct.pack("<I", len(face.vertices)))
        digest.update(struct.pack("<" + "I" * len(face.vertices), *face.vertices))
    return digest.hexdigest()

names = ["pavilion_" + pid for pid in manifest["pavilions"]]
with bpy.data.libraries.load(str(SOURCE / "archipelago-v7.blend"), link=False) as (data_from, data_to):
    data_to.objects = list(names)
preserved = {}
for name, old in zip(names, data_to.objects):
    current = world[name]
    a, b = geometry_hash(old), geometry_hash(current)
    assert a == b, name
    preserved[name] = {"sha256": a, "vertices": len(current.data.vertices), "polygons": len(current.data.polygons), "identicalToV7": True}

bridges = []
for record in manifest["bridges"]:
    minimum = float("inf")
    for name in record["nodes"]:
        obj = world[name]
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            for pid, island in manifest["islands"].items():
                center = island["center"]
                distance = math.hypot(point.x - center[0], point.y + center[2])
                minimum = min(minimum, distance)
    # A2.5m radius contains every furnished pavilion terrace; compare actual
    # bridge geometry against every pavilion, not just the connected pair.
    assert minimum > 3.3, (record, minimum)
    bridges.append({"from": record["from"], "to": record["to"], "minimumDistanceToAnyPavilionCenter": round(minimum, 5), "outsideEveryPavilionTerrace": True})

pivots = {}
for name in manifest["ambientNodes"]:
    obj = world[name]
    assert obj.type == "MESH" and not any(part in name for part in ("wood", "trunk", "pavilion", "foundation"))
    point = obj.matrix_world.translation
    assert point.z >= .065
    pivots[name] = {"positionBlender": [round(v, 5) for v in point], "leavesOrFlowersOnly": True}
water = world["lake_water"]
zs = [v.co.z for v in water.data.vertices]
assert max(zs) - min(zs) < .00001
assert abs(water.location.z + .16) < .00001
report = {"version": 8, "passed": True, "source": "assets/world/archipelago-v8.blend", "pavilions": preserved, "bridges": bridges, "ambient": pivots, "water": {"planar": True, "sourceLocalPlane": "XY", "gltfLocalPlane": "XZ", "height": -.16}, "botanicalModelsIllustrative": True}
(SOURCE / "verification-source-v8.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("V8_SOURCE_VERIFICATION", json.dumps({"passed": True, "furniturePreserved": len(preserved), "physicalBridgeClearances": len(bridges), "independentPlantPivots": len(pivots)}), flush=True)
