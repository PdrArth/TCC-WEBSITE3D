import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import draco3d from "draco3d";
import { decodeSourceWorld, prepareRuntimeWorld, readGlb } from "../scripts/world/prepare-runtime-world.mjs";
import { optimizeWorld, selectedBatchPavilion } from "../components/island-experience/optimize-world.mjs";

const source=await readFile(new URL("../public/experience/world/archipelago-v9-low.glb",import.meta.url));
const prepared=await prepareRuntimeWorld(source,{provenance:true});
const {doc:input,bin:inputBin}=readGlb(source),{doc:output,bin:outputBin}=readGlb(prepared.bytes);
const draco=await draco3d.createDecoderModule({});
const loader=new GLTFLoader().setDRACOLoader({preload(){return this;},decodeDracoFile(buffer,onLoad,ids,types,space,onError){
  const decoder=new draco.Decoder(),mesh=new draco.Mesh();let status;
  try{
    status=decoder.DecodeArrayToMesh(new Uint8Array(buffer),buffer.byteLength,mesh);assert.ok(status.ok());
    const geometry=new THREE.BufferGeometry(),indexLength=mesh.num_faces()*3,ptr=draco._malloc(indexLength*4);
    try{decoder.GetTrianglesUInt32Array(mesh,indexLength*4,ptr);geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(draco.HEAPF32.buffer,ptr,indexLength).slice(),1));}finally{draco._free(ptr);}
    for(const [name,id]of Object.entries(ids)){
      const attribute=decoder.GetAttributeByUniqueId(mesh,id),Type=globalThis[types[name]],length=mesh.num_points()*attribute.num_components(),ptr=draco._malloc(length*Type.BYTES_PER_ELEMENT);
      try{decoder.GetAttributeDataArrayForAllPoints(mesh,attribute,Type===Float32Array?draco.DT_FLOAT32:Type===Uint16Array?draco.DT_UINT16:draco.DT_UINT32,length*Type.BYTES_PER_ELEMENT,ptr);geometry.setAttribute(name,new THREE.BufferAttribute(new Type(draco.HEAPF32.buffer,ptr,length).slice(),attribute.num_components()));}finally{draco._free(ptr);}
    }
    onLoad(geometry);
  }catch(error){onError(error);}finally{if(status)draco.destroy(status);draco.destroy(mesh);draco.destroy(decoder);}
}});
// Image decoding needs a browser; verify exact embedded image bytes separately.
loader.register(()=>({name:"PreparedWorldImageStub",loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const loaded=await loader.parseAsync(prepared.bytes.buffer.slice(prepared.bytes.byteOffset,prepared.bytes.byteOffset+prepared.bytes.byteLength),"");

test("offline preparation keeps material definitions, texture configuration and every image byte",()=>{
  assert.deepEqual(output.materials,input.materials);assert.deepEqual(output.textures,input.textures);assert.deepEqual(output.samplers,input.samplers);
  assert.equal(output.images.length,input.images.length);
  input.images.forEach((image,index)=>{
    const before=input.bufferViews[image.bufferView],after=output.bufferViews[output.images[index].bufferView];
    assert.equal(output.images[index].mimeType,image.mimeType);
    assert.deepEqual(outputBin.subarray(after.byteOffset,after.byteOffset+after.byteLength),inputBin.subarray(before.byteOffset,before.byteOffset+before.byteLength));
  });
});

test("cleanup removes only zero-area source triangles and preserves each pavilion's exact uncompressed surface",async()=>{
  const {scene}=await decodeSourceWorld(source);optimizeWorld(scene,"low");
  const inspect=world=>{
    const areas=new Map(),counts=new Map();let zero=0;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    world.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry,position=geometry.getAttribute("position");
      for(let face=0;face<geometry.index.count/3;face++){
        a.fromBufferAttribute(position,geometry.index.getX(face*3));b.fromBufferAttribute(position,geometry.index.getX(face*3+1));c.fromBufferAttribute(position,geometry.index.getX(face*3+2));
        const area=b.sub(a).cross(c.sub(a)).length()/2;if(area===0){zero++;continue;}
        const id=selectedBatchPavilion(mesh,face);areas.set(id,(areas.get(id)??0)+area);counts.set(id,(counts.get(id)??0)+1);
      }
    });return {areas,counts,zero};
  };
  const before=inspect(scene),after=inspect(prepared.scene);
  assert.equal(before.zero,8117);assert.equal(after.zero,0);assert.deepEqual(after.counts,before.counts);
  for(const [id,area]of before.areas)assert.ok(Math.abs(after.areas.get(id)-area)<1e-9);
});

test("actual GLTFLoader retains every oriented triangle, its pavilion, pivots and precision",()=>{
  assert.equal(loaded.scene.userData.runtimePrepared.version,1);assert.equal(loaded.scene.userData.runtimePrepared.quality,"low");
  assert.deepEqual(loaded.scene.userData.optimization,prepared.scene.userData.optimization);
  let triangles=0,meshCount=0,seeds=0;
  const compare=(expected,actual)=>{
    if(expected.name)assert.equal(actual.name,expected.name);
    assert.deepEqual(actual.position.toArray(),expected.position.toArray());assert.deepEqual(actual.quaternion.toArray(),expected.quaternion.toArray());assert.deepEqual(actual.scale.toArray(),expected.scale.toArray());
    assert.equal(actual.children.length,expected.children.length);
    if(expected.isMesh){
      meshCount++;triangles+=actual.geometry.index.count/3;
      assert.equal(actual.geometry.index.count,expected.geometry.index.count);
      const sourceIds=actual.geometry.getAttribute("_source_vertex");assert.ok(sourceIds);
      const canonical=indices=>{const first=indices.indexOf(Math.min(...indices));return [...indices.slice(first),...indices.slice(0,first)].join(",");};
      const faces=new Map();
      for(let i=0;i<expected.geometry.index.count;i+=3){const key=canonical([0,1,2].map(c=>expected.geometry.index.getX(i+c))),list=faces.get(key)??[];list.push(selectedBatchPavilion(expected,i/3));faces.set(key,list);}
      for(let i=0;i<actual.geometry.index.count;i+=3){
        const vertices=[0,1,2].map(c=>actual.geometry.index.getX(i+c)),key=canonical(vertices.map(v=>sourceIds.getX(v))),list=faces.get(key);
        assert.ok(list?.length,"decoded face has no matching oriented source triangle");
        const id=list.pop();if(expected.userData.pavilionRanges){assert.equal(selectedBatchPavilion(actual,i/3),id);for(const v of vertices)assert.equal(actual.geometry.getAttribute("_pavilion_id").getX(v),id?["pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas"].indexOf(id)+1:0);}
      }
      assert.ok([...faces.values()].every(list=>list.length===0));
      for(const [name,before]of Object.entries(expected.geometry.attributes)){
        const after=actual.geometry.getAttribute(name==="seasonalSeed"?"_seasonal_seed":name==="sourceVertex"?"_source_vertex":name==="pavilionId"?"_pavilion_id":name);
        assert.ok(after,`missing ${name}`);assert.equal(after.count,sourceIds.count);assert.equal(after.itemSize,before.itemSize);assert.equal(after.normalized,before.normalized);
        const tolerance=name==="position"?.001:name==="normal"?.002:name==="uv"||name==="uv1"?.0001:name==="color"?.001:0;
        for(let i=0;i<after.count;i++){
          const sourceIndex=sourceIds.getX(i);assert.ok(Number.isInteger(sourceIndex)&&sourceIndex>=0&&sourceIndex<before.count);
          let error=0;for(let axis=0;axis<before.itemSize;axis++)error+=(after.getComponent(i,axis)-before.getComponent(sourceIndex,axis))**2;
          assert.ok(Math.sqrt(error)<=tolerance,`${name} error ${Math.sqrt(error)} at ${i} exceeds ${tolerance}`);
        }
        if(name==="seasonalSeed")seeds++;
      }
      assert.equal(actual.userData.runtimeCastShadow,expected.castShadow);assert.equal(actual.userData.runtimeReceiveShadow,expected.receiveShadow);
      if(expected.userData.pavilionRanges){
        for(const range of actual.userData.pavilionRanges){assert.equal(selectedBatchPavilion(actual,range.start),range.id);assert.equal(selectedBatchPavilion(actual,range.end-1),range.id);}
      }
    }
    expected.children.forEach((child,index)=>compare(child,actual.children[index]));
  };
  assert.equal(prepared.scene.children.length,loaded.scene.children.length);
  prepared.scene.children.forEach((child,index)=>compare(child,loaded.scene.children[index]));
  assert.equal(triangles,310670);assert.equal(triangles+prepared.report.removedZeroAreaFaces,318787);assert.equal(meshCount,98);assert.equal(seeds,45);
});

test("the shipped asset stays below 4 MB and retains pavilion areas, bounds, selection and foliage precision",async()=>{
  const bytes=await readFile(new URL("../public/experience/world/archipelago-v19-low.glb",import.meta.url));
  assert.ok(bytes.length<=4_000_000);const {doc}=readGlb(bytes);
  assert.ok(doc.meshes.every(mesh=>mesh.primitives.every(p=>p.attributes._SOURCE_VERTEX===undefined)));
  assert.deepEqual(doc.materials,input.materials);assert.deepEqual(doc.textures,input.textures);assert.deepEqual(doc.samplers,input.samplers);
  const final=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
  const expectedMeshes=[],actualMeshes=[];prepared.scene.traverse(o=>{if(o.isMesh)expectedMeshes.push(o);});final.scene.traverse(o=>{if(o.isMesh)actualMeshes.push(o);});
  assert.equal(actualMeshes.length,98);assert.equal(actualMeshes.length,expectedMeshes.length);
  const areasBefore=new Map(),areasAfter=new Map(),countsBefore=new Map(),countsAfter=new Map();
  const accumulate=(mesh,areas,counts)=>{
    const geometry=mesh.geometry,position=geometry.getAttribute("position"),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let face=0;face<geometry.index.count/3;face++){
      const id=selectedBatchPavilion(mesh,face);a.fromBufferAttribute(position,geometry.index.getX(face*3));b.fromBufferAttribute(position,geometry.index.getX(face*3+1));c.fromBufferAttribute(position,geometry.index.getX(face*3+2));
      const area=b.sub(a).cross(c.sub(a)).length()/2;areas.set(id,(areas.get(id)??0)+area);counts.set(id,(counts.get(id)??0)+1);
      const attribute=geometry.getAttribute("_pavilion_id");if(attribute){const value=attribute.getX(geometry.index.getX(face*3));assert.equal(value,id?["pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas"].indexOf(id)+1:0);assert.equal(attribute.getX(geometry.index.getX(face*3+1)),value);assert.equal(attribute.getX(geometry.index.getX(face*3+2)),value);}
    }
  };
  const cell=.001,key=(x,y,z)=>`${x},${y},${z}`;
  for(let m=0;m<actualMeshes.length;m++){
    const before=expectedMeshes[m],after=actualMeshes[m],position=before.geometry.getAttribute("position"),actual=after.geometry.getAttribute("position"),buckets=new Map();
    assert.equal(after.geometry.index.count,before.geometry.index.count);accumulate(before,areasBefore,countsBefore);accumulate(after,areasAfter,countsAfter);
    for(let i=0;i<position.count;i++){const hash=key(Math.floor(position.getX(i)/cell),Math.floor(position.getY(i)/cell),Math.floor(position.getZ(i)/cell)),items=buckets.get(hash)??[];items.push(i);buckets.set(hash,items);}
    const attributes=Object.entries(before.geometry.attributes).filter(([name])=>name!=="sourceVertex").map(([name,attribute])=>({before:attribute,after:after.geometry.getAttribute(name==="seasonalSeed"?"_seasonal_seed":name==="pavilionId"?"_pavilion_id":name),tolerance:name==="position"?.001:name==="normal"?.002:name==="uv"||name==="uv1"?.0001:name==="color"?.001:0}));
    assert.ok(attributes.every(a=>a.after));
    for(let i=0;i<actual.count;i++){
      const x=Math.floor(actual.getX(i)/cell),y=Math.floor(actual.getY(i)/cell),z=Math.floor(actual.getZ(i)/cell);let matched=false;
      search:for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const sourceIndex of buckets.get(key(x+dx,y+dy,z+dz))??[]){
        if(attributes.every(attribute=>{let error=0;for(let axis=0;axis<attribute.before.itemSize;axis++)error+=(attribute.after.getComponent(i,axis)-attribute.before.getComponent(sourceIndex,axis))**2;return Math.sqrt(error)<=attribute.tolerance;})){matched=true;break search;}
      }
      assert.ok(matched,`final mesh ${m} vertex ${i} changed beyond approved precision or lost its exact seasonal seed`);
    }
    before.geometry.computeBoundingBox();after.geometry.computeBoundingBox();
    assert.ok(before.geometry.boundingBox.min.distanceTo(after.geometry.boundingBox.min)<=.0011);assert.ok(before.geometry.boundingBox.max.distanceTo(after.geometry.boundingBox.max)<=.0011);
  }
  assert.deepEqual(countsAfter,countsBefore);
  for(const [id,area]of areasBefore)assert.ok(Math.abs(areasAfter.get(id)-area)<=Math.max(.02,area*.001),`area changed for ${id}`);
});
