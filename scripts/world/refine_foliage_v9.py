"""Observed v9 QA correction: fill sparse conifer/compound-leaf crowns in 3D."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world"
changes=[]
for obj in bpy.context.scene.objects:
    if obj.type!="MESH" or not obj.name.startswith("ambient_leaves_"):continue
    if not any(word in obj.name for word in ("araucaria","pau_brasil")):continue
    if obj.get("v9_crown_density_refined"):continue
    attr=obj.data.attributes.get("leaf_id")
    if attr is None:continue
    coords=[v.co.copy() for v in obj.data.vertices]
    faces=[tuple(p.vertices) for p in obj.data.polygons]
    material_indices=[p.material_index for p in obj.data.polygons]
    ids=[a.value for a in attr.data]
    groups={}
    for fi,value in enumerate(ids):
        if value>0:groups.setdefault(value,[]).append(fi)
    length_factor=1.27 if "araucaria" in obj.name else 1.34
    width_factor=2.5 if "araucaria" in obj.name else 1.9
    highest=max(groups);extra=0
    for uid,face_indices in groups.items():
        indices=sorted({vi for fi in face_indices for vi in faces[fi]})
        if len(indices)%3:continue
        root=(coords[indices[0]]+coords[indices[2]])/2
        for row in range(len(indices)//3):
            slots=indices[row*3:row*3+3]
            center=(coords[slots[0]]+coords[slots[2]])/2
            new_center=root+(center-root)*length_factor
            for vi in slots:coords[vi]=new_center+(coords[vi]-center)*width_factor
        if uid%2==0:
            # Whole blades on adjacent fine shoots, with varied yaw/elevation.
            offset=Vector((math.sin(uid*2.4)*.085,math.cos(uid*2.4)*.075,math.sin(uid*1.8)*.065))
            a=math.sin(uid*.73)*.27;c=math.cos(a);s=math.sin(a);mapping={}
            for vi in indices:
                delta=coords[vi]-root
                rotated=Vector((delta.x*c-delta.y*s,delta.x*s+delta.y*c,delta.z))
                mapping[vi]=len(coords);coords.append(root+rotated+offset)
            highest+=1
            for fi in face_indices:
                faces.append(tuple(mapping[vi] for vi in faces[fi]))
                material_indices.append(material_indices[fi]);ids.append(highest)
            extra+=1
    materials=list(obj.data.materials)
    data=bpy.data.meshes.new(obj.name+"_dense_v9")
    data.from_pydata(coords,[],faces);data.update()
    for mat in materials:data.materials.append(mat)
    attribute=data.attributes.new("leaf_id","INT","FACE")
    for face,mi,value in zip(data.polygons,material_indices,ids):
        face.material_index=mi;face.use_smooth=True;attribute.data[face.index].value=value
    col=data.color_attributes.new(name="Col",type="BYTE_COLOR",domain="CORNER")
    data.color_attributes.active_color=col;data.color_attributes.render_color_index=data.color_attributes.find("Col")
    for loop in data.loops:
        v=data.vertices[loop.vertex_index]
        shade=.93+.055*math.sin(v.co.x*2.6+v.co.y*2.1+v.co.z*3.8)
        col.data[loop.index].color=(shade,shade,shade,1)
    obj.data=data;obj["v9_crown_density_refined"]=True
    changes.append({"node":obj.name,"previousLeafSurfaces":len(groups),"addedWholeLeaves":extra,"leafSurfaces":len(groups)+extra,"lengthFactor":length_factor,"widthFactor":width_factor,"preservedOrigin":[round(v,4) for v in obj.location],"noClosedCrownMasses":True})
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"archipelago-v9.blend"),compress=True)
path=SOURCE/"build-report-v9.json";report=json.loads(path.read_text(encoding="utf-8"))
report["visualRefinements"]=changes
for record in report["trees"]:
    change=next((c for c in changes if c["node"]==record["canopy"]),None)
    if change:record["leafSurfaces"]=change["leafSurfaces"]
report["worldPolygons"]=sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=="MESH" and o.name!="Poster shadow ground")
report["render"]="Rerender pending after real crown density refinement"
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("V9_CROWNS_REFINED",json.dumps(changes),flush=True)
