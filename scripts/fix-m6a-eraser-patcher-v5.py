from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
old = '<div class="shell-rail-slots" role="group" aria-label="描画ツール">'
new = '<div class="shell-rail-slots">'
if old not in text:
    raise RuntimeError('M6A Eraser semantic tool-rail anchor not found')
path.write_text(text.replace(old, new, 1))
