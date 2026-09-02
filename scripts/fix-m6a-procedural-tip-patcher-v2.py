from pathlib import Path

p = Path('scripts/apply-m6a-procedural-tip.py')
text = p.read_text()

old = '''# Square paint uses canonical dirty-tile presentation, avoiding the round-only provisional GPU/Canvas2D stamp path.\nreplace(\n    'src/gpu/baseline-paint-renderer.ts',\n    \"      if (operation !== 'paint') {\",\n    \"      if (operation !== 'paint' || delta.some((dab) => dab.tipShape === 'square')) {\",\n)\nreplace(\n    'src/app/renderer-controller.ts',\n    \"      if (operation !== 'paint') {\",\n    \"      if (operation !== 'paint' || dabs.some((dab) => dab.tipShape === 'square')) {\",\n)\n'''
new = '''# Square paint uses canonical dirty-tile presentation, avoiding the round-only provisional GPU/Canvas2D stamp path.\n# Keep the existing flow/stroke-opacity canonical-preview rule and extend it for square tips.\nreplace(\n    'src/gpu/baseline-paint-renderer.ts',\n    \"function requiresCanonicalPaintPreview(dabs: readonly BaselineBrushDabV1[]): boolean {\\n  return dabs.some(\\n    (dab) =>\\n      baselineDabUsesFlowOpacityV1(dab) &&\\n      (baselineDabFlowV1(dab) < 1 || baselineDabStrokeOpacityV1(dab) < 1),\\n  );\\n}\",\n    \"function requiresCanonicalPaintPreview(dabs: readonly BaselineBrushDabV1[]): boolean {\\n  return dabs.some(\\n    (dab) =>\\n      dab.tipShape === 'square' ||\\n      (baselineDabUsesFlowOpacityV1(dab) &&\\n        (baselineDabFlowV1(dab) < 1 || baselineDabStrokeOpacityV1(dab) < 1)),\\n  );\\n}\",\n)\nreplace(\n    'src/app/renderer-controller.ts',\n    \"      if (operation !== 'paint') {\",\n    \"      if (operation !== 'paint' || dabs.some((dab) => dab.tipShape === 'square')) {\",\n)\n'''
if old not in text:
    raise RuntimeError('old square-preview patch block not found')
text = text.replace(old, new, 1)

# Preserve tipShape through BaselinePaintRenderer's owned dab copies and prefix equality.
anchor = '''# Canonical rasterizer evaluates either circular radius or Chebyshev square distance.\n'''
insert = '''# Renderer-owned dab copies must preserve tip identity for canonical rasterization/recovery.\nreplace(\n    'src/gpu/baseline-paint-renderer.ts',\n    \"        ...(dab.strokeOpacity === undefined ? {} : { strokeOpacity: dab.strokeOpacity }),\\n        ...(dab.color === undefined\",\n    \"        ...(dab.strokeOpacity === undefined ? {} : { strokeOpacity: dab.strokeOpacity }),\\n        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),\\n        ...(dab.color === undefined\",\n)\nreplace(\n    'src/gpu/baseline-paint-renderer.ts',\n    \"    (dab.strokeOpacity === undefined ||\\n      (Number.isFinite(dab.strokeOpacity) && dab.strokeOpacity >= 0 && dab.strokeOpacity <= 1))\\n  );\",\n    \"    (dab.strokeOpacity === undefined ||\\n      (Number.isFinite(dab.strokeOpacity) && dab.strokeOpacity >= 0 && dab.strokeOpacity <= 1)) &&\\n    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')\\n  );\",\n)\nreplace(\n    'src/gpu/baseline-paint-renderer.ts',\n    \"    baselineDabStrokeOpacityV1(left) === baselineDabStrokeOpacityV1(right) &&\\n    baselineDabColorV1(left).every(\",\n    \"    baselineDabStrokeOpacityV1(left) === baselineDabStrokeOpacityV1(right) &&\\n    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&\\n    baselineDabColorV1(left).every(\",\n)\n\n'''
if anchor not in text:
    raise RuntimeError('canonical rasterizer anchor not found')
text = text.replace(anchor, insert + anchor, 1)

p.write_text(text)
print('procedural tip renderer identity patcher fixed')
