"use client";
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';

/** Capture a freshly rendered frame without keeping WebGL's drawing buffer alive. */
export default function PhotoCapture({request,onCapture}:{request:number;onCapture?:(blob:Blob|null)=>void}){
  const {gl,scene,camera,invalidate}=useThree(),captured=useRef(request),pending=useRef(0),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(request>captured.current){pending.current=request;invalidate();}},[request,invalidate]);
  useFrame(()=>{
    if(!pending.current||pending.current<=captured.current)return;
    captured.current=pending.current;pending.current=0;
    try{
      gl.render(scene,camera);
      const output=document.createElement('canvas');output.width=gl.domElement.width;output.height=gl.domElement.height;
      const context=output.getContext('2d');if(!context){onCapture?.(null);return;}
      // The live sky is a CSS backdrop, outside WebGL's transparent canvas.
      const sky=gl.domElement.getAttribute('data-world-sky')??'dce9e5',channels=[0,2,4].map(i=>parseInt(sky.slice(i,i+2),16));
      context.save();context.scale(output.width,output.height);
      const gradient=context.createRadialGradient(.45,.24,0,.45,.24,.94);gradient.addColorStop(0,`rgb(${channels.map(v=>Math.round(v*.85+255*.15)).join(' ')})`);gradient.addColorStop(1,'#'+sky);
      context.fillStyle=gradient;context.fillRect(0,0,1,1);context.restore();context.drawImage(gl.domElement,0,0);
      output.toBlob(blob=>{if(mounted.current)onCapture?.(blob);},'image/png');
    }
    catch{onCapture?.(null);}
  });
  return null;
}
