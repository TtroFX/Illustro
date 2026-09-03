from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:160]!r}')
    write(path, source.replace(before, after, 1))


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


# Keep the whole-stroke opacity cap invariant; taper visible deposit through per-dab flow.
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#radius * startEnvelope,
      this.#flow,
      this.#strokeOpacity * startEnvelope,
      this.#hardness,
""",
    """      this.#radius * startEnvelope,
      this.#flow * startEnvelope,
      this.#strokeOpacity,
      this.#hardness,
""",
)

# Regression tests: assert both visible envelope and constant stroke cap through canonical rasterization.
replace_once(
    'tests/unit/brush-stroke-start.test.ts',
    """import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
""",
    """import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';
""",
)
replace_once(
    'tests/unit/brush-stroke-start.test.ts',
    """    expect(firstDelta[0]?.radius).toBeCloseTo(5, 6);
    expect(firstDelta[0]?.strokeOpacity).toBeCloseTo(0.5, 6);
    const stableFirst = firstDelta[0];
    const secondDelta = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(secondDelta).toHaveLength(1);
    expect(secondDelta[0]?.radius).toBeCloseTo(10, 6);
    expect(secondDelta[0]?.strokeOpacity).toBeCloseTo(1, 6);
    expect(builder.dabs()[0]).toEqual(stableFirst);
""",
    """    expect(firstDelta[0]?.radius).toBeCloseTo(5, 6);
    expect(firstDelta[0]?.flow).toBeCloseTo(0.5, 6);
    expect(firstDelta[0]?.strokeOpacity).toBeCloseTo(1, 6);
    const stableFirst = firstDelta[0];
    const secondDelta = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(secondDelta).toHaveLength(1);
    expect(secondDelta[0]?.radius).toBeCloseTo(10, 6);
    expect(secondDelta[0]?.flow).toBeCloseTo(1, 6);
    expect(secondDelta[0]?.strokeOpacity).toBeCloseTo(1, 6);
    expect(builder.dabs()[0]).toEqual(stableFirst);

    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.applyDabs('layer', 'start-cap', firstDelta, 'paint');
    store.applyDabs('layer', 'start-cap', secondDelta, 'paint');
    expect(() => store.finalize('start-cap')).not.toThrow();
""",
)
replace_once(
    'tests/unit/brush-stroke-start.test.ts',
    """    expect(finishDelta[0]?.radius).toBeCloseTo(2.5, 6);
    expect(finishDelta[0]?.strokeOpacity).toBeCloseTo(0.2, 6);
""",
    """    expect(finishDelta[0]?.radius).toBeCloseTo(2.5, 6);
    expect(finishDelta[0]?.flow).toBeCloseTo(0.25, 6);
    expect(finishDelta[0]?.strokeOpacity).toBeCloseTo(0.8, 6);
    expect(finishDelta[0]?.opacity).toBeCloseTo(0.2, 6);
""",
)

# Correct the canonical progress note without changing milestone state.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """再開メモ: M6A-028 stroke-start behaviorはstroke.startLengthPxを0..4096 document pxで保持し、0は従来どおり即時開始とする。startLengthPx>0では開始からの累積path distanceに対する線形envelopeを各新規logical stamp生成時だけ計算し、現段階ではradiusとstrokeOpacityを0→baseへ同率で解決して既存primitive dabへ焼き込む。開始点0% stampは出力せずtip repetition indexも消費しない。確定済みdabを後から変更しないためstable-prefixを維持する。M6A-030/031ではこの共通envelopeに対するsize/opacity各々の最小比率・強度を独立設定へ拡張する。次はM6A-029 stroke-end behaviorから再開する。
""",
    """再開メモ: M6A-028 stroke-start behaviorはstroke.startLengthPxを0..4096 document pxで保持し、0は従来どおり即時開始とする。startLengthPx>0では開始からの累積path distanceに対する線形envelopeを各新規logical stamp生成時だけ計算し、現段階ではradiusとper-dab flow/depositを0→baseへ同率で解決しつつ、whole-stroke opacity capはstroke内で一定に保つ。開始点0% stampは出力せずtip repetition indexも消費しない。確定済みdabを後から変更しないためstable-prefixを維持する。M6A-030/031ではこの共通envelopeに対するsize/opacity各々の最小比率・強度を独立設定へ拡張する。次はM6A-029 stroke-end behaviorから再開する。
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A stroke-start opacity-cap correction — 2026-09-03',
    """#### M6A stroke-start opacity-cap correction — 2026-09-03

- The M6A-028 start envelope must not vary `strokeOpacity` from dab to dab. `strokeOpacity` is the canonical whole-stroke alpha cap and remains constant for the lifetime of one stroke.
- The production-visible start envelope therefore scales primitive-dab radius and per-dab flow/deposit while preserving the captured whole-stroke opacity cap. This supersedes the earlier M6A-028 wording that described scaling `strokeOpacity` itself.
- Canonical Raster Tile regression coverage must apply multiple differently tapered dabs in one active paint transaction, ensuring the start behavior does not violate the existing constant-opacity-cap contract.
- M6A-031 remains responsible for the dedicated opacity-taper control semantics; it must build on the common start/end envelope without redefining whole-stroke opacity as a per-dab value.""",
)

print('M6A-028 opacity-cap correction applied')