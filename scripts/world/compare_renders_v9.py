"""Build a QA-only side-by-side contact sheet of actual v8/v9 renders."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/"assets/world"
IDS=("pesquisa","gerar","comparar","validar","especificar","evoluir","perspectivas")
canvas=Image.new("RGB",(900,7*306),(244,242,235));draw=ImageDraw.Draw(canvas)
try:font=ImageFont.truetype("C:/Windows/Fonts/arial.ttf",19)
except OSError:font=ImageFont.load_default()
for row,pid in enumerate(IDS):
    for column,version in enumerate((8,9)):
        image=Image.open(SOURCE/f"editorial-v{version}-{pid}.png").convert("RGB")
        image.thumbnail((440,286),Image.Resampling.LANCZOS)
        canvas.paste(image,(column*450,row*306+20))
        draw.text((column*450+10,row*306),f"v{version} — {pid}",fill=(38,50,40),font=font)
path=SOURCE/"comparison-v9.png";canvas.save(path)
print(path)
