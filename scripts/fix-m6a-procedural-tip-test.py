from pathlib import Path

p = Path('scripts/apply-m6a-procedural-tip.py')
text = p.read_text()
old = "    const cornerPixel = 26 * roundTile.width + 26;"
new = "    const cornerPixel = 25 * roundTile.width + 25;"
if old not in text:
    raise RuntimeError('procedural tip test corner anchor not found')
p.write_text(text.replace(old, new, 1))
print('procedural tip corner test fixed')
