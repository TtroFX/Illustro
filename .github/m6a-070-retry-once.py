from pathlib import Path
import runpy

runpy.run_path('.github/m6a-070-apply-once.py', run_name='__main__')

path = Path('src/app/stylus-button-action-controller.ts')
text = path.read_text(encoding='utf-8')
old = "[...primaryBarrelSelect.options].some((option) => option.value === value)"
new = "Array.from(primaryBarrelSelect.options).some((option) => option.value === value)"
if text.count(old) != 1:
    raise RuntimeError('expected one HTMLOptionsCollection spread')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
