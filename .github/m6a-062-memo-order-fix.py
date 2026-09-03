from pathlib import Path

path = Path('ILLUSTRO_DESIGN_MEMO.md')
text = path.read_text(encoding='utf-8')
block = """## M6A ordinary raster color-mixing boundary — 2026-09-04

**AUTHORITATIVE for M6A-062.** Ordinary raster color mixing is a deterministic digital paint behavior, not physical pigment/fluid simulation. The M6A-062 production subset uses `colorMix.enabled`, `colorMix.canvasRatio` (`0..1`, default `0.5`) and `colorMix.depositAmount` (`0..1`, default `1`). The feature is inert unless enabled and applies only to ordinary Raster paint; Eraser, basic Smudge and Blur keep their existing operation semantics.

For each covered destination pixel, the brush color and the current canonical active-Raster-Layer pixel are mixed in linear-light RGB and converted back through the document RGB transfer function before the normal source-over deposit. `canvasRatio=0` means brush color only and `canvasRatio=1` means fully available canvas color. Canvas contribution is multiplied by destination alpha, so fully transparent pixels never inject hidden/black RGB into the brush color. `depositAmount` scales the per-dab deposited coverage before the existing flow/stroke-opacity accumulation rule and therefore composes with, rather than bypasses, normal opacity/flow semantics.

The resolved M6A-062 values are carried on canonical dabs so Render Worker, history/recovery and deterministic reconstruction do not depend on the currently selected preset. Because the existing additive WebGPU preview shader cannot sample the destination color, any dab with ordinary color mixing enabled uses the retained canonical Raster Tile preview/recomposition path; non-mixing paint remains on the existing fast path without changed output. M6A-063 remains responsible for sample/pickup radius, pickup amount, stateful carried color and drag/extension semantics; M6A-062 does not introduce a wet reservoir or physical paint simulation.

"""
if text.count(block) != 1:
    raise SystemExit(f'expected exactly one M6A-062 block, found {text.count(block)}')
text = text.replace(block, '', 1)
end = "Primitive dabs, Worker payloads, history and recovery continue to use the existing resolved `tipAngleDegrees` field; no Spray-orientation-specific primitive field is introduced.\n"
if text.count(end) != 1:
    raise SystemExit(f'expected exactly one M6A-061 end marker, found {text.count(end)}')
text = text.replace(end, end + '\n' + block, 1)
orientation = text.index('## M6A spray particle-orientation boundary — 2026-09-03')
authoritative_61 = text.index('**AUTHORITATIVE for M6A-061.**')
mixing = text.index('## M6A ordinary raster color-mixing boundary — 2026-09-04')
if not orientation < authoritative_61 < mixing:
    raise SystemExit('M6A canonical section order is invalid')
path.write_text(text.rstrip() + '\n', encoding='utf-8')
