from pathlib import Path

worker = Path('src/workers/render.worker.ts')
worker_text = worker.read_text()
old_worker = '    let tip;\n'
new_worker = '    let tip: ReturnType<typeof normalizeBrushTipDescriptorV1> | undefined;\n'
if old_worker in worker_text:
    worker_text = worker_text.replace(old_worker, new_worker, 1)
elif new_worker not in worker_text:
    raise SystemExit('brush tip worker typing anchor not found')
worker.write_text(worker_text)

brush_tip = Path('src/domain/brush-tip.ts')
text = brush_tip.read_text()
old_import = "import {\n  normalizeBrushPresetV1,"
new_import = "import { toJsonValue } from './serialization.js';\nimport {\n  normalizeBrushPresetV1,"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif "import { toJsonValue } from './serialization.js';" not in text:
    raise SystemExit('brush tip serialization import anchor not found')
old_assets = "    assets: tip.assets,\n"
new_assets = "    assets: toJsonValue(tip.assets),\n"
if old_assets not in text:
    raise SystemExit('brush tip JSON assets anchor not found')
text = text.replace(old_assets, new_assets, 1)
brush_tip.write_text(text)

print('brush tip production typing fixed')
