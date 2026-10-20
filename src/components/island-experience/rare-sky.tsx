"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnvironmentState } from '@/lib/experience/environment.mjs';
import { createSkyEvents, advanceSkyEvents, METEOR_SECONDS, type SkyEvents } from '@/lib/experience/sky-events.mjs';

/** One sky-only quad, hidden between events; the world depth occludes it. */
export default function RareSky({ environmentState, active, reducedMotion }: {
  environmentState:MutableRefObject<EnvironmentState>; active:boolean; reducedMotion:boolean;
}) {
  const { gl, size } = useThree();
  const mesh = useRef<THREE.Mesh>(null), events = useRef<SkyEvents | null>(null), report = useRef(0);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:true, toneMapped:false,
    uniforms:{ rainbow:{value:0}, meteor:{value:0}, progress:{value:0},
      start:{value:new THREE.Vector2()}, end:{value:new THREE.Vector2()}, resolution:{value:new THREE.Vector2(1280,720)} },
    vertexShader:`varying vec2 skyUv;
      void main(){skyUv=uv;gl_Position=vec4(position.xy,0.9999,1.0);}`,
    fragmentShader:`varying vec2 skyUv;
      uniform float rainbow,meteor,progress;
      uniform vec2 start,end,resolution;
      vec3 spectrum(float h){vec3 p=abs(fract(vec3(h)+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return mix(vec3(1.0),clamp(p-1.0,0.0,1.0),.55);}
      void main(){
        vec2 arc=(skyUv-vec2(.5,.50))/vec2(.46,.34);
        float band=(1.0-length(arc))/.065;
        float arcAlpha=smoothstep(0.0,.16,band)*(1.0-smoothstep(.84,1.0,band))*smoothstep(-.01,.08,arc.y)*rainbow;
        vec3 arcColor=spectrum(clamp(band,0.0,1.0)*.76);
        vec2 aspect=vec2(resolution.x/resolution.y,1.0),head=mix(start,end,progress);
        vec2 direction=normalize((end-start)*aspect),offset=(skyUv-head)*aspect;
        float along=dot(offset,direction),across=abs(offset.x*direction.y-offset.y*direction.x),px=1.0/resolution.y;
        float tail=exp(-pow(across/(px*.85),2.0))*smoothstep(-.09,0.0,along)*(1.0-smoothstep(0.0,px*2.0,along));
        float halo=exp(-dot(offset,offset)/(px*px*12.0))*.65;
        float core=exp(-dot(offset,offset)/(px*px*1.4));
        float starAlpha=clamp(tail*.8+halo+core,0.0,1.0)*meteor;
        float alpha=arcAlpha+starAlpha*(1.0-arcAlpha);
        if(alpha<.002)discard;
        gl_FragColor=vec4((arcColor*arcAlpha+vec3(.85,.95,1.0)*starAlpha*(1.0-arcAlpha))/max(alpha,.0001),alpha);
        #include <colorspace_fragment>
      }`,
  }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame((_, delta) => {
    const event = events.current ??= createSkyEvents(), environment = environmentState.current;
    advanceSkyEvents(event, delta, {weather:environment.weather,hour:environment.hour,active,reducedMotion});
    if (mesh.current) mesh.current.visible = event.rainbowOpacity > .002 || event.meteorOpacity > .002;
    if (mesh.current?.visible) {
      const u = material.uniforms;
      u.rainbow.value = event.rainbowOpacity; u.meteor.value = event.meteorOpacity;
      u.progress.value = Math.max(0, event.meteorAge / METEOR_SECONDS);
      u.start.value.fromArray(event.meteorStart); u.end.value.fromArray(event.meteorEnd);
      u.resolution.value.set(size.width, size.height);
    }
    report.current += Math.min(.1, delta);
    if (report.current >= .1) {
      report.current = 0;
      gl.domElement.setAttribute('data-world-rainbow',event.rainbowOpacity.toFixed(3));
      gl.domElement.setAttribute('data-world-rainbow-count',String(event.rainbows));
      gl.domElement.setAttribute('data-world-meteor',event.meteorOpacity.toFixed(3));
      gl.domElement.setAttribute('data-world-meteor-count',String(event.meteors));
      gl.domElement.setAttribute('data-world-next-meteor',event.meteorWait.toFixed(1));
    }
  });
  return <mesh ref={mesh} name="rare_garden_sky" geometry={geometry} material={material} visible={false} frustumCulled={false} renderOrder={-2} raycast={()=>{}}/>;
}
