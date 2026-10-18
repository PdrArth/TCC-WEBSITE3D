import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const ids=["pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas"];
function ancestry(object){const names=[];for(let node=object;node;node=node.parent)names.push(node.name);return names.join("/");}
function selectionId(names){return ids.find(id=>names.includes(`pavilion_${id}`)||names.includes(`island_${id}_foundation`))??null;}
function normalizedGeometry(source,matrix){
  const input=source.clone();
  input.applyMatrix4(matrix);
  const count=input.getAttribute("position").count;
  if(!input.index)input.setIndex(Array.from({length:count},(_,i)=>i));
  if(matrix.determinant()<0){const index=input.index;for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}}
  for(const [name,size,fill] of [["position",3,0],["normal",3,0],["uv",2,0],["uv1",2,0],["color",3,1]]){
    const raw=input.getAttribute(name), values=new Float32Array(count*size);
    if(raw)for(let i=0;i<count;i++)for(let axis=0;axis<size;axis++)values[i*size+axis]=axis===0?raw.getX(i):axis===1?raw.getY(i):raw.getZ(i);
    else values.fill(fill);
    input.setAttribute(name,new THREE.BufferAttribute(values,size));
  }
  for(const name of Object.keys(input.attributes))if(!["position","normal","uv","uv1","color"].includes(name))input.deleteAttribute(name);
  input.clearGroups();
  return input;
}

/** Batch only static geometry. Animated crowns and water retain their pivots. */
export function optimizeWorld(scene,quality="low"){
  const buckets=new Map(), sources=[], originals=new Set();
  scene.updateMatrixWorld(true);
  let originalPrimitives=0;
  scene.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh)return;
    originalPrimitives+=Array.isArray(mesh.material)?mesh.material.length:1;
    const names=ancestry(mesh);
    const dynamic=/ambient_|lake_water/.test(names);
    const lowUnderstory=quality==="low"&&/ambient_leaves_.*_understory/.test(names);
    if(dynamic&&!lowUnderstory){
      mesh.castShadow=quality==="high"&&!/understory|flowers/.test(names);
      mesh.receiveShadow=true;return;
    }
    // GLTFLoader splits multi-material primitives into children. Preserve the
    // unusual hand-authored multi-material case rather than corrupting groups.
    if(Array.isArray(mesh.material))return;
    const casts=/pavilion_|_wood/.test(names)&&(!/understory/.test(names));
    const cast=quality==="high"?casts:casts&&/Wall|Plaster|Sand|Terracotta|Sage|Blue|Olive|Ivory/i.test(mesh.material.name);
    const key=`${mesh.material.uuid}:${cast}`;
    if(!buckets.has(key))buckets.set(key,{material:mesh.material,cast,parts:[],ranges:[],triangles:0});
    const bucket=buckets.get(key),geometry=normalizedGeometry(mesh.geometry,mesh.matrixWorld);
    const triangles=geometry.index.count/3;
    bucket.ranges.push({start:bucket.triangles,end:bucket.triangles+triangles,id:selectionId(names)});
    bucket.triangles+=triangles;bucket.parts.push(geometry);sources.push(mesh);originals.add(mesh.geometry);
  });
  let mergedCount=0;
  for(const bucket of buckets.values()){
    const geometry=mergeGeometries(bucket.parts,false);
    for(const part of bucket.parts)part.dispose();
    if(!geometry)throw new Error("Static world batching failed");
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,bucket.material);
    mesh.name=`static_batch_${mergedCount++}`;mesh.castShadow=bucket.cast;mesh.receiveShadow=true;
    mesh.userData.pavilionRanges=bucket.ranges;
    scene.add(mesh);
  }
  for(const mesh of sources)mesh.removeFromParent();
  const retained=new Set();scene.traverse(mesh=>{if(mesh.isMesh)retained.add(mesh.geometry);});
  for(const geometry of originals)if(!retained.has(geometry))geometry.dispose();
  let primitives=0,triangles=0;
  scene.traverse(mesh=>{if(!mesh.isMesh)return;primitives+=Array.isArray(mesh.material)?mesh.material.length:1;triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute("position").count)/3;});
  scene.userData.optimization={originalPrimitives,primitives,triangles,batches:mergedCount,quality};
  return scene.userData.optimization;
}

export function selectedBatchPavilion(object,faceIndex){
  if(!Number.isInteger(faceIndex))return null;
  const range=object.userData?.pavilionRanges?.find(range=>faceIndex>=range.start&&faceIndex<range.end);
  return range?.id??null;
}
