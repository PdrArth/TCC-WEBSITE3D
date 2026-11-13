import * as THREE from 'three';

/** Locate the existing broadleaf crowns; palms, conifers and buildings keep their silhouettes. */
export function createTreeHabitat(world) {
  world.updateMatrixWorld(true);
  const crowns=[];
  world.traverse(object=>{
    if(!/^ambient_leaves_.*_(ipe_amarelo|ipe_roxo|jabuticabeira|pitangueira|quaresmeira|pau_brasil)$/.test(object.name))return;
    const bounds=new THREE.Box3().setFromObject(object),inverse=object.matrixWorld.clone().invert();
    if(bounds.isEmpty())return;
    const center=bounds.getCenter(new THREE.Vector3()).applyMatrix4(inverse),size=bounds.getSize(new THREE.Vector3());
    const radius=Math.min(1.7,Math.max(.9,(size.x+size.z)/4));
    const island=object.name.split('_')[2];
    const crown={object,name:object.name,island,center:center.toArray(),radius,height:Math.max(.8,size.y),seed:crowns.length*2.39996};
    crowns.push(crown);
  });
  const nesting=crowns.find(crown=>crown.name==='ambient_leaves_pesquisa_jabuticabeira')??crowns[0];
  const nestLocal=nesting?new THREE.Vector3(nesting.center[0]+nesting.radius*.90,nesting.center[1]-.12,nesting.center[2]+nesting.radius*.82):null;
  const nest=nestLocal?nestLocal.clone().applyMatrix4(nesting.object.matrixWorld).toArray():null;
  const anchors=crowns.map(crown=>{
    const local=new THREE.Vector3(crown.center[0]+crown.radius*.20,crown.center[1]+crown.height*.56,crown.center[2]+crown.radius*.12);
    return {object:crown.object,local,perch:{island:crown.island,position:local.clone().applyMatrix4(crown.object.matrixWorld).toArray()}};
  });
  const nestMatrix=new THREE.Matrix4(),nestAnchor=nest?{object:nesting.object,frame:nesting.object.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(...nest))}:null;
  if(nest){
    const position=[nest[0],nest[1]+.11,nest[2]],local=new THREE.Vector3(...position).applyMatrix4(nesting.object.matrixWorld.clone().invert());
    anchors.unshift({object:nesting.object,local,perch:{island:nesting.island,position,nest:true}});
  }
  const habitat={crowns,nest,perches:anchors.map(anchor=>anchor.perch),anchors,nestAnchor,nestMatrix,scratch:new THREE.Vector3()};
  updateTreeHabitat(habitat);
  return habitat;
}

/** Keep the branch, nest and resting birds on the same moving tree, without replacing perch references. */
export function updateTreeHabitat(habitat){
  for(const crown of habitat.crowns)crown.object.updateWorldMatrix(true,false);
  for(const anchor of habitat.anchors){
    const point=habitat.scratch.copy(anchor.local).applyMatrix4(anchor.object.matrixWorld),position=anchor.perch.position;
    position[0]=point.x;position[1]=point.y;position[2]=point.z;
  }
  if(habitat.nest&&habitat.nestAnchor){
    habitat.nestMatrix.multiplyMatrices(habitat.nestAnchor.object.matrixWorld,habitat.nestAnchor.frame);
    const point=habitat.scratch.setFromMatrixPosition(habitat.nestMatrix);
    habitat.nest[0]=point.x;habitat.nest[1]=point.y;habitat.nest[2]=point.z;
  }
  return habitat;
}

/** Reattach each authored jabuticaba to the actual bark in either GLB quality. */
export function attachTrunkFruit(world) {
  world.updateMatrixWorld(true);
  const bark=[],fruits=[];
  world.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(materials.some(material=>material.name==='v9 bark dark'))bark.push(mesh);
    if(!mesh.userData.fruitAttached&&materials.length===1&&materials[0].name==='v9 jabuticaba fruit')fruits.push(mesh);
  });
  let attached=0;
  for(const mesh of fruits){
    const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index,n=position.count;
    const parents=Array.from({length:n},(_,i)=>i),corners=new Map();
    const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    const join=(a,b)=>{parents[root(a)]=root(b);};
    for(let i=0;i<n;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*10000)).join(',');const previous=corners.get(key);if(previous!==undefined)join(i,previous);else corners.set(key,i);}
    for(let i=0;i<(index?.count??n);i+=3){const a=index?index.getX(i):i;join(a,index?index.getX(i+1):i+1);join(a,index?index.getX(i+2):i+2);}
    const groups=new Map(),vertex=new THREE.Vector3();
    for(let i=0;i<n;i++){const r=root(i);if(!groups.has(r))groups.set(r,{indices:[],box:new THREE.Box3()});const group=groups.get(r);group.indices.push(i);vertex.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);group.box.expandByPoint(vertex);}
    const inverse=mesh.matrixWorld.clone().invert(),ray=new THREE.Raycaster();
    for(const {indices,box} of groups.values()){
      const center=box.getCenter(new THREE.Vector3());
      const base=center.x<0?[-8.02,.08,7.4]:[2.98,.08,-15.6];
      const trunkY=center.x<0?2.40:2.47,t=Math.min(1,(center.y-.08)/trunkY);
      const axis=new THREE.Vector3(base[0]+.17*t,center.y,base[2]-.08*t),outward=center.clone().sub(axis).setY(0).normalize();
      if(outward.lengthSq()<.5)outward.set(1,0,0);
      ray.set(axis.clone().addScaledVector(outward,.6),outward.clone().negate());ray.far=1.0;
      const hit=ray.intersectObjects(bark,false)[0];if(!hit)continue;
      const target=hit.point.clone().addScaledVector(outward,.024),offset=target.sub(center);
      for(const i of indices){vertex.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).add(offset).applyMatrix4(inverse);position.setXYZ(i,vertex.x,vertex.y,vertex.z);}
      attached++;
    }
    position.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.userData.fruitAttached=true;
  }
  world.userData.attachedTrunkFruit=attached;return attached;
}
