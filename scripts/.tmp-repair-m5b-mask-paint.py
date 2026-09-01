from pathlib import Path

path = Path('src/index.html')
text = path.read_text()
old = '<div class="shell-mask-paint-controls" aria-label="レイヤーマスク描画">'
new = '<div class="shell-mask-paint-controls">'
if text.count(old) != 1:
    raise SystemExit(f'expected one mask paint ARIA wrapper; found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
