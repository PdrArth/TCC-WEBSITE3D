"use client";
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {ACCESSIBILITY_KEY,accessibilityDefaults,parseAccessibility,resolveAccessibility,type AccessibilityPreferences} from '@/lib/experience/accessibility.mjs';
function useMedia(query:string) {
  const subscribe=useCallback((callback:()=>void)=>{const media=window.matchMedia(query);media.addEventListener('change',callback);return()=>media.removeEventListener('change',callback);},[query]);
  const snapshot=useCallback(()=>window.matchMedia(query).matches,[query]);
  return useSyncExternalStore(subscribe,snapshot,()=>false);
}
export function useAccessibility(initialTextView=false) {
  const [preferences,setPreferences]=useState<AccessibilityPreferences>({...accessibilityDefaults,textView:initialTextView}),[loaded,setLoaded]=useState(false),[persistent,setPersistent]=useState(true);
  const reducedMotion=useMedia('(prefers-reduced-motion: reduce)'),moreContrast=useMedia('(prefers-contrast: more)'),forcedColors=useMedia('(forced-colors: active)');
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const saved=parseAccessibility(localStorage.getItem(ACCESSIBILITY_KEY));setPreferences({...saved,textView:initialTextView||saved.textView});}catch{setPersistent(false);}setLoaded(true);});return()=>{active=false;};},[initialTextView]);
  useEffect(()=>{if(!loaded)return;let active=true;try{localStorage.setItem(ACCESSIBILITY_KEY,JSON.stringify(preferences));}catch{queueMicrotask(()=>{if(active)setPersistent(false);});}return()=>{active=false;};},[loaded,preferences]);
  const update=useCallback((patch:Partial<AccessibilityPreferences>)=>setPreferences(previous=>parseAccessibility({...previous,...patch})),[]);
  const reset=useCallback(()=>setPreferences({...accessibilityDefaults}),[]);
  return {preferences,update,reset,loaded,persistent,...resolveAccessibility(preferences,{reducedMotion,moreContrast:moreContrast||forcedColors})};
}
