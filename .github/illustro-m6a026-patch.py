from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:140]!r}')
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


# Domain: follow rotation is a stroke-placement boolean, separate from static tip angle/direction.
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_FOLLOW_STROKE_ROTATION_V1 = false as const;

export function brushFollowStrokeRotationV1(preset: BrushPresetV1): boolean {
  const value = preset.stroke.followRotation;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_FOLLOW_STROKE_ROTATION_V1;
}

export function withBrushFollowStrokeRotationV1(
  preset: BrushPresetV1,
  followRotation: boolean,
): BrushPresetV1 {
  if (typeof followRotation !== 'boolean') {
    throw new TypeError('brush follow rotation must be boolean');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, followRotation },
  });
}""",
)

# Kernel: derive a deterministic local tangent for each newly emitted logical stamp.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #tipAngleDegrees: number;
  readonly #tipDirectionDegrees: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #tipAngleDegrees: number;
  readonly #tipDirectionDegrees: number;
  readonly #followStrokeRotation: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #lastPoint: { x: number; y: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
  #distanceUntilNext: number;
""",
    """  #lastPoint: { x: number; y: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
  #lastStrokeDirectionDegrees: number | null = null;
  #distanceUntilNext: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const tipDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipDirectionDegrees ?? BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
    );
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
""",
    """    const tipDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipDirectionDegrees ?? BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
    );
    const followStrokeRotation = options.followStrokeRotation ?? false;
    if (typeof followStrokeRotation !== 'boolean') {
      throw new TypeError('baseline brush follow rotation must be boolean');
    }
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipDirectionDegrees = tipDirectionDegrees;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipDirectionDegrees = tipDirectionDegrees;
    this.#followStrokeRotation = followStrokeRotation;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          this.#tipDensity,
          this.#resolvedTipAngleDegrees(),
          this.#color,
""",
    """          this.#tipDensity,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#color,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #resolvedTipAngleDegrees(): number {
    return normalizeBaselineBrushTipAngleDegreesV1(
      this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(x: number, y: number): void {
""",
    """  #resolvedTipAngleDegrees(strokeDirectionDegrees?: number): number {
    const followAngle =
      this.#followStrokeRotation && strokeDirectionDegrees !== undefined
        ? strokeDirectionDegrees
        : 0;
    return normalizeBaselineBrushTipAngleDegreesV1(
      followAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(x: number, y: number): void {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let remaining = Math.hypot(x - cursorX, y - cursorY);

    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
""",
    """    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let remaining = Math.hypot(x - cursorX, y - cursorY);
    if (remaining > 0) {
      this.#lastStrokeDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
        (Math.atan2(y - lastPoint.y, x - lastPoint.x) * 180) / Math.PI,
      );
    }

    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        this.#tipDensity,
        this.#resolvedTipAngleDegrees(),
        this.#color,
""",
    """        this.#tipDensity,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        this.#color,
""",
)

# Canonical stroke forwards the follow flag; no dab schema change is needed.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.tipDirectionDegrees === undefined
        ? {}
        : { tipDirectionDegrees: options.tipDirectionDegrees }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.tipDirectionDegrees === undefined
        ? {}
        : { tipDirectionDegrees: options.tipDirectionDegrees }),
      ...(options.followStrokeRotation === undefined
        ? {}
        : { followStrokeRotation: options.followStrokeRotation }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)

# Paint session captures follow-rotation per stroke.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTipAngleDegrees: number;
  readonly brushTipDirectionDegrees: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushTipAngleDegrees: number;
  readonly brushTipDirectionDegrees: number;
  readonly brushFollowStrokeRotation: boolean;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipDirectionDegrees: number = BASELINE_BRUSH_TIP_DIRECTION_DEGREES;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipDirectionDegrees: number = BASELINE_BRUSH_TIP_DIRECTION_DEGREES;
  #brushFollowStrokeRotation = false;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipDirectionDegrees: this.#brushTipDirectionDegrees,
      brushTipShape: this.#brushTipShape,
