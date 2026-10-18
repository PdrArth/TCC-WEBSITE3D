/** Offline browser batching, with Draco and selection ranges rebuilt after decoding. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import draco3d from "draco3d";
import * as THREE from "three";
import { optimizeWorld } from "../../src/components/island-experience/optimize-world.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const attributeNames = { POSITION:"position", NORMAL:"normal", TEXCOORD_0:"uv", TEXCOORD_1:"uv1", COLOR_0:"color", _SEASONAL_SEED:"seasonalSeed", _PAVILION_ID:"pavilionId", _SOURCE_VERTEX:"sourceVertex" };
const pavilionIds=["pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas"];
const semanticNames = Object.fromEntries(Object.entries(attributeNames).map(([semantic,name])=>[name,semantic]));
const decoderTask = draco3d.createDecoderModule({});
const encoderTask = draco3d.createEncoderModule({});

export function readGlb(bytes) {
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw new Error("Expected GLB 2");
  const length=bytes.readUInt32LE(12);
  return {doc:JSON.parse(bytes.subarray(20,20+length).toString("utf8")),bin:bytes.subarray(28+length)};
}

/** Decode authored primitives without images or GPU work; materials retain document identity. */
export async function decodeSourceWorld(bytes) {
  const {doc,bin}=readGlb(bytes),draco=await decoderTask;
  if(doc.animations?.length||doc.skins?.length)throw new Error("Animated/skinned source requires a separate preparation contract");
  const materials=doc.materials.map((m,index)=>{const material=new THREE.MeshStandardMaterial({name:m.name});material.userData.sourceMaterial=index;return material;});
  const nodes=doc.nodes.map((node,index)=>{
    if(node.extensions)throw new Error("Unsupported node extension");
    const group=new THREE.Group();group.name=node.name??"";group.userData={...node.extras,sourceNode:index};
    if(node.matrix)group.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    else {if(node.translation)group.position.fromArray(node.translation);if(node.rotation)group.quaternion.fromArray(node.rotation);if(node.scale)group.scale.fromArray(node.scale);}
    if(node.mesh!==undefined)for(const primitive of doc.meshes[node.mesh].primitives){
      const ext=primitive.extensions?.KHR_draco_mesh_compression;
      if(!ext||(primitive.mode??4)!==4||primitive.targets)throw new Error("Expected static Draco triangles");
      const view=doc.bufferViews[ext.bufferView],input=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
      const decoder=new draco.Decoder(),mesh=new draco.Mesh();let status;
      try {
        status=decoder.DecodeArrayToMesh(input,input.length,mesh);
        if(!status.ok())throw new Error(status.error_msg());
        const geometry=new THREE.BufferGeometry(),indexBytes=mesh.num_faces()*12,indexPtr=draco._malloc(indexBytes);
        try {decoder.GetTrianglesUInt32Array(mesh,indexBytes,indexPtr);geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(draco.HEAPF32.buffer,indexPtr,indexBytes/4).slice(),1));}
        finally {draco._free(indexPtr);}
        for(const [semantic,id]of Object.entries(ext.attributes)){
          const accessor=doc.accessors[primitive.attributes[semantic]],name=attributeNames[semantic];
          if(!name||![5126,5123,5125].includes(accessor.componentType))throw new Error(`Unsupported source attribute ${semantic}/${accessor.componentType}`);
          const Type=accessor.componentType===5126?Float32Array:accessor.componentType===5123?Uint16Array:Uint32Array,dataType=accessor.componentType===5126?draco.DT_FLOAT32:accessor.componentType===5123?draco.DT_UINT16:draco.DT_UINT32;
          const attribute=decoder.GetAttributeByUniqueId(mesh,id),size=attribute.num_components(),length=mesh.num_points()*size,byteLength=length*Type.BYTES_PER_ELEMENT,ptr=draco._malloc(byteLength);
          try {decoder.GetAttributeDataArrayForAllPoints(mesh,attribute,dataType,byteLength,ptr);geometry.setAttribute(name,new THREE.BufferAttribute(new Type(draco.HEAPF32.buffer,ptr,length).slice(),size,accessor.normalized??false));}
          finally {draco._free(ptr);}
        }
        group.add(new THREE.Mesh(geometry,materials[primitive.material]));
      } finally {if(status)draco.destroy(status);draco.destroy(mesh);draco.destroy(decoder);}
    }
    return group;
  });
  doc.nodes.forEach((node,index)=>{for(const child of node.children??[])nodes[index].add(nodes[child]);});
  const scene=new THREE.Group();scene.name=doc.scenes[doc.scene??0].name??"";
  for(const index of doc.scenes[doc.scene??0].nodes)scene.add(nodes[index]);
  return {doc,bin,scene};
}

