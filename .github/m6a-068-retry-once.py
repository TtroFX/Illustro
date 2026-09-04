from pathlib import Path
import runpy

runpy.run_path('.github/m6a-068-apply-once.py', run_name='__main__')

path = Path('src/app/global-pressure-response-controller.ts')
text = path.read_text(encoding='utf-8')
old = "input.root.dataset.illustroGlobalPressureCurve = responseCurvePresetIdV1(state.curve);"
new = "input.root.dataset.illustroGlobalPressureCurve = responseCurvePresetIdV1(state.curve) ?? 'custom';"
if text.count(old) != 1:
    raise RuntimeError('expected one global pressure dataset assignment')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
