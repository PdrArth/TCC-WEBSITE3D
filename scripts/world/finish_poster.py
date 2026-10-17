"""Convert the same-scene Blender poster into the shipped WebP and record proof."""
from pathlib import Path
from PIL import Image
import json,hashlib

ROOT=Path(__file__).resolve().parents[2]
source=ROOT/"assets/world/poster-render.png"
output=ROOT/"public/experience/world/poster.webp"
image=Image.open(source).convert("RGB")
assert image.size==(1600,1200),image.size
image.save(output,"WEBP",quality=89,method=6)
manifest=json.loads((ROOT/"public/experience/world/manifest.json").read_text(encoding="utf-8-sig"))
report=json.loads((ROOT/"assets/world/build-report.json").read_text(encoding="utf-8"))
report["camera"]=manifest["initialCamera"]
report["render"]="Blender EEVEE / 96 samples / same island.blend scene"
report["poster"]={"dimensions":[1600,1200],"bytes":output.stat().st_size,"sha256":hashlib.sha256(output.read_bytes()).hexdigest(),"source":"assets/world/poster-render.png"}
report["assetSha256"]={name:hashlib.sha256((ROOT/"public/experience/world"/name).read_bytes()).hexdigest() for name in ["island.glb","island-low.glb","avatar.glb"]}
(ROOT/"assets/world/build-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))
