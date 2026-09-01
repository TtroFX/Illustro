from pathlib import Path

path = Path('src/app/layer-workflow-controller.ts')
text = path.read_text()
old = """  const onMaskInvert = (): void => {\n    const target = options.maskPaint.snapshot();\n    if (target.layerId === null || target.maskId === null) return;\n    const current = options.paintSession.projectSnapshot();\n    const layer = current?.document.layerTree.layers[target.layerId];\n    const mask = layer?.masks.find((entry) => entry.id === target.maskId);\n    if (current === null || mask?.kind !== 'raster-mask') return;\n    commitMutation(\n      'mask.invert',\n      (before, revision) =>\n        setMaskInvertedSnapshotV1(before, target.layerId!, target.maskId!, !mask.inverted, revision),\n      () => target.layerId,\n    );\n  };\n"""
new = """  const onMaskInvert = (): void => {\n    const target = options.maskPaint.snapshot();\n    const layerId = target.layerId;\n    const maskId = target.maskId;\n    if (layerId === null || maskId === null) return;\n    const current = options.paintSession.projectSnapshot();\n    const layer = current?.document.layerTree.layers[layerId];\n    const mask = layer?.masks.find((entry) => entry.id === maskId);\n    if (current === null || mask?.kind !== 'raster-mask') return;\n    commitMutation(\n      'mask.invert',\n      (before, revision) =>\n        setMaskInvertedSnapshotV1(before, layerId, maskId, !mask.inverted, revision),\n      () => layerId,\n    );\n  };\n"""
if text.count(old) != 1:
    raise SystemExit(f'expected one mask invert handler; found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
