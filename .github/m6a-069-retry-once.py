from pathlib import Path

source_path = Path('.github/m6a-069-apply-once.py')
source = source_path.read_text(encoding='utf-8')
old = 'view-brush-crosshair'
new = 'view-brush-hover-crosshair'
if old not in source:
    raise RuntimeError('expected staged M6A-069 crosshair anchor was not found')
source = source.replace(old, new)
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