""",
    """      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipDirectionDegrees: this.#brushTipDirectionDegrees,
      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushFollowStrokeRotation(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime follow rotation');
    if (enabled !== this.#brushFollowStrokeRotation) this.#clearActiveStroke();
    this.#brushFollowStrokeRotation = enabled;
    return this.#brushFollowStrokeRotation;
  }

  brushFollowStrokeRotation(): boolean {
    return this.#brushFollowStrokeRotation;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      tipAngleDegrees: this.#brushTipAngleDegrees,
      tipDirectionDegrees: this.#brushTipDirectionDegrees,
      tipDensity: this.#brushTipDensity,
""",
    """      tipAngleDegrees: this.#brushTipAngleDegrees,
      tipDirectionDegrees: this.#brushTipDirectionDegrees,
      followStrokeRotation: this.#brushFollowStrokeRotation,
      tipDensity: this.#brushTipDensity,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipAngleDegreesV1,
  withBrushTipDirectionDegreesV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTipAngleDegreesV1,
  withBrushTipDirectionDegreesV1,
  withBrushFollowStrokeRotationV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetFollowRotationV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushFollowStrokeRotationV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)

# Tool Properties: app-owned toggle button, not a platform-native checkbox.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipAngleDegreesV1,
  brushTipDirectionDegreesV1,
  brushStrokeSpacingV1,
""",
    """  brushTipAngleDegreesV1,
  brushTipDirectionDegreesV1,
  brushFollowStrokeRotationV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipAngleV1,
  updateBrushPresetTipDirectionV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTipAngleV1,
  updateBrushPresetTipDirectionV1,
  updateBrushPresetFollowRotationV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const tipDirectionRange = requireElement('#brush-tip-direction-range', HTMLInputElement);
  const tipDirectionNumber = requireElement('#brush-tip-direction-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const tipDirectionRange = requireElement('#brush-tip-direction-range', HTMLInputElement);
  const tipDirectionNumber = requireElement('#brush-tip-direction-number', HTMLInputElement);
  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTipDirectionDegrees = String(
      brushTipDirectionDegreesV1(item.preset),
    );
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTipDirectionDegrees = String(
      brushTipDirectionDegreesV1(item.preset),
    );
    input.root.dataset.illustroBrushFollowRotation = String(
      brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tipDirectionDegrees = brushTipDirectionDegreesV1(selected.preset);
    configurePair(tipDirectionRange, tipDirectionNumber, 0, 359, 1, tipDirectionDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const tipDirectionDegrees = brushTipDirectionDegreesV1(selected.preset);
    configurePair(tipDirectionRange, tipDirectionNumber, 0, 359, 1, tipDirectionDegrees);
    const followRotation = brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipDirectionRange,
      tipDirectionNumber,
      tipShape,
""",
    """      tipDirectionRange,
      tipDirectionNumber,
      followRotationButton,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTipDirectionRange = (): void => updateTipDirection(Number(tipDirectionRange.value));
  const onTipDirectionNumber = (): void => updateTipDirection(Number(tipDirectionNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTipDirectionRange = (): void => updateTipDirection(Number(tipDirectionRange.value));
  const onTipDirectionNumber = (): void => updateTipDirection(Number(tipDirectionNumber.value));
  const onFollowRotation = (): void =>
    mutate(() =>
      updateBrushPresetFollowRotationV1(
        state,
        state.selectedPresetId,
        !brushFollowStrokeRotationV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tipDirectionRange.addEventListener('input', onTipDirectionRange);
  tipDirectionNumber.addEventListener('change', onTipDirectionNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  tipDirectionRange.addEventListener('input', onTipDirectionRange);
  tipDirectionNumber.addEventListener('change', onTipDirectionNumber);
  followRotationButton.addEventListener('click', onFollowRotation);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipDirectionRange.removeEventListener('input', onTipDirectionRange);
      tipDirectionNumber.removeEventListener('change', onTipDirectionNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      tipDirectionRange.removeEventListener('input', onTipDirectionRange);
      tipDirectionNumber.removeEventListener('change', onTipDirectionNumber);
      followRotationButton.removeEventListener('click', onFollowRotation);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-direction-range">先端基準方向</label>
                <input id="brush-tip-direction-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-direction-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端基準方向" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-direction-range">先端基準方向</label>
                <input id="brush-tip-direction-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-direction-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端基準方向" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-follow-rotation">ストローク追従</label>
                <button id="brush-follow-rotation" type="button" aria-pressed="false" title="ブラシ先端をストローク方向へ追従回転">OFF</button>
                <span class="shell-brush-tip-kind">回転</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

write_new(
    'tests/unit/brush-follow-rotation.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushFollowStrokeRotationV1,
  createBaselineBrushPresetV1,
  withBrushFollowStrokeRotationV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-026 follow stroke rotation', () => {
  it('defaults legacy presets to fixed orientation and persists an explicit follow flag', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'follow.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushFollowStrokeRotationV1(preset)).toBe(false);
    expect(brushFollowStrokeRotationV1(withBrushFollowStrokeRotationV1(preset, true))).toBe(true);
  });

  it('rotates only newly emitted stamps from the local stroke tangent without rewriting the stable prefix', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: true,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 8, documentY: 0 }]);
    builder.append([{ documentX: 8, documentY: 8 }]);
    const dabs = builder.finish();
    expect(dabs.map((dab) => [dab.x, dab.y])).toEqual([
      [0, 0],
      [4, 0],
      [8, 0],
      [8, 4],
      [8, 8],
    ]);
    expect(dabs.map((dab) => dab.tipAngleDegrees)).toEqual([315, 315, 315, 45, 45]);
  });

  it('uses the last confirmed movement direction for a retained short endpoint', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: true,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 0, documentY: 3 }]);
    const dabs = builder.finish();
    expect(dabs.map((dab) => [dab.x, dab.y])).toEqual([
      [0, 0],
      [0, 3],
    ]);
    expect(dabs.map((dab) => dab.tipAngleDegrees)).toEqual([315, 45]);
  });

  it('keeps static angle minus tip direction when follow rotation is disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: false,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 0, documentY: 8 }]);
    expect(builder.finish().map((dab) => dab.tipAngleDegrees)).toEqual([315, 315, 315]);
  });
});""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-025 tip direction:完了
再開メモ: M6A-025 tip directionはtip.directionDegreesを先端アセット固有の前方向として0..360°に正規化し、固定モードの実効角をtip.angleDegrees - tip.directionDegreesとしてstroke開始時に解決する。primitive dabには既存tipAngleDegreesへ解決済み角度だけを保存し、directionをdab schemaへ重複保存しない。procedural/sampled/custom tipはM6A-024の同一回転経路を共有する。次はM6A-026 follow stroke rotationから再開し、stroke tangentをこの固定角へ合成する。
M6A-026 follow stroke rotation:未完了
M6A-027 stroke repetition:未完了
""",
    """M6A-025 tip direction:完了
