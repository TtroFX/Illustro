from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
old = """replace_once(\n    path,\n    \"requireText(canonical, \\\"export type CanonicalBrushModeV1 = 'raster';\\\", 'Raster mode identity missing');\",\n    \"requireText(\\n  canonical,\\n  \\\"export type CanonicalBrushModeV1 = 'raster' | 'eraser';\\\",\\n  'Raster/Eraser mode identity missing',\\n);\",\n)\n"""
new = """replace_once(\n    path,\n    \"requireText(\\n  canonical,\\n  \\\"export type CanonicalBrushModeV1 = 'raster';\\\",\\n  'Raster mode identity missing',\\n);\",\n    \"requireText(\\n  canonical,\\n  \\\"export type CanonicalBrushModeV1 = 'raster' | 'eraser';\\\",\\n  'Raster/Eraser mode identity missing',\\n);\",\n)\n"""
if old not in text:
    raise RuntimeError('M6A verifier staging anchor not found')
path.write_text(text.replace(old, new, 1))
