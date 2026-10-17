"""Check shipped GLBs and the manifest without browser or provider dependencies."""
from pathlib import Path
import struct,json,math
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"public/experience/world"

def glb(name):
    data=(OUT/name).read_bytes()
    magic,version,length=struct.unpack_from("<III",data)
    assert magic==0x46546C67 and version==2 and length==len(data),f"Invalid GLB header: {name}"
    json_len,json_type=struct.unpack_from("<II",data,12)
    assert json_type==0x4E4F534A
    model=json.loads(data[20:20+json_len])
    return data,model

def accessor_values(data,model,index):
    accessor=model["accessors"][index]
    view=model["bufferViews"][accessor["bufferView"]]
    json_len=struct.unpack_from("<I",data,12)[0]
    binary_start=20+json_len+8
    components={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[accessor["type"]]
    assert accessor["componentType"]==5126
    offset=binary_start+view.get("byteOffset",0)+accessor.get("byteOffset",0)
    stride=view.get("byteStride",components*4)
    return [struct.unpack_from("<"+"f"*components,data,offset+i*stride) for i in range(accessor["count"])]

manifest=json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"]==1 and manifest["units"]=="meters" and manifest["upAxis"]=="Y"
assert set(manifest["pavilions"])=={"especificar","gerar","validar","evoluir"}
report={}
asset_names=[Path(manifest["assets"][key]).name for key in ("world","worldLow","avatar")]
for filename,limit in zip(asset_names,(8_000_000,4_000_000,600_000)):
    data,model=glb(filename)
    assert len(data)<=limit,f"{filename}: {len(data)} exceeds {limit}"
    named={node.get("name") for node in model["nodes"]}
    assert not any("uri" in img for img in model.get("images",[])),"Textures must be embedded"
    if filename!=asset_names[2]:
        for pavilion in manifest["pavilions"].values():
            assert pavilion["hitNode"] in named,f"Missing hit mesh {pavilion['hitNode']}"
            assert all(0<=n<=1 for n in pavilion["posterPoint"])
        assert set(manifest["ambientNodes"]).issubset(named)
        assert not "island_foundation" in named,"The former shared disk cannot remain in v6"
        for island in manifest["islands"].values():assert island["foundationNode"] in named
    else:
        animation_names={a.get("name") for a in model.get("animations",[])}
        assert {"Idle","Walk"}.issubset(animation_names),animation_names
        assert model.get("skins"),"Avatar rig must export a skin"
        # The root bone cannot translate in either clip. Walking is in-place.
        root_nodes={i for i,n in enumerate(model["nodes"]) if n.get("name")=="root"}
        for action in model["animations"]:
            for channel in action["channels"]:
                if channel["target"]["node"] in root_nodes and channel["target"]["path"]=="translation":
                    values=accessor_values(data,model,action["samplers"][channel["sampler"]]["output"])
                    assert all(all(abs(a-b)<1e-7 for a,b in zip(values[0],v)) for v in values),"Root motion found"
    tris=sum(model["accessors"][p["indices"]]["count"]//3 for m in model.get("meshes",[]) for p in m["primitives"] if p.get("mode",4)==4)
    report[filename]={"bytes":len(data),"triangles":tris,"meshes":len(model.get("meshes",[])),"textures":len(model.get("images",[])),"animations":[a.get("name") for a in model.get("animations",[])]}
nodes=manifest["navigation"]["nodes"]
assert any(n["position"]==manifest["spawn"] for n in nodes.values()),"Spawn graph node required"
adj={n:set() for n in nodes}
for a,b in manifest["navigation"]["edges"]:
    assert a in nodes and b in nodes and a!=b
    adj[a].add(b);adj[b].add(a)
visited=set();todo=["spawn"]
while todo:
    n=todo.pop()
    if n in visited:continue
    visited.add(n);todo.extend(adj[n]-visited)
assert len(visited)==len(nodes),"Disconnected paths"
for pid,n in manifest["navigation"]["destinations"].items():
    assert n in visited and nodes[n]["position"]==manifest["pavilions"][pid]["entry"]
assert manifest["navigation"]["mode"]=="direct"
islands=manifest["islands"]
for pid,island in islands.items():
    for other_id,other in islands.items():
        if pid==other_id:continue
        gap=math.hypot(island["center"][0]-other["center"][0],island["center"][2]-other["center"][2])-island["radius"]-other["radius"]
        assert gap>1,"Every content island needs a visible physical gap"
for target in manifest["weatherScenery"]["lightningTargets"]:
    for island in islands.values():assert math.hypot(target[0]-island["center"][0],target[2]-island["center"][2])>island["radius"]+2
report["navigation"]={"nodes":len(nodes),"edges":len(manifest["navigation"]["edges"]),"allDestinationsReachable":True,"mode":"direct","noAvatarLoaded":True}
report["islands"]={"count":len(islands),"allSeparated":True,"lightningOutsideContent":True}
report["poster"]={"exists":(OUT/Path(manifest["assets"]["poster"]).name).exists()}
(ROOT/"assets/world/verification-v6.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))
