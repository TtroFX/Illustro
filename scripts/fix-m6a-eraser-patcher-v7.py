from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
old = "    this.#kernel = new BaselineBrushDabBuilderV1({ color: options.color });"
new = "    this.#kernel =\n      options.color === undefined\n        ? new BaselineBrushDabBuilderV1()\n        : new BaselineBrushDabBuilderV1({ color: options.color });"
if old not in text:
    raise RuntimeError('M6A exact optional brush color anchor not found')
path.write_text(text.replace(old, new, 1))
