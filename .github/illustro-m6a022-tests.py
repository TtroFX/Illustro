from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:100]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


write_new(
    'tests/unit/brush-tip-density.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTipDensityV1,
  createBaselineBrushPresetV1,
  withBrushTipDensityV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-022 brush tip density', () => {
  it('uses a legacy-safe full-density fallback and persists a static 0..1 preset value', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'density.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDensityV1(preset)).toBe(1);
    const sparse = withBrushTipDensityV1(preset, 0.4);
    expect(sparse.schema).toBe('illustro.brush/1');
    expect(brushTipDensityV1(sparse)).toBe(0.4);
    expect(() => withBrushTipDensityV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushTipDensityV1(preset, 1.01)).toThrow(RangeError);
  });

  it('captures tip density into every primitive dab including sampled image micro dabs', () => {
    const round = new BaselineBrushDabBuilderV1({ sizePx: 16, tipDensity: 0.3 });
    round.begin({ documentX: 24, documentY: 24 });
    round.append([{ documentX: 36, documentY: 24 }]);
    expect(round.finish().every((dab) => dab.tipDensity === 0.3)).toBe(true);

    const sampled = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipDensity: 0.2,
      tipShape: 'sampled-image',
    });
    expect(
      sampled.begin({ documentX: 24, documentY: 24 }).every((dab) => dab.tipDensity === 0.2),
    ).toBe(true);
  });

  it('reduces canonical tip mask coverage independently from flow', () => {
    const sparse = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const dense = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const base = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 10,
      opacity: 1,
      flow: 1,
      strokeOpacity: 1,
      hardness: 1,
      tipShape: 'round' as const,
      color: [1, 0, 0] as const,
    };
    sparse.applyDabs('layer', 'sparse', [Object.freeze({ ...base, tipDensity: 0.25 })], 'paint');
    dense.applyDabs('layer', 'dense', [Object.freeze({ ...base, tipDensity: 1 })], 'paint');
    sparse.finalize('sparse');
    dense.finalize('dense');
    const sparseTile = sparse.exportTiles()[0];
    const denseTile = dense.exportTiles()[0];
    if (sparseTile === undefined || denseTile === undefined) throw new Error('missing raster tile');
    const centerPixel = 32 * sparseTile.width + 32;
    const sparseAlpha = readBaselineRasterTilePixelV1(sparseTile, centerPixel)[3];
    const denseAlpha = readBaselineRasterTilePixelV1(denseTile, centerPixel)[3];
    expect(sparseAlpha).toBeGreaterThan(0);
    expect(denseAlpha).toBeGreaterThan(sparseAlpha);
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-022 tip density:完了', 'M6A-022 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipDensityV1',
  'brush tip density preset helper missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabTipDensityV1',
  'canonical raster tip-density coverage missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY',
  'non-default tip-density canonical preview fallback missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(hardness === undefined ? {} : { hardness })',
  'worker parser does not preserve brush hardness',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(tipDensity === undefined ? {} : { tipDensity })',
  'worker parser does not preserve brush tip density',
);
requireText(
  read('src/index.html'),
  'id=\"brush-tip-density-range\"',
  'reachable brush tip-density control missing',
);
requireText(
  read('tests/unit/brush-tip-density.test.ts'),
  'reduces canonical tip mask coverage independently from flow',
  'brush tip-density regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-022 tip density:未完了',
    'M6A-022 tip density:完了',
)
append_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-022 tip-density resume memo — 2026-09-03',
    """### M6A-022 tip-density resume memo — 2026-09-03

- `tipDensity` is a static `0..1` brush-tip mask coverage strength and is intentionally separate from M6A-015 `flow`, which controls repeated-stamp ink deposit.
- The value is captured at stroke start and persisted on each primitive dab. Missing legacy values resolve to `1.0`.
- Shared canonical tip coverage applies density to paint/erase/smudge/blur paths. Default density `1.0` keeps the existing direct WebGPU fast path; non-default density uses canonical tile preview.
- Worker dab parsing now preserves both M6A-021 `hardness` and M6A-022 `tipDensity`, closing the Worker/Main semantic mismatch discovered during M6A-022 inspection.
- M6A-023 spacing / gap remains intentionally separate and is the next incomplete item.""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A tip-density boundary — 2026-09-03',
    """#### M6A tip-density boundary — 2026-09-03

- Tip density is a static `0..1` multiplier on brush-tip mask coverage. It is not an alias for flow: flow controls how much ink repeated stamps deposit, while tip density controls how strongly the selected tip mask covers at each stamp.
- Tip density is captured once at stroke start and copied to primitive dabs, so history, save/recovery, Worker/Main rendering, and incremental stroke rendering share the same deterministic value. Legacy dabs without the field resolve to `1.0`.
- The canonical raster tip-coverage function is the semantic owner for density across paint, erase, smudge, and blur. Density `1.0` preserves the existing direct WebGPU fast path; non-default values route through canonical tile preview until a later optimized shader path is justified.
- Worker message parsing must preserve static dab semantics such as hardness and tip density rather than silently reverting to defaults.
- Spacing/gap remains a separate M6A-023 stroke-placement parameter.""",
)

print('M6A-022 tests and docs patch applied')