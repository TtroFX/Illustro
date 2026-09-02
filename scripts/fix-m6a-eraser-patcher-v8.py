from pathlib import Path

path = Path('scripts/verify-m5d-color.mjs')
text = path.read_text()
old = "  'new CanonicalRasterBrushStrokeV1({ color: this.#paintColor })',"
new = "  'color: this.#paintColor',"
if old not in text:
    raise RuntimeError('M5D exact Raster Brush constructor marker not found')
path.write_text(text.replace(old, new, 1))
