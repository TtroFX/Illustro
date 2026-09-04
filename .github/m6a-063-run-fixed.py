from base64 import b64decode
from pathlib import Path
from zlib import decompress

bootstrap = Path('.github/m6a-063-apply-once.py').read_text(encoding='utf-8')
encoded = bootstrap.split("b64decode('''", 1)[1].split("''')", 1)[0]
payload = decompress(b64decode(encoded)).decode('utf-8')
old = 'const locked = selected.locked'
new = 'tipShape.value = brushTipShapeV1(selected.preset)'
if payload.count(old) != 2:
    raise SystemExit(f'unexpected M6A-063 bootstrap locked-anchor count: {payload.count(old)}')
payload = payload.replace(old, new)
old_handler = "'  const onTipShape = (): void =>\\n',"
new_handler = "'  const onTipShape = (): void => {\\n',"
if payload.count(old_handler) != 1:
    raise SystemExit(f'unexpected M6A-063 handler-anchor count: {payload.count(old_handler)}')
payload = payload.replace(old_handler, new_handler, 1)
exec(compile(payload, '<m6a063-fixed>', 'exec'))
