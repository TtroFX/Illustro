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

path = Path('src/domain/color-management.ts')
text = path.read_text()
old = '''    matrixToXyzD50: Object.freeze([
      red[0], green[0], blue[0],
      red[1], green[1], blue[1],
      red[2], green[2], blue[2],
    ]),'''
new = '''    matrixToXyzD50: Object.freeze([
      red[0], green[0], blue[0],
      red[1], green[1], blue[1],
      red[2], green[2], blue[2],
    ]) as Matrix3V1,'''
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('color management matrix tuple anchor missing')
path.write_text(text)
