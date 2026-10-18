/** The island keeps its welcome composition; the sky uses the entire viewport. */
export function openingFrame(width, height) {
  const w = Math.max(1, width), h = Math.max(1, height);
  if (h <= 570 && w > 600) return { left:w*.4, top:70, width:w*.58, height:Math.max(1,h-80) };
  if (w <= 600) return { left:0, top:310, width:w, height:Math.max(1,h-456) };
  if (w <= 900) return { left:w*.02, top:294, width:w*.96, height:Math.max(1,h-318) };
  return { left:w*.38, top:90, width:w*.6, height:Math.max(1,h-114) };
}

/** Extend the old island frustum to the window, instead of clipping its sky. */
export function applyOpeningView(camera, width, height) {
  const frame = openingFrame(width,height);
  camera.setViewOffset(frame.width,frame.height,-frame.left,-frame.top,width,height);
  return frame;
}

export function clearOpeningView(camera,width,height){
  camera.clearViewOffset();camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
}
