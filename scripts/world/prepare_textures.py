"""Derive small web textures from the retained Poly Haven CC0 source maps.

Run with system Python (Pillow). This only creates assets/world/textures/derived.
"""
from pathlib import Path
from PIL import Image, ImageEnhance
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world/textures/source"
DEST = ROOT / "assets/world/textures/derived"
DEST.mkdir(parents=True, exist_ok=True)

def tinted(src, target, name, contrast=.28, size=512):
    image = Image.open(SOURCE / src).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    gray = image.convert("L")
    mean = sum(gray.getdata()) / (size * size)
    out = Image.new("RGB", image.size)
    out.putdata([tuple(max(0, min(255, round(c * (1 + contrast * ((p-mean)/max(mean, 1)))))) for c in target) for p in gray.getdata()])
    out.save(DEST / name, "JPEG", quality=84, optimize=True)

plaster = "white_plaster_02_diff_1k.jpg"
for name, col in {
    "plaster_cream.jpg": (210, 199, 175),
    "plaster_terracotta.jpg": (169, 98, 67),
    "plaster_sage.jpg": (94, 112, 99),
    "plaster_blue.jpg": (91, 111, 134),
    "plaster_sand.jpg": (193, 178, 145),
    "plaster_olive.jpg": (114, 120, 83),
}.items():
    tinted(plaster, col, name, .32)
tinted("stone_tiles_02_diff_1k.jpg", (207, 194, 170), "stone_paving.jpg", .24, 1024)
oak = Image.open(SOURCE / "oak_veneer_01_diff_1k.jpg").convert("RGB").resize((512,512), Image.Resampling.LANCZOS)
oak = ImageEnhance.Color(oak).enhance(.72)
oak = ImageEnhance.Brightness(oak).enhance(.91)
oak.save(DEST / "oak_veneer.jpg", "JPEG", quality=86, optimize=True)
for source, name in [("white_plaster_02_nor_gl_1k.jpg", "plaster_normal.jpg"), ("oak_veneer_01_nor_gl_1k.jpg", "oak_normal.jpg"), ("stone_tiles_02_nor_gl_1k.jpg", "stone_normal.jpg")]:
    Image.open(SOURCE/source).resize((512,512), Image.Resampling.LANCZOS).save(DEST/name,"JPEG",quality=82,optimize=True)
print(json.dumps({p.name:p.stat().st_size for p in DEST.iterdir()}, indent=2))
