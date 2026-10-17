"""Publish WebP derivatives of the actual v7 Blender renders and retain v6 images."""
from pathlib import Path
import json, hashlib, shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"assets/world";PUBLIC=ROOT/"public/experience"
ids=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
(PUBLIC/"editorial/v7").mkdir(parents=True,exist_ok=True)
(PUBLIC/"editorial/v6").mkdir(parents=True,exist_ok=True)
for pid in ("especificar","gerar","validar","evoluir"):
    current=PUBLIC/"editorial"/(pid+".webp");preserved=PUBLIC/"editorial/v6"/(pid+".webp")
    if current.exists() and not preserved.exists():shutil.copy2(current,preserved)
records={}
for pid in (*ids,"poster"):
    original=SOURCE/("poster-v7-render.png" if pid=="poster" else "editorial-v7-"+pid+".png")
    image=Image.open(original).convert("RGB")
    expected=(1800,1350) if pid=="poster" else (1200,780)
    assert image.size==expected,(pid,image.size)
    destination=PUBLIC/("world/poster-v7.webp" if pid=="poster" else "editorial/v7/"+pid+".webp")
    image.save(destination,"WEBP",quality=91,method=6)
    record={"url":"/experience/"+destination.relative_to(PUBLIC).as_posix(),"dimensions":list(image.size),"bytes":destination.stat().st_size,"sha256":hashlib.sha256(destination.read_bytes()).hexdigest(),"source":original.relative_to(ROOT).as_posix(),"authoringScene":"assets/world/archipelago-v7.blend"}
    if pid!="poster":
        shutil.copy2(destination,PUBLIC/"editorial"/(pid+".webp"))
        thumbnail=PUBLIC/"world"/("thumb-v7-"+pid+".webp")
        image.resize((512,333),Image.Resampling.LANCZOS).save(thumbnail,"WEBP",quality=88,method=6)
        record["thumbnail"]={"url":"/experience/world/"+thumbnail.name,"bytes":thumbnail.stat().st_size,"dimensions":[512,333],"sha256":hashlib.sha256(thumbnail.read_bytes()).hexdigest()}
    records[pid]=record
report_path=SOURCE/"build-report-v7.json";report=json.loads(report_path.read_text(encoding="utf-8"))
report["render"]="Blender EEVEE / 96 samples / actual archipelago-v7.blend scene"
report["renders"]=records
report["assetSha256"]={name:hashlib.sha256((PUBLIC/"world"/name).read_bytes()).hexdigest() for name in ("archipelago-v7.glb","archipelago-v7-low.glb")}
report_path.write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(records,indent=2))
