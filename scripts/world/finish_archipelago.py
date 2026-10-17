"""Compress the real scene renders to local WebP, with measured provenance."""
import json, hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
PUBLIC = ROOT / "public/experience"
(PUBLIC / "editorial").mkdir(parents=True, exist_ok=True)
records = {}
for pid in ("especificar", "gerar", "validar", "evoluir", "poster"):
    original = SOURCE / ("poster-v6-render.png" if pid == "poster" else "editorial-" + pid + ".png")
    destination = PUBLIC / ("world/poster-v6.webp" if pid == "poster" else "editorial/" + pid + ".webp")
    image = Image.open(original).convert("RGB")
    assert image.size == ((1600, 1200) if pid == "poster" else (1000, 650))
    image.save(destination, "WEBP", quality=89, method=6)
    records[pid] = {"url": "/experience/" + str(destination.relative_to(PUBLIC)).replace("\\", "/"), "dimensions": list(image.size), "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "source": str(original.relative_to(ROOT)).replace("\\", "/"), "authoringScene": "assets/world/archipelago-v6.blend"}
report_path = SOURCE / "build-report-v6.json"
report = json.loads(report_path.read_text(encoding="utf-8"))
report["render"] = "Blender EEVEE / 64 samples / actual archipelago-v6.blend scene"
report["renders"] = records
report["assetSha256"] = {name: hashlib.sha256((PUBLIC / "world" / name).read_bytes()).hexdigest() for name in ("archipelago-v6.glb", "archipelago-v6-low.glb")}
report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(records, indent=2))
