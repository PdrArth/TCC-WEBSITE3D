export const ACCESSIBILITY_KEY = 'tcc-garden-accessibility-v1';
export const accessibilityDefaults = Object.freeze({
  motion:'system',contrast:'system',palette:'original',textSize:'normal',spacing:false,
  textView:false,captions:false,flashes:false,announcements:true,
});
const choices = {motion:['system','reduced','paused'],contrast:['system','high','dark'],palette:['original','blue-amber','monochrome'],textSize:['normal','large','larger']};
export function parseAccessibility(value) {
  let input;
  try { input=typeof value==='string'?JSON.parse(value):value; } catch { return {...accessibilityDefaults}; }
  if(!input||typeof input!=='object'||Array.isArray(input))return {...accessibilityDefaults};
  const result={...accessibilityDefaults};
  for(const key of Object.keys(choices))if(choices[key].includes(input[key]))result[key]=input[key];
  for(const key of ['spacing','textView','captions','flashes','announcements'])if(typeof input[key]==='boolean')result[key]=input[key];
  return result;
}
export function resolveAccessibility(preferences,{reducedMotion=false,moreContrast=false}={}) {
  const p=parseAccessibility(preferences);
  return {...p,reducedMotion:p.motion==='reduced'||p.motion==='paused'||p.motion==='system'&&reducedMotion,
    paused:p.motion==='paused',theme:p.contrast==='system'?(moreContrast?'high':'normal'):p.contrast,
    allowFlashes:p.flashes&&p.motion!=='paused'&&p.motion!=='reduced'&&!(p.motion==='system'&&reducedMotion)};
}
export function contrastRatio(a,b) {
  const luminance=hex=>{
    const channels=hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export const accessiblePalettes = {
  original:['#b29c76','#7eaa95','#a5b7b7','#879aaf','#c89575','#a7aa7d','#b9ae91'],
  'blue-amber':['#e5b45a','#a3d2ea','#e2c9a1','#8abbd6','#f0c86d','#c1dce8','#d9b979'],
  monochrome:['#f5f5ed','#d9d9d0','#c8c8bd','#eeeeea','#b9b9ae','#e2e2d8','#cecec3'],
};
