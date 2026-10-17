"""Compress only fresh actual v9 Blender renders; gate the hero poster at160KB."""
from pathlib import Path
import json,hashlib
from PIL import Image

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world";PUBLIC=ROOT/"public/experience"
IDS=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
(PUBLIC/"editorial/v9").mkdir(parents=True,exist_ok=True)
source_time=(SOURCE/"archipelago-v9.blend").stat().st_mtime
records={}
for pid in (*IDS,"poster"):
    original=SOURCE/("poster-v9-render.png" if pid=="poster" else "editorial-v9-"+pid+".png")
    assert original.stat().st_mtime>=source_time,("Stale render",pid)
    image=Image.open(original).convert("RGB");expected=(1800,1350) if pid=="poster" else(1200,780)
    assert image.size==expected,(pid,image.size)
    destination=PUBLIC/("world/poster-v9.webp" if pid=="poster" else "editorial/v9/"+pid+".webp")
    if pid=="poster":
        for quality in (86,83,80,77,74,71):
            image.save(destination,"WEBP",quality=quality,method=6)
            if destination.stat().st_size<=160000:break
        assert destination.stat().st_size<=160000,destination.stat().st_size
    else:
        quality=90;image.save(destination,"WEBP",quality=quality,method=6)
    record={"url":"/experience/"+destination.relative_to(PUBLIC).as_posix(),"dimensions":list(image.size),"bytes":destination.stat().st_size,"quality":quality,"sha256":hashlib.sha256(destination.read_bytes()).hexdigest(),"source":original.relative_to(ROOT).as_posix(),"sourceSha256":hashlib.sha256(original.read_bytes()).hexdigest(),"authoringScene":"assets/world/archipelago-v9.blend","freshRender":True}
    if pid!="poster":
        thumb=PUBLIC/"world"/("thumb-v9-"+pid+".webp")
        image.resize((512,333),Image.Resampling.LANCZOS).save(thumb,"WEBP",quality=87,method=6)
        record["thumbnail"]={"url":"/experience/world/"+thumb.name,"dimensions":[512,333],"bytes":thumb.stat().st_size,"sha256":hashlib.sha256(thumb.read_bytes()).hexdigest()}
    records[pid]=record
path=SOURCE/"build-report-v9.json";report=json.loads(path.read_text(encoding="utf-8"))
report["renders"]=records;report["render"]="Actual final Blender EEVEE source,96samples; source/render freshness validated"
report["sourceSha256"]=hashlib.sha256((SOURCE/"archipelago-v9.blend").read_bytes()).hexdigest()
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("V9_IMAGES_READY",json.dumps({"posterBytes":records["poster"]["bytes"],"posterDimensions":records["poster"]["dimensions"],"editorialImages":7,"thumbnails":7,"freshActualRenders":True}),flush=True)
