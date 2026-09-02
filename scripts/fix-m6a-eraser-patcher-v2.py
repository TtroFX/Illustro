from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()
old = """replace_once(\n    path,\n    \"      layerId: value.layerId,\\n      dabs,\\n    };\",\n    \"      layerId: value.layerId,\\n      dabs,\\n      operation: (value.operation ?? 'paint') as BaselineBrushCompositeOperationV1,\\n    };\",\n)\n"""
new = """replace_once(\n    path,\n    \"          layerId: value.layerId,\\n          dabs,\\n        };\",\n    \"          layerId: value.layerId,\\n          dabs,\\n          operation: (value.operation ?? 'paint') as BaselineBrushCompositeOperationV1,\\n        };\",\n)\n"""
if old not in text:
    raise RuntimeError('Worker request parser staging anchor not found')
path.write_text(text.replace(old, new, 1))
