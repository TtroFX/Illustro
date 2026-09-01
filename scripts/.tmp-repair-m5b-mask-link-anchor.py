from pathlib import Path

path = Path('scripts/.tmp-implement-m5b-mask-link.py')
text = path.read_text()
old = '''    "    maskInvertButton.title = selectedRasterMask?.inverted === true ? 'マスク反転を解除' : 'マスクを反転';",'''
new = '''    "    maskInvertButton.title =\\n      selectedRasterMask?.inverted === true ? 'マスク反転を解除' : 'マスクを反転';",'''
if text.count(old) != 1:
    raise SystemExit(f'expected one mask invert title anchor in patch script; found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
