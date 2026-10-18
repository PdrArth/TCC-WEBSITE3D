import * as THREE from 'three';

/** Intersect the actual polygon along a ray, rather than assuming an elliptical shore. */
export function bankAnchor(x,z,environment) {
  const [cx,cz]=environment.water.center, dx=x-cx,dz=z-cz, polygon=environment.water.shoreline;
  let hit=null;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],ex=b[0]-a[0],ez=b[1]-a[1],cross=dx*ez-dz*ex;
    if(Math.abs(cross)<1e-8)continue;
    const ax=a[0]-cx,az=a[1]-cz,t=(ax*ez-az*ex)/cross,u=(ax*dz-az*dx)/cross;
    if(t>0&&u>=0&&u<=1) { hit={x:cx+dx*t*1.04,z:cz+dz*t*1.04,y:-.0145+.035*(Math.sin(i*.29)*(1-u)+Math.sin(((i+1)%polygon.length)*.29)*u)}; break; }
  }
  return hit;
}

/** Preserve every authored pebble shape, translating each connected rock onto the bank. */
export function groundShoreStones(scene,environment) {
  scene.updateMatrixWorld(true); let grounded=0;
  scene.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData.shoreGrounded)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(!materials.some(material=>material.name==='Rock limestone'))return;
    const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index,n=position.count;
    const parents=Array.from({length:n},(_,i)=>i),corners=new Map();
    const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    const join=(a,b)=>{parents[root(a)]=root(b);};
    for(let i=0;i<n;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*10000)).join(',');const old=corners.get(key);if(old!==undefined)join(i,old);else corners.set(key,i);}
    const total=index?.count??n;
    for(let i=0;i<total;i+=3){const a=index?index.getX(i):i;join(a,index?index.getX(i+1):i+1);join(a,index?index.getX(i+2):i+2);}
    const groups=new Map(),v=new THREE.Vector3();
    for(let i=0;i<n;i++){const r=root(i);if(!groups.has(r))groups.set(r,{indices:[],box:new THREE.Box3()});const group=groups.get(r);group.indices.push(i);v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);group.box.expandByPoint(v);}
    const inverse=mesh.matrixWorld.clone().invert();
    for(const {indices,box} of groups.values()){
      const center=box.getCenter(new THREE.Vector3()),[cx,cz]=environment.water.center;
      if(Math.hypot((center.x-cx)/environment.water.radii[0],(center.z-cz)/environment.water.radii[1])<.90||box.max.y>.8)continue;
      const anchor=bankAnchor(center.x,center.z,environment);if(!anchor)continue;
      const offset=new THREE.Vector3(anchor.x-center.x,anchor.y-.065-box.min.y,anchor.z-center.z);
      for(const i of indices){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).add(offset).applyMatrix4(inverse);position.setXYZ(i,v.x,v.y,v.z);}grounded++;
    }
    position.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.userData.shoreGrounded=true;
  });
  scene.userData.groundedShoreStones=grounded;return grounded;
}