再開メモ: M6A-025 tip directionはtip.directionDegreesを先端アセット固有の前方向として0..360°に正規化し、固定モードの実効角をtip.angleDegrees - tip.directionDegreesとしてstroke開始時に解決する。primitive dabには既存tipAngleDegreesへ解決済み角度だけを保存し、directionをdab schemaへ重複保存しない。procedural/sampled/custom tipはM6A-024の同一回転経路を共有する。次はM6A-026 follow stroke rotationから再開し、stroke tangentをこの固定角へ合成する。
M6A-026 follow stroke rotation:完了
再開メモ: M6A-026 follow stroke rotationはstroke.followRotationのbooleanをpreset正本とし、falseではM6A-025の固定実効角、trueでは各新規logical stampに局所stroke tangent + tip.angleDegrees - tip.directionDegreesを適用する。開始stampはまだtangentが無いため固定角のまま確定し、後から回し直さない。短い終端stampは最後に確認した移動方向を使う。解決済みtipAngleDegreesだけをdabへ保存するためWorker/History schemaは増やさずstable-prefixを維持する。次はM6A-027 stroke repetitionから再開する。
M6A-027 stroke repetition:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A follow-stroke-rotation boundary — 2026-09-03',
    """#### M6A follow-stroke-rotation boundary — 2026-09-03

- `stroke.followRotation` is a preset-local boolean and defaults to `false` for legacy presets.
- When disabled, resolved orientation remains the M6A-025 fixed formula `tip.angleDegrees - tip.directionDegrees`. When enabled, each newly emitted logical stamp resolves `local stroke tangent + tip.angleDegrees - tip.directionDegrees`.
- The first stamp has no confirmed movement tangent and therefore commits with the fixed orientation. It is never retroactively rotated after later samples arrive; this preserves the incremental stable-prefix invariant.
- Each non-zero confirmed pointer segment updates the local tangent. Stamps emitted on that segment use that tangent, and a short retained endpoint uses the last confirmed non-zero movement direction.
- Primitive dabs continue to store only their resolved `tipAngleDegrees`. Follow mode is stroke-generation configuration, so Worker/history/recovery rendering requires no parallel follow-rotation field.
- This stage does not add rotation jitter, pen orientation mapping, stabilization look-ahead or post-stroke correction; those remain their later M6A items.""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(
  progress,
  'M6A-026 follow stroke rotation:完了',
  'M6A-026 progress is not complete',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushFollowStrokeRotationV1',
  'follow-stroke rotation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'followAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees',
  'local stroke tangent is not composed into resolved tip orientation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushFollowStrokeRotation',
  'follow-stroke rotation is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-follow-rotation\"',
  'reachable follow-stroke rotation control missing',
);
requireText(
  read('tests/unit/brush-follow-rotation.test.ts'),
  'without rewriting the stable prefix',
  'follow-stroke rotation regression coverage missing',
);""",
)

print('M6A-026 follow stroke rotation patch applied')