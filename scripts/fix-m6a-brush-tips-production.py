from pathlib import Path

path = Path('src/workers/render.worker.ts')
text = path.read_text()
old = '    let tip;\n'
new = '    let tip: ReturnType<typeof normalizeBrushTipDescriptorV1> | undefined;\n'
if old not in text:
    raise SystemExit('brush tip worker typing anchor not found')
path.write_text(text.replace(old, new, 1))
print('brush tip worker typing fixed')
