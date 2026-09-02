from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
replacements = {
    "requireText('src/gpu/baseline-raster-tile-store.ts', 'rasterizeEraseDab'": "requireText(read('src/gpu/baseline-raster-tile-store.ts'), 'rasterizeEraseDab'",
    "requireText('src/app/renderer-controller.ts', \\\"operation === 'erase'\\\"": "requireText(read('src/app/renderer-controller.ts'), \\\"operation === 'erase'\\\"",
    "requireText('src/workers/render.worker.ts', \\\"value.operation === 'erase'\\\"": "requireText(read('src/workers/render.worker.ts'), \\\"value.operation === 'erase'\\\"",
    "requireText('src/index.html', 'id=\\\\\\\"brush-mode-eraser\\\\\\\"'": "requireText(read('src/index.html'), 'id=\\\\\\\"brush-mode-eraser\\\\\\\"'",
}
for old, new in replacements.items():
    if old not in text:
        raise RuntimeError(f'M6A verifier source anchor not found: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)