/** Same indexed connected-component seed calculation as Scenery.addLeafSeeds. */
function prepareLeafSeeds(geometry) {
  const count=geometry.getAttribute("position").count,parents=new Uint32Array(count);
  for(let i=0;i<count;i++)parents[i]=i;
  const find=i=>{let root=i;while(parents[root]!==root)root=parents[root];while(parents[i]!==i){const next=parents[i];parents[i]=root;i=next;}return root;};
  const union=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parents[y]=x;};
  const index=geometry.index;if(!index)throw new Error("Foliage seed preparation expects indexed triangles");
  for(let i=0;i<index.count;i+=3){const a=index.getX(i);union(a,index.getX(i+1));union(a,index.getX(i+2));}
  const seeds=new Map(),values=new Float32Array(count);
  for(let i=0;i<count;i++){const root=find(i);if(!seeds.has(root))seeds.set(root,((Math.sin(root*127.1+19.19)*43758.5453)%1+1)%1);values[i]=seeds.get(root);}
  geometry.setAttribute("seasonalSeed",new THREE.BufferAttribute(values,1));
}

export async function prepareRuntimeWorld(source,{provenance=false}={}) {
  const start=performance.now(),{doc,bin,scene}=await decodeSourceWorld(source),decodeMs=performance.now()-start;
  const mergeStart=performance.now(),optimization=optimizeWorld(scene,"low"),mergeMs=performance.now()-mergeStart;
  let foliageGeometries=0;
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(let owner=mesh;owner;owner=owner.parent)if(/^ambient_(leaves|flowers)_/.test(owner.name)){prepareLeafSeeds(mesh.geometry);foliageGeometries++;break;}
    if(mesh.userData.pavilionRanges){
      const geometry=mesh.geometry,values=new Float32Array(geometry.getAttribute("position").count),seen=new Set();
      for(const range of mesh.userData.pavilionRanges)for(let face=range.start;face<range.end;face++)for(let corner=0;corner<3;corner++){
        const vertex=geometry.index.getX(face*3+corner),id=range.id?pavilionIds.indexOf(range.id)+1:0;
        if(seen.has(vertex)&&values[vertex]!==id)throw new Error("A source vertex belongs to conflicting pavilion ranges");
        values[vertex]=id;seen.add(vertex);
      }
      geometry.setAttribute("pavilionId",new THREE.BufferAttribute(values,1));
    }
  });
  // Remove only mathematically zero-area faces, without adding draw calls.
  let removedZeroAreaFaces=0;
  const sourceMeshes=[];scene.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push(mesh);});
  for(const mesh of sourceMeshes){
    const geometry=mesh.geometry,position=geometry.getAttribute("position"),solid=[],collapsed=[];
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let face=0;face<geometry.index.count/3;face++){
      a.fromBufferAttribute(position,geometry.index.getX(face*3));b.fromBufferAttribute(position,geometry.index.getX(face*3+1));c.fromBufferAttribute(position,geometry.index.getX(face*3+2));
      const area=b.sub(a).cross(c.sub(a)).lengthSq();(area===0?collapsed:solid).push(face);
    }
    if(!collapsed.length)continue;
    removedZeroAreaFaces+=collapsed.length;
    if(!solid.length){mesh.removeFromParent();geometry.dispose();continue;}
    const faces=solid;
      const remap=new Map(),indices=[];
      for(const face of faces)for(let corner=0;corner<3;corner++){const old=geometry.index.getX(face*3+corner);if(!remap.has(old))remap.set(old,remap.size);indices.push(remap.get(old));}
      const part=new THREE.BufferGeometry();
      for(const [name,attribute]of Object.entries(geometry.attributes)){
        const values=new attribute.array.constructor(remap.size*attribute.itemSize);
        for(const [old,current]of remap)for(let axis=0;axis<attribute.itemSize;axis++)values[current*attribute.itemSize+axis]=attribute.array[old*attribute.itemSize+axis];
        part.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize,attribute.normalized));
      }
      part.setIndex(indices);mesh.geometry=part;
      if(mesh.userData.pavilionRanges){
        const ranges=[];
        for(let face=0;face<faces.length;face++){
          const value=part.getAttribute("pavilionId").getX(part.index.getX(face*3)),id=value?pavilionIds[value-1]:null,previous=ranges.at(-1);
          if(previous&&previous.id===id)previous.end++;else ranges.push({start:face,end:face+1,id});
        }
        mesh.userData.pavilionRanges=ranges;
      }
    geometry.dispose();
  }
  optimization.primitives=0;optimization.triangles=0;scene.traverse(mesh=>{if(mesh.isMesh){optimization.primitives++;optimization.triangles+=mesh.geometry.index.count/3;}});
  // Reorder vertices by first use only. Every triangle stays in its original slot,
  // so pavilion face ranges and per-leaf seeds stay attached to the same surfaces.
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry,count=geometry.getAttribute("position").count,remap=new Uint32Array(count);remap.fill(0xffffffff);let next=0;
    const indices=Uint32Array.from(geometry.index.array);
    for(let i=0;i<indices.length;i++){const old=indices[i];if(remap[old]===0xffffffff)remap[old]=next++;indices[i]=remap[old];}
    for(let i=0;i<count;i++)if(remap[i]===0xffffffff)remap[i]=next++;
    for(const attribute of Object.values(geometry.attributes)){
      const values=new attribute.array.constructor(attribute.array.length);
      for(let i=0;i<count;i++)for(let axis=0;axis<attribute.itemSize;axis++)values[remap[i]*attribute.itemSize+axis]=attribute.array[i*attribute.itemSize+axis];
      attribute.array=values;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    // Test-only provenance makes the complete oriented-face check unambiguous.
    if(provenance)geometry.setAttribute("sourceVertex",new THREE.BufferAttribute(Uint32Array.from({length:count},(_,i)=>i),1));
  });
  const encoderModule=await encoderTask,decoderModule=await decoderTask;
  const codecs={sequential:{count:0,bytes:0},edgebreaker:{count:0,bytes:0}};
  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let byteLength=0;
  const append=data=>{const padding=(4-byteLength%4)%4;if(padding){chunks.push(Buffer.alloc(padding));byteLength+=padding;}const offset=byteLength;const bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength);chunks.push(bytes);byteLength+=bytes.length;return offset;};
  const makeAccessor=(array,itemSize,semantic,normalized=false)=>{
    const count=array.length/itemSize,index=semantic==="indices";
    const accessor={componentType:index||array instanceof Uint32Array?5125:array instanceof Uint16Array?5123:5126,count,type:({1:"SCALAR",2:"VEC2",3:"VEC3",4:"VEC4"})[itemSize],...(normalized?{normalized:true}:{})};
    if(semantic==="POSITION"){
      const min=Array(itemSize).fill(Infinity),max=Array(itemSize).fill(-Infinity);
      for(let i=0;i<array.length;i++){const axis=i%itemSize;min[axis]=Math.min(min[axis],array[i]);max[axis]=Math.max(max[axis],array[i]);}
      accessor.min=min;accessor.max=max;
    }
    accessors.push(accessor);return accessors.length-1;
  };
  const encodeGeometry=(geometry,forceSequential=false)=>{
    const draco=encoderModule,builder=new draco.MeshBuilder(),mesh=new draco.Mesh(),encoder=new draco.Encoder(),encoded=new draco.DracoInt8Array();
    const attributes={},ids={};
    try {
      builder.AddFacesToMesh(mesh,geometry.index.count/3,Uint32Array.from(geometry.index.array));
      for(const [name,attribute]of Object.entries(geometry.attributes)){
        if(!semanticNames[name]||attribute.isInterleavedBufferAttribute||!(attribute.array instanceof Float32Array||attribute.array instanceof Uint16Array||attribute.array instanceof Uint32Array))throw new Error(`Unsupported prepared attribute ${name}`);
        const kind=name==="position"?draco.POSITION:name==="normal"?draco.NORMAL:name==="color"?draco.COLOR:name==="uv"||name==="uv1"?draco.TEX_COORD:draco.GENERIC;
        const add=attribute.array instanceof Uint16Array?"AddUInt16Attribute":attribute.array instanceof Uint32Array?"AddUInt32Attribute":"AddFloatAttribute";
        ids[semanticNames[name]]=builder[add](mesh,kind,attribute.count,attribute.itemSize,attribute.array);
        if(attribute.normalized)builder.SetNormalizedFlagForAttribute(mesh,ids[semanticNames[name]],true);
        attributes[semanticNames[name]]=makeAccessor(attribute.array,attribute.itemSize,semanticNames[name],attribute.normalized);
      }
      let degenerate=false;
      for(let i=0;i<geometry.index.count;i+=3){const a=geometry.index.getX(i),b=geometry.index.getX(i+1),c=geometry.index.getX(i+2);if(a===b||a===c||b===c){degenerate=true;break;}}
      encoder.SetEncodingMethod(degenerate||forceSequential?draco.MESH_SEQUENTIAL_ENCODING:draco.MESH_EDGEBREAKER_ENCODING);encoder.SetSpeedOptions(4,4);
      const quantizationBits=(attribute,tolerance,minimum)=>{
        let range=0;
        for(let axis=0;axis<attribute.itemSize;axis++){let min=Infinity,max=-Infinity;for(let i=0;i<attribute.count;i++){const value=attribute.getComponent(i,axis);min=Math.min(min,value);max=Math.max(max,value);}range=Math.max(range,max-min);}
        return Math.max(minimum,Math.ceil(Math.log2(range*Math.sqrt(attribute.itemSize)/(tolerance*2)+1)));
      };
      encoder.SetAttributeQuantization(draco.POSITION,quantizationBits(geometry.getAttribute("position"),.0008,12));
      encoder.SetAttributeQuantization(draco.NORMAL,11);
      const uvAttributes=[geometry.getAttribute("uv"),geometry.getAttribute("uv1")].filter(Boolean);
      encoder.SetAttributeQuantization(draco.TEX_COORD,Math.max(12,...uvAttributes.map(attribute=>quantizationBits(attribute,.00008,12))));
      encoder.SetAttributeQuantization(draco.COLOR,10);
      const length=encoder.EncodeMeshToDracoBuffer(mesh,encoded);if(length<=0){if(!forceSequential)return encodeGeometry(geometry,true);throw new Error("Draco encoding failed");}
      const compressed=new Uint8Array(length);for(let i=0;i<length;i++)compressed[i]=encoded.GetValue(i);
      const decoded=new decoderModule.Mesh(),decoder=new decoderModule.Decoder();let status,ranges;
      try{
        status=decoder.DecodeArrayToMesh(compressed,compressed.length,decoded);if(!status.ok())throw new Error(status.error_msg());
        if(decoded.num_faces()!==geometry.index.count/3){
          if(!forceSequential)return encodeGeometry(geometry,true);
          throw new Error("Sequential compression changed the number of triangles");
        }
        for(const accessor of Object.values(attributes))accessors[accessor].count=decoded.num_points();
        if(ids._PAVILION_ID!==undefined){
          const count=decoded.num_points(),idPtr=decoderModule._malloc(count*4),faceBytes=decoded.num_faces()*12,facePtr=decoderModule._malloc(faceBytes);
          try{
            decoder.GetAttributeDataArrayForAllPoints(decoded,decoder.GetAttributeByUniqueId(decoded,ids._PAVILION_ID),decoderModule.DT_FLOAT32,count*4,idPtr);
            decoder.GetTrianglesUInt32Array(decoded,faceBytes,facePtr);
            const decodedIds=new Float32Array(decoderModule.HEAPF32.buffer,idPtr,count),faces=new Uint32Array(decoderModule.HEAPF32.buffer,facePtr,faceBytes/4);ranges=[];
            for(let face=0;face<decoded.num_faces();face++){
              const id=decodedIds[faces[face*3]];
              if(!Number.isInteger(id)||id<0||id>7||decodedIds[faces[face*3+1]]!==id||decodedIds[faces[face*3+2]]!==id)throw new Error("Compression mixed pavilion IDs within a face");
              const pavilion=id?pavilionIds[id-1]:null,previous=ranges.at(-1);
              if(previous&&previous.id===pavilion)previous.end++;else ranges.push({start:face,end:face+1,id:pavilion});
            }
          }finally{decoderModule._free(idPtr);decoderModule._free(facePtr);}
        }
      }finally{if(status)decoderModule.destroy(status);decoderModule.destroy(decoded);decoderModule.destroy(decoder);}
      const codec=degenerate||forceSequential?codecs.sequential:codecs.edgebreaker;codec.count++;codec.bytes+=length;
      const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset:append(compressed),byteLength:length});
      return {primitive:{attributes,indices:makeAccessor(Uint32Array.from(geometry.index.array),1,"indices"),mode:4,extensions:{KHR_draco_mesh_compression:{bufferView:view,attributes:ids}}},ranges};
    }finally{draco.destroy(encoded);draco.destroy(encoder);draco.destroy(mesh);draco.destroy(builder);}
  };
  const emitNode=object=>{
    const node={},index=nodes.length;nodes.push(node);if(object.name)node.name=object.name;
    if(object.userData.sourceNode!==undefined){const original=doc.nodes[object.userData.sourceNode];for(const key of ["matrix","translation","rotation","scale"])if(original[key])node[key]=original[key];}
    else{object.updateMatrix();if(!object.matrix.equals(new THREE.Matrix4()))node.matrix=object.matrix.toArray();}
    if(object.isMesh){
      const encoded=encodeGeometry(object.geometry),primitive={...encoded.primitive,material:object.material.userData.sourceMaterial};
      meshes.push({name:object.name||"prepared_primitive",primitives:[primitive]});node.mesh=meshes.length-1;
      node.extras={...object.userData,...(encoded.ranges?{pavilionRanges:encoded.ranges}:{}),runtimeCastShadow:object.castShadow,runtimeReceiveShadow:object.receiveShadow};
    }else{const extras={...object.userData};delete extras.sourceNode;if(Object.keys(extras).length)node.extras=extras;}
    if(object.children.length)node.children=object.children.map(emitNode);
    return index;
  };
  const roots=scene.children.map(emitNode),images=(doc.images??[]).map(image=>{
    const view=doc.bufferViews[image.bufferView];if(image.uri||view.buffer!==0)throw new Error("Expected unchanged embedded images");
    const data=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),bufferView=bufferViews.length;
    bufferViews.push({buffer:0,byteOffset:append(data),byteLength:data.length});return {...image,bufferView};
  });
  const runtimePrepared={version:1,quality:"low",source:"archipelago-v9-low.glb",compression:"Draco Edgebreaker with decoded selection ranges",foliageAttribute:"_seasonal_seed",foliageGeometries};
  const output={...doc,asset:{...doc.asset,generator:"TCC offline runtime preparation v1"},scene:0,scenes:[{name:scene.name,nodes:roots,extras:{runtimePrepared,optimization}}],nodes,meshes,accessors,bufferViews,images,buffers:[{byteLength}],extensionsUsed:[...(doc.extensionsUsed??[]).filter(name=>name!=="KHR_draco_mesh_compression"),"KHR_draco_mesh_compression"],extensionsRequired:[...(doc.extensionsRequired??[]).filter(name=>name!=="KHR_draco_mesh_compression"),"KHR_draco_mesh_compression"]};
  const json=Buffer.from(JSON.stringify(output)),jsonPadding=(4-json.length%4)%4,binary=Buffer.concat(chunks),binaryPadding=(4-binary.length%4)%4,total=12+8+json.length+jsonPadding+8+binary.length+binaryPadding;
  const bytes=Buffer.alloc(total);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(total,8);bytes.writeUInt32LE(json.length+jsonPadding,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.fill(32,20+json.length,20+json.length+jsonPadding);
  const binHeader=20+json.length+jsonPadding;bytes.writeUInt32LE(binary.length+binaryPadding,binHeader);bytes.writeUInt32LE(0x004e4942,binHeader+4);binary.copy(bytes,binHeader+8);
  return {bytes,report:{...optimization,removedZeroAreaFaces,foliageGeometries,codecs,sourceBytes:source.length,preparedBytes:bytes.length,decodeMs:Math.round(decodeMs),mergeMs:Math.round(mergeMs),totalMs:Math.round(performance.now()-start)},scene};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const source=await fs.readFile(path.join(root,"public/experience/world/archipelago-v9-low.glb"));
  const {bytes,report}=await prepareRuntimeWorld(source);
  // Do not silently trade startup CPU for an unreviewed network-size increase.
  if(bytes.length>4_000_000)throw new Error(`Prepared asset exceeds 4 MB: ${JSON.stringify(report)}`);
  await fs.writeFile(path.join(root,"public/experience/world/archipelago-v19-low.glb"),bytes);
  console.log(JSON.stringify(report));
}
