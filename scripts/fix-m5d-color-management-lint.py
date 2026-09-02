from pathlib import Path

path = Path('tests/unit/color-management.test.ts')
text = path.read_text()
old = '  parameters.forEach((value, index) => writeFixed(view, 12 + index * 4, value));'
new = '''  parameters.forEach((value, index) => {
    writeFixed(view, 12 + index * 4, value);
  });'''
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('color management lint anchor missing')
path.write_text(text)
