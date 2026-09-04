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
for old_type, new_type in (
    ('    sampleRadiusRatio = this.#brushColorMixSampleRadiusRatio,', '    sampleRadiusRatio: number = this.#brushColorMixSampleRadiusRatio,'),
    ('    pickupAmount = this.#brushColorMixPickupAmount,', '    pickupAmount: number = this.#brushColorMixPickupAmount,'),
    ('    carryAmount = this.#brushColorMixCarryAmount,', '    carryAmount: number = this.#brushColorMixCarryAmount,'),
):
    if payload.count(old_type) != 1:
        raise SystemExit(f'unexpected M6A-063 runtime parameter type anchor count: {payload.count(old_type)}: {old_type}')
    payload = payload.replace(old_type, new_type, 1)
for old_field, new_field in (
    ('#brushColorMixSampleRadiusRatio = DEFAULT_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1;', '#brushColorMixSampleRadiusRatio: number = DEFAULT_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1;'),
    ('#brushColorMixPickupAmount = DEFAULT_BRUSH_COLOR_MIX_PICKUP_AMOUNT_V1;', '#brushColorMixPickupAmount: number = DEFAULT_BRUSH_COLOR_MIX_PICKUP_AMOUNT_V1;'),
    ('#brushColorMixCarryAmount = DEFAULT_BRUSH_COLOR_MIX_CARRY_AMOUNT_V1;', '#brushColorMixCarryAmount: number = DEFAULT_BRUSH_COLOR_MIX_CARRY_AMOUNT_V1;'),
):
    if payload.count(old_field) != 1:
        raise SystemExit(f'unexpected M6A-063 runtime field type anchor count: {payload.count(old_field)}: {old_field}')
    payload = payload.replace(old_field, new_field, 1)
exec(compile(payload, '<m6a063-fixed>', 'exec'))
