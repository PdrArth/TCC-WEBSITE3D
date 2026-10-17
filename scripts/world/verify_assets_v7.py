"""Verify real GLBs, all seven destinations, image provenance and LOD invariants."""
from pathlib import Path
import struct, json, math, hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/"public/experience/world"
IDS=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
manifest=json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"]==1 and manifest["units"]=="meters" and manifest["upAxis"]=="Y"
assert tuple(manifest["pavilions"])==IDS
assert tuple(manifest["islands"])==IDS
report={"version":7,"models":{},"images":{}}
for key,limit in (("world",8*1024*1024),("worldLow",4*1024*1024)):
    path=ROOT/"public"/manifest["assets"][key].lstrip("/");data=path.read_bytes()
    magic,version,length=struct.unpack_from("<III",data)
    assert magic==0x46546c67 and version==2 and length==len(data)
    assert len(data)<=limit,(path.name,len(data),limit)
    size,chunk=struct.unpack_from("<II",data,12);assert chunk==0x4E4F534A
    model=json.loads(data[20:20+size])
    assert not model.get("skins") and not model.get("animations"),"World excludes the avatar and animations"
    names={node.get("name") for node in model["nodes"]}
    assert "island_foundation" not in names
    for pid in IDS:
        assert manifest["pavilions"][pid]["hitNode"] in names
        assert manifest["islands"][pid]["foundationNode"] in names
    assert set(manifest["ambientNodes"]).issubset(names)
    assert not any("uri" in image for image in model.get("images",[])),"Textures are embedded"
    primitives=[p for mesh in model["meshes"] for p in mesh["primitives"]]
    assert all("COLOR_0" in p["attributes"] for p in primitives),"Vertex shade must survive both LODs"
    triangles=sum(model["accessors"][p["indices"]]["count"]//3 for p in primitives)
    report["models"][key]={"filename":path.name,"bytes":len(data),"triangles":triangles,"meshes":len(model["meshes"]),"primitives":len(primitives),"vertexColoredPrimitives":len(primitives),"materials":len(model.get("materials",[])),"textures":len(model.get("images",[])),"sha256":hashlib.sha256(data).hexdigest(),"noAvatar":True,"allSevenHitNodes":True}
    if key=="world":high_names=names
    else:assert names==high_names,"Both LODs keep exactly the same authored object names"
islands=manifest["islands"];gaps=[]
for i,pid in enumerate(IDS):
    a=islands[pid]
    for other_id in IDS[i+1:]:
        b=islands[other_id];gap=math.hypot(a["center"][0]-b["center"][0],a["center"][2]-b["center"][2])-a["radius"]-b["radius"]
        assert gap>1,(pid,other_id,gap);gaps.append(gap)
for target in manifest["weatherScenery"]["lightningTargets"]:
    for pid,island in islands.items():
        distance=math.hypot(target[0]-island["center"][0],target[2]-island["center"][2])
        assert distance>island["radius"]+2,(pid,target,distance)
nodes=manifest["navigation"]["nodes"];adj={name:set() for name in nodes}
assert nodes["spawn"]["position"]==manifest["spawn"]
for a,b in manifest["navigation"]["edges"]:
    assert a in nodes and b in nodes and a!=b;adj[a].add(b);adj[b].add(a)
visited=set();todo=["spawn"]
while todo:
    node=todo.pop()
    if node in visited:continue
    visited.add(node);todo.extend(adj[node]-visited)
assert visited==set(nodes)
for pid in IDS:
    node=manifest["navigation"]["destinations"][pid]
    assert node in visited and nodes[node]["position"]==manifest["pavilions"][pid]["entry"]
    assert all(math.isfinite(v) for v in nodes[node]["position"])
    assert all(0<=v<=1 for v in manifest["pavilions"][pid]["posterPoint"])
assert manifest["navigation"]["mode"]=="direct"
for pid in (*IDS,"poster"):
    url=manifest["assets"]["poster"] if pid=="poster" else manifest["pavilions"][pid]["editorial"]
    path=ROOT/"public"/url.lstrip("/")
    assert path.exists() and path.stat().st_size>1000,(pid,path)
    report["images"][pid]={"url":url,"bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
    if pid!="poster":assert (ROOT/"public"/manifest["pavilions"][pid]["thumbnail"].lstrip("/")).exists()
report["navigation"]={"mode":"direct","nodes":len(nodes),"allSevenDestinationsReachable":True,"noAvatarLoaded":True}
report["islands"]={"count":7,"minimumPhysicalGap":round(min(gaps),5),"lightningOutsideContent":True}
report["ambientCanopies"]=len(manifest["ambientNodes"])
(ROOT/"assets/world/verification-v7.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))
