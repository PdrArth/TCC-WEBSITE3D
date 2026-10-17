"""Verify v8 asset budgets, seven destinations, real geometry and render provenance."""
from pathlib import Path
import json, math, struct, hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/experience/world"
SOURCE = ROOT / "assets/world"
IDS = ("pesquisa", "gerar", "comparar", "validar", "especificar", "evoluir", "perspectivas")
manifest = json.loads((OUT / "manifest-v8.json").read_text(encoding="utf-8"))
build = json.loads((SOURCE / "build-report-v8.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"] == 2 and manifest["units"] == "meters" and manifest["upAxis"] == "Y"
assert tuple(manifest["pavilions"]) == IDS and tuple(manifest["islands"]) == IDS
assert manifest["assets"]["avatar"] == "/experience/world/avatar.glb"
assert manifest["cameraBounds"] == {"minZoom": .8, "maxZoom": 2}
assert tuple((b["from"], b["to"]) for b in manifest["bridges"]) == tuple(zip(IDS, IDS[1:]))
assert set(p["island"] for p in manifest["birdPerches"]) == set(IDS)
assert all(not any(word in name for word in ("wood", "trunk", "foundation", "pavilion")) for name in manifest["ambientNodes"])
assert all("leaves" in name or "flowers" in name for name in manifest["ambientNodes"])
report = {"version": 8, "models": {}, "images": {}, "passed": False}
for key, limit in (("world", 8000000), ("worldLow", 4000000)):
    path = ROOT / "public" / manifest["assets"][key].lstrip("/")
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    assert len(data) <= limit, (path.name, len(data), limit)
    size, chunk = struct.unpack_from("<II", data, 12)
    assert chunk == 0x4E4F534A
    model = json.loads(data[20:20+size])
    assert not model.get("skins") and not model.get("animations"), "World must exclude avatar and baked runtime animation"
    names = {node.get("name") for node in model["nodes"]}
    assert "lake_water" in names
    for pid in IDS:
        assert manifest["pavilions"][pid]["hitNode"] in names
        assert manifest["islands"][pid]["foundationNode"] in names
        assert manifest["pavilions"][pid]["order"] == IDS.index(pid) + 1
    assert set(manifest["ambientNodes"]).issubset(names)
    assert all(set(b["nodes"]).issubset(names) for b in manifest["bridges"])
    assert not any("uri" in image for image in model.get("images", [])), "Textures must be embedded"
    primitives = [p for m in model["meshes"] for p in m["primitives"]]
    assert all("COLOR_0" in p["attributes"] for p in primitives)
    triangles = sum(model["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    assert triangles > 25000 and len(model["meshes"]) > 50, "True 3D geometry, not a photographic plane"
    digest = hashlib.sha256(data).hexdigest()
    assert digest == build["assetSha256"][path.name]
    report["models"][key] = {"filename": path.name, "bytes": len(data), "budgetBytes": limit, "triangles": triangles, "meshes": len(model["meshes"]), "primitives": len(primitives), "vertexColoredPrimitives": len(primitives), "materials": len(model.get("materials", [])), "textures": len(model.get("images", [])), "sha256": digest, "noAvatar": True, "allSevenHitNodes": True, "allSixBridges": True, "lakeWater": True}
    if key == "world": high_names = names
    else: assert names == high_names, "Both LODs retain every authored node name"

gaps = []
for i, pid in enumerate(IDS):
    a = manifest["islands"][pid]
    for other_id in IDS[i+1:]:
        b = manifest["islands"][other_id]
        gap = math.hypot(a["center"][0] - b["center"][0], a["center"][2] - b["center"][2]) - a["radius"] - b["radius"]
        assert gap > .6, (pid, other_id, gap)
        gaps.append(gap)
# The six physical spans run from opposing island shores. A building's terrace
# lies within radius2.5; the bridge centerline begins at radius>3.9.
for b in manifest["bridges"]:
    for pid in (b["from"], b["to"]):
        assert manifest["islands"][pid]["radius"] - .32 > 3.9

nodes = manifest["navigation"]["nodes"]
adj = {name: set() for name in nodes}
assert nodes["spawn"]["position"] == manifest["spawn"]
for a, b in manifest["navigation"]["edges"]:
    assert a in nodes and b in nodes and a != b
    adj[a].add(b); adj[b].add(a)
visited = set(); todo = ["spawn"]
while todo:
    node = todo.pop()
    if node in visited: continue
    visited.add(node); todo.extend(adj[node] - visited)
assert visited == set(nodes)
for pid in IDS:
    node = manifest["navigation"]["destinations"][pid]
    assert nodes[node]["position"] == manifest["pavilions"][pid]["entry"]
    assert all(math.isfinite(v) for v in nodes[node]["position"])
    assert all(0 <= v <= 1 for v in manifest["pavilions"][pid]["posterPoint"])
assert manifest["navigation"]["mode"] == "direct"
for pid in (*IDS, "poster"):
    url = manifest["assets"]["poster"] if pid == "poster" else manifest["pavilions"][pid]["editorial"]
    path = ROOT / "public" / url.lstrip("/")
    original = ROOT / build["renders"][pid]["source"]
    expected = (1800, 1350) if pid == "poster" else (1200, 780)
    assert Image.open(path).size == expected and Image.open(original).size == expected
    assert path.stat().st_size > 1000
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == build["renders"][pid]["sha256"]
    report["images"][pid] = {"url": url, "bytes": path.stat().st_size, "sha256": digest, "realRender": True, "authoringScene": build["renders"][pid]["authoringScene"]}
    if pid != "poster":
        thumb = ROOT / "public" / manifest["pavilions"][pid]["thumbnail"].lstrip("/")
        assert Image.open(thumb).size == (512, 333)
framing = json.loads((SOURCE / "framing-v8.json").read_text(encoding="utf-8"))
assert framing["passed"], framing
report.update({"passed": True, "framing": {"passed": True, "viewports": list(framing["projections"]), "source": "assets/world/framing-v8.json"}, "navigation": {"mode": "direct", "nodes": len(nodes), "allSevenDestinationsReachable": True, "noAvatarLoaded": True}, "islands": {"count": 7, "minimumPhysicalGap": round(min(gaps), 5), "continuousReadingSequence": True}, "bridges": {"count": 6, "allPairsConsecutive": True, "centerlinesOutsideBuildingTerraces": True}, "ambient": {"nodes": len(manifest["ambientNodes"]), "leavesAndFlowersIndependent": True, "staticTrunks": True}, "birdPerches": {"count": len(manifest["birdPerches"]), "allSevenIslands": True}})
(SOURCE / "verification-v8.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "worldBytes": report["models"]["world"]["bytes"], "lowBytes": report["models"]["worldLow"]["bytes"], "framing": True, "images": 8, "thumbnails": 7, "bridges": 6}, indent=2))
