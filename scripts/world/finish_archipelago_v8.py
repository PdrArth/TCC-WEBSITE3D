"""Produce versioned WebPs from the actual v8 Blender render files."""
from pathlib import Path
import json, hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
PUBLIC = ROOT / "public/experience"
IDS = ("pesquisa", "gerar", "comparar", "validar", "especificar", "evoluir", "perspectivas")
(PUBLIC / "editorial/v8").mkdir(parents=True, exist_ok=True)
records = {}
for pid in (*IDS, "poster"):
    original = SOURCE / ("poster-v8-render.png" if pid == "poster" else "editorial-v8-" + pid + ".png")
    image = Image.open(original).convert("RGB")
    expected = (1800, 1350) if pid == "poster" else (1200, 780)
    assert image.size == expected, (pid, image.size)
    destination = PUBLIC / ("world/poster-v8.webp" if pid == "poster" else "editorial/v8/" + pid + ".webp")
    image.save(destination, "WEBP", quality=92, method=6)
    record = {"url": "/experience/" + destination.relative_to(PUBLIC).as_posix(), "dimensions": list(image.size), "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "source": original.relative_to(ROOT).as_posix(), "authoringScene": "assets/world/archipelago-v8.blend"}
    if pid != "poster":
        thumbnail = PUBLIC / "world" / ("thumb-v8-" + pid + ".webp")
        image.resize((512, 333), Image.Resampling.LANCZOS).save(thumbnail, "WEBP", quality=89, method=6)
        record["thumbnail"] = {"url": "/experience/world/" + thumbnail.name, "bytes": thumbnail.stat().st_size, "dimensions": [512, 333], "sha256": hashlib.sha256(thumbnail.read_bytes()).hexdigest()}
    records[pid] = record
report_path = SOURCE / "build-report-v8.json"
report = json.loads(report_path.read_text(encoding="utf-8"))
report["render"] = "Blender EEVEE / 96 samples / actual archipelago-v8.blend scene"
report["renders"] = records
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"version": 8, "renders": len(records), "editorialImages": 7, "thumbnails": 7, "actualBlenderSource": True}, indent=2))
