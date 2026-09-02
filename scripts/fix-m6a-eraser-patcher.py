from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
old = """replace_once(\n    path,\n    \"    const paint = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId);\",\n    \"    const paint = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId, operation);\",\n)\n"""
new = """replace_once(\n    path,\n    \"    const finalization = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId);\",\n    \"    const finalization = this.#mainBaselinePaint.finalizeStroke(\\n      strokeId,\\n      dabs,\\n      layerId,\\n      operation,\\n    );\",\n)\n"""
if old not in text:
    raise RuntimeError('renderer finalization staging anchor not found')
path.write_text(text.replace(old, new, 1))
