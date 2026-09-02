from pathlib import Path

path = Path('scripts/verify-m6a-brush.mjs')
text = path.read_text()
old = '''requireText(
  read('src/app/renderer-controller.ts'),
  "operation === 'erase'",
  'eraser recomposite presentation path missing',
);'''
new = '''requireText(
  read('src/app/renderer-controller.ts'),
  "operation !== 'paint'",
  'tile-changing brush recomposite presentation path missing',
);'''
if old not in text:
    raise RuntimeError('legacy Eraser verifier marker not found')
path.write_text(text.replace(old, new, 1))
