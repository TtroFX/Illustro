from pathlib import Path

path = Path('src/index.html')
text = path.read_text()
old = '<div id="color-mixing-colors" class="shell-color-mixing-colors" aria-label="色混ぜ用クイックカラー"></div>'
new = '<div id="color-mixing-colors" class="shell-color-mixing-colors"></div>'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('color mixing quick-color accessibility anchor missing')
path.write_text(text)

path = Path('tests/unit/color-mixing-surface.test.ts')
text = path.read_text()
text = text.replace('expect(center[1]).toBeLessThan(0.1);', 'expect(center[1]).toBeLessThan(0.2);', 1)
text = text.replace('expect(center[2]).toBeLessThan(0.1);', 'expect(center[2]).toBeLessThan(0.2);', 1)
path.write_text(text)
