/** Small breezes remain visible; storm gusts bend the existing crowns without replacing them. */
export function foliageSway(time,wind,phase=0,windSpeed=0) {
  const strength=Math.max(0,Math.min(1,wind));
  const amplitude=Math.min(.12,.018+strength*strength*.075+Math.max(0,windSpeed)*.0009);
  const gust=.80+.20*Math.sin(time*.31+phase*.4);
  return (Math.sin(time*(.75+strength*.35)+phase)+Math.sin(time*1.83+phase)*strength*.22)*amplitude*gust;
}
