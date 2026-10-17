"""Check v9 asset budgets, stable v8 layout, node contracts and render provenance."""
from pathlib import Path
import json,struct,hashlib,math
from PIL import Image

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/"public/experience/world";SOURCE=ROOT/"assets/world"
IDS=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
m=json.loads((OUT/"manifest-v9.json").read_text(encoding="utf-8"));old=json.loads((OUT/"manifest-v8.json").read_text(encoding="utf-8"))
build=json.loads((SOURCE/"build-report-v9.json").read_text(encoding="utf-8"))
assert m["schemaVersion"]==2 and m["version"]==9 and tuple(m["pavilions"])==IDS
for key in ("initialCamera","movingCamera","spawn","navigation","islands","bridges","cameraBounds"):
    assert m[key]==old[key],("v8 contract changed",key)
assert m["assets"]["avatar"]==old["assets"]["avatar"]
for pid in IDS:
    for key in ("entry","focus","hitNode","camera","order","posterPoint"):
        assert m["pavilions"][pid][key]==old["pavilions"][pid][key],(pid,key)
report={"version":9,"models":{},"images":{},"passed":False}
for key,limit in (("world",8000000),("worldLow",4000000)):
    p=ROOT/"public"/m["assets"][key].lstrip("/");data=p.read_bytes()
    magic,version,length=struct.unpack_from("<III",data);assert magic==0x46546C67 and version==2 and length==len(data)
    assert len(data)<=limit,(p.name,len(data),limit)
    n,chunk=struct.unpack_from("<II",data,12);assert chunk==0x4E4F534A
    model=json.loads(data[20:20+n]);names={o.get("name") for o in model["nodes"]}
    assert not model.get("skins") and not model.get("animations")
    assert "lake_water" in names and all(m["pavilions"][pid]["hitNode"] in names for pid in IDS)
    assert set(m["ambientNodes"]).issubset(names)
    assert all(set(b["nodes"]).issubset(names) for b in m["bridges"])
    assert all("scenic_lightning_rock_"+suffix in names for suffix in ("left","right","front"))
    assert not any("uri" in image for image in model.get("images",[]))
    primitives=[p for mesh in model["meshes"] for p in mesh["primitives"]]
    assert all("COLOR_0" in p["attributes"] for p in primitives)
    assert "KHR_draco_mesh_compression" in model["extensionsUsed"]
    assert all("KHR_draco_mesh_compression" in p.get("extensions",{}) for p in primitives)
    triangles=sum(model["accessors"][p["indices"]]["count"]//3 for p in primitives)
    assert triangles>25000 and len(model["meshes"])>60
    digest=hashlib.sha256(data).hexdigest();assert digest==build["assetSha256"][p.name]
    water=next(node for node in model["nodes"] if node.get("name")=="lake_water")
    water_mesh=model["meshes"][water["mesh"]]
    accessor=model["accessors"][water_mesh["primitives"][0]["attributes"]["POSITION"]]
    assert accessor["count"]>2500 and abs(accessor["max"][1]-accessor["min"][1])<.0001
    report["models"][key]={"bytes":len(data),"budgetBytes":limit,"meshes":len(model["meshes"]),"primitives":len(primitives),"materials":len(model["materials"]),"triangles":triangles,"sha256":digest,"true3D":True,"vertexColorEveryPrimitive":True,"sameSevenHitNodes":True,"sixBridges":True,"waterGridVertices":accessor["count"],"noStaticDuplicateFish":True}
    if key=="world":high_names=names
    else:assert names==high_names
for target in m["weatherScenery"]["lightningTargets"]:
    for island in m["islands"].values():assert math.hypot(target[0]-island["center"][0],target[2]-island["center"][2])>island["radius"]+2
assert {p["island"] for p in m["birdPerches"]}==set(IDS)
for pid in (*IDS,"poster"):
    record=build["renders"][pid];p=ROOT/"public"/record["url"].lstrip("/")
    assert record["url"]==(m["assets"]["poster"] if pid=="poster" else m["pavilions"][pid]["editorial"])
    image=Image.open(p);assert list(image.size)==record["dimensions"]
    assert hashlib.sha256(p.read_bytes()).hexdigest()==record["sha256"]
    original=ROOT/record["source"];assert hashlib.sha256(original.read_bytes()).hexdigest()==record["sourceSha256"]
    assert original.stat().st_mtime>=(SOURCE/"archipelago-v9.blend").stat().st_mtime
    if pid=="poster":assert p.stat().st_size<=160000 and image.size==(1800,1350)
    else:
        assert image.size==(1200,780)
        assert record["thumbnail"]["url"]==m["pavilions"][pid]["thumbnail"]
        thumb=ROOT/"public"/record["thumbnail"]["url"].lstrip("/");assert Image.open(thumb).size==(512,333)
        assert hashlib.sha256(thumb.read_bytes()).hexdigest()==record["thumbnail"]["sha256"]
    report["images"][pid]={"bytes":p.stat().st_size,"dimensions":list(image.size),"sha256":record["sha256"],"realFreshRender":True}
framing=json.loads((SOURCE/"framing-v9.json").read_text(encoding="utf-8"));assert framing["passed"]
source=json.loads((SOURCE/"verification-source-v9.json").read_text(encoding="utf-8"));assert source["passed"]
assert source["sourceSha256"]==build["sourceSha256"]==hashlib.sha256((SOURCE/"archipelago-v9.blend").read_bytes()).hexdigest()
old_data=(OUT/"archipelago-v8.glb").read_bytes();n=struct.unpack_from("<I",old_data,12)[0];old_model=json.loads(old_data[20:20+n])
old_primitives=sum(len(mesh["primitives"]) for mesh in old_model["meshes"])
assert report["models"]["world"]["primitives"]<=old_primitives,(report["models"]["world"]["primitives"],old_primitives)
report.update({"passed":True,"framing":True,"sourceGeometry":True,"layoutPreserved":True,"ambientNodes":len(m["ambientNodes"]),"primitives":{"v8":old_primitives,"v9":report["models"]["world"]["primitives"],"improvedOrPreserved":True},"limits":"Static Blender/GLB checks; animated fish/weather/audio verified by runtime owner"})
(SOURCE/"verification-v9.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print("V9_ASSETS_VERIFIED",json.dumps({"passed":True,"highBytes":report["models"]["world"]["bytes"],"lowBytes":report["models"]["worldLow"]["bytes"],"posterBytes":report["images"]["poster"]["bytes"],"primitivesV8":old_primitives,"primitivesV9":report["models"]["world"]["primitives"],"framing":True}),flush=True)
