import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {openingFrame,applyOpeningView,clearOpeningView} from "../src/components/island-experience/opening-layout.mjs";
import {fieldOfView} from "../src/components/island-experience/scene-motion.mjs";

test("fullscreen sky preserves island pixel positions at every welcome breakpoint",()=>{
  for(const [width,height] of [[1280,720],[2048,968],[650,697],[390,844],[844,390]]){
    const frame=openingFrame(width,height);
    const fov=fieldOfView(38,frame.width,frame.height);
    const original=new THREE.PerspectiveCamera(fov,frame.width/frame.height,.1,160);
    const extended=new THREE.PerspectiveCamera(fov,width/height,.1,160);
    for(const camera of [original,extended]){camera.position.set(1.8,29.2,43.5);camera.lookAt(0,.8,-1.6);camera.updateMatrixWorld(true);}
    applyOpeningView(extended,width,height);
    for(const p of [[-11,1,9],[11,1,9],[0,4,-16],[0,15,-10]]){
      const before=new THREE.Vector3(...p).project(original),after=new THREE.Vector3(...p).project(extended);
      const x=frame.left+(before.x*.5+.5)*frame.width,y=frame.top+(-before.y*.5+.5)*frame.height;
      assert.ok(Math.abs(x-(after.x*.5+.5)*width)<1e-8);
      assert.ok(Math.abs(y-(-after.y*.5+.5)*height)<1e-8);
    }
    clearOpeningView(extended,width,height);
    assert.equal(extended.view.enabled,false,"exploration restores the complete viewport");
  }
});
