"use client";
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createShadowBudget, advanceShadowBudget, mobileViewport } from '@/lib/experience/render-budget.mjs';

/** Keep touch interaction at the native frame rate while reusing recent shadows. */
export default function MobileShadows({ active, moving }: { active:boolean; moving:boolean }) {
  const { gl, size } = useThree(), budget = useRef(createShadowBudget());
  const mobile = mobileViewport(size.width,size.height,typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    if (!mobile) return;
    const previous = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    budget.current = createShadowBudget();
    return () => { gl.shadowMap.autoUpdate = previous; gl.shadowMap.needsUpdate = true; };
  }, [gl, mobile]);
  useEffect(() => { budget.current.dirty = true; }, [active, moving]);
  useFrame((_, delta) => {
    if (!mobile || !active) return;
    if (advanceShadowBudget(budget.current,delta,moving)) gl.shadowMap.needsUpdate = true;
  }, -50);
  useEffect(() => { gl.domElement.setAttribute('data-world-shadow-rate',mobile?(moving?'15':'paused'):'native'); }, [gl,mobile,moving]);
  return null;
}
