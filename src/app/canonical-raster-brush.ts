import type { ResponseCurvePointV1 } from '../domain/response-curve.js';
import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushColorV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipSelectionModeV1,
  type BaselineBrushTipShapeV1,
} from '../gpu/baseline-brush.js';

export const CANONICAL_BRUSH_ENGINE_SCHEMA_V1 = 'illustro.canonical-brush-engine/1' as const;

export type CanonicalBrushModeIdV1 = 'raster' | 'eraser' | 'smudge' | 'blur';
export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge' | 'blur';

export const IMPLEMENTED_CANONICAL_BRUSH_MODES_V1 = Object.freeze([
  'raster',
  'eraser',
  'smudge',
  'blur',
] as const satisfies readonly CanonicalBrushModeV1[]);

export function isImplementedCanonicalBrushModeV1(value: unknown): value is CanonicalBrushModeV1 {
  return value === 'raster' || value === 'eraser' || value === 'smudge' || value === 'blur';
}

export function requireImplementedCanonicalBrushModeV1(
  value: CanonicalBrushModeIdV1,
): CanonicalBrushModeV1 {
  if (!isImplementedCanonicalBrushModeV1(value)) {
    throw new Error(`canonical brush mode is not implemented yet: ${value}`);
  }
  return value;
}

export function canonicalBrushCompositeOperationV1(
  mode: CanonicalBrushModeV1,
): BaselineBrushCompositeOperationV1 {
  if (mode === 'eraser') return 'erase';
  if (mode === 'smudge') return 'smudge';
  if (mode === 'blur') return 'blur';
  return 'paint';
}

export interface CanonicalRasterBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
  readonly velocity?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly altitudeAngle?: number | null;
  readonly azimuthAngle?: number | null;
  readonly twist?: number;
}

export interface CanonicalRasterBrushWorkSnapshotV1 {
  readonly schema: typeof CANONICAL_BRUSH_ENGINE_SCHEMA_V1;
  readonly mode: CanonicalBrushModeV1;
  readonly confirmedSampleCount: number;
  readonly generatedDabCount: number;
  readonly emittedDabCount: number;
  readonly stablePrefixDabCount: number;
  readonly mutableTailDabCount: number;
  readonly reprocessedStableDabCount: number;
  readonly batchCount: number;
  readonly finished: boolean;
}

function freezeDelta(delta: readonly BaselineBrushDabV1[]): readonly BaselineBrushDabV1[] {
  return delta.length === 0 ? Object.freeze([]) : Object.freeze([...delta]);
}

/**
 * Production M6A Raster Brush stroke boundary.
 *
 * The existing M4 raster dab builder remains the low-level deterministic kernel, while this facade
 * owns the canonical brush-mode identity and incremental-work contract. Raster mode has no
 * stabilization look-ahead yet, so every generated dab is immediately part of the stable prefix.
 */
export class CanonicalRasterBrushStrokeV1 {
  readonly #kernel: BaselineBrushDabBuilderV1;
  readonly #mode: CanonicalBrushModeV1;
  #confirmedSampleCount = 0;
  #generatedDabCount = 0;
  #emittedDabCount = 0;
  #batchCount = 0;
  #begun = false;
  #finished = false;

  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly mode?: CanonicalBrushModeV1;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly pressureSizeEnabled?: boolean;
      readonly pressureOpacityEnabled?: boolean;
      readonly pressureFlowEnabled?: boolean;
      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly tiltSizeEnabled?: boolean;
      readonly tiltOpacityEnabled?: boolean;
      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly velocitySizeEnabled?: boolean;
      readonly velocityOpacityEnabled?: boolean;
      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSizeEnabled?: boolean;
      readonly randomOpacityEnabled?: boolean;
      readonly randomFlowEnabled?: boolean;
      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly sizeMaximumResponse?: number;
      readonly opacityMaximumResponse?: number;
      readonly flowMaximumResponse?: number;
      readonly sizeJitter?: number;
      readonly opacityJitter?: number;
      readonly rotationJitter?: number;
      readonly positionJitter?: number;
      readonly densityJitter?: number;
      readonly randomSeed?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly followStrokeRotation?: boolean;
      readonly penOrientationEnabled?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: BaselineBrushSampledTipAlphaV1;
      readonly sampledTipAlphas?: readonly BaselineBrushSampledTipAlphaV1[];
      readonly tipSelectionMode?: BaselineBrushTipSelectionModeV1;
      readonly tipSelectionStartIndex?: number;
      readonly tipSelectionSeed?: number;
    } = {},
  ) {
    this.#mode = options.mode ?? 'raster';
    this.#kernel = new BaselineBrushDabBuilderV1({
      ...(options.color === undefined ? {} : { color: options.color }),
      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),
      ...(options.opacity === undefined ? {} : { opacity: options.opacity }),
      ...(options.flow === undefined ? {} : { flow: options.flow }),
      ...(options.spacingRatio === undefined ? {} : { spacingRatio: options.spacingRatio }),
      ...(options.minimumStampDistancePx === undefined
        ? {}
        : { minimumStampDistancePx: options.minimumStampDistancePx }),
      ...(options.startTaperLengthPx === undefined
        ? {}
        : { startTaperLengthPx: options.startTaperLengthPx }),
      ...(options.endTaperLengthPx === undefined
        ? {}
        : { endTaperLengthPx: options.endTaperLengthPx }),
      ...(options.sizeTaperMinimumRatio === undefined
        ? {}
        : { sizeTaperMinimumRatio: options.sizeTaperMinimumRatio }),
      ...(options.opacityTaperMinimumRatio === undefined
        ? {}
        : { opacityTaperMinimumRatio: options.opacityTaperMinimumRatio }),
      ...(options.forceStartTaper === undefined
        ? {}
        : { forceStartTaper: options.forceStartTaper }),
      ...(options.forceEndTaper === undefined ? {} : { forceEndTaper: options.forceEndTaper }),
      ...(options.pressureSizeEnabled === undefined
        ? {}
        : { pressureSizeEnabled: options.pressureSizeEnabled }),
      ...(options.pressureOpacityEnabled === undefined
        ? {}
        : { pressureOpacityEnabled: options.pressureOpacityEnabled }),
      ...(options.pressureFlowEnabled === undefined
        ? {}
        : { pressureFlowEnabled: options.pressureFlowEnabled }),
      ...(options.pressureResponseCurve === undefined
        ? {}
        : { pressureResponseCurve: options.pressureResponseCurve }),
      ...(options.tiltSizeEnabled === undefined
        ? {}
        : { tiltSizeEnabled: options.tiltSizeEnabled }),
      ...(options.tiltOpacityEnabled === undefined
        ? {}
        : { tiltOpacityEnabled: options.tiltOpacityEnabled }),
      ...(options.tiltFlowEnabled === undefined
        ? {}
        : { tiltFlowEnabled: options.tiltFlowEnabled }),
      ...(options.tiltResponseCurve === undefined
        ? {}
        : { tiltResponseCurve: options.tiltResponseCurve }),
      ...(options.velocitySizeEnabled === undefined
        ? {}
        : { velocitySizeEnabled: options.velocitySizeEnabled }),
      ...(options.velocityOpacityEnabled === undefined
        ? {}
        : { velocityOpacityEnabled: options.velocityOpacityEnabled }),
      ...(options.velocityFlowEnabled === undefined
        ? {}
        : { velocityFlowEnabled: options.velocityFlowEnabled }),
      ...(options.velocityResponseCurve === undefined
        ? {}
        : { velocityResponseCurve: options.velocityResponseCurve }),
      ...(options.randomSizeEnabled === undefined
        ? {}
        : { randomSizeEnabled: options.randomSizeEnabled }),
      ...(options.randomOpacityEnabled === undefined
        ? {}
        : { randomOpacityEnabled: options.randomOpacityEnabled }),
      ...(options.randomFlowEnabled === undefined
        ? {}
        : { randomFlowEnabled: options.randomFlowEnabled }),
      ...(options.randomResponseCurve === undefined
        ? {}
        : { randomResponseCurve: options.randomResponseCurve }),
      ...(options.sizeMinimumResponse === undefined
        ? {}
        : { sizeMinimumResponse: options.sizeMinimumResponse }),
      ...(options.opacityMinimumResponse === undefined
        ? {}
        : { opacityMinimumResponse: options.opacityMinimumResponse }),
      ...(options.flowMinimumResponse === undefined
        ? {}
        : { flowMinimumResponse: options.flowMinimumResponse }),
      ...(options.sizeMaximumResponse === undefined
        ? {}
        : { sizeMaximumResponse: options.sizeMaximumResponse }),
      ...(options.opacityMaximumResponse === undefined
        ? {}
        : { opacityMaximumResponse: options.opacityMaximumResponse }),
      ...(options.flowMaximumResponse === undefined
        ? {}
        : { flowMaximumResponse: options.flowMaximumResponse }),
      ...(options.sizeJitter === undefined ? {} : { sizeJitter: options.sizeJitter }),
      ...(options.opacityJitter === undefined ? {} : { opacityJitter: options.opacityJitter }),
      ...(options.rotationJitter === undefined ? {} : { rotationJitter: options.rotationJitter }),
      ...(options.positionJitter === undefined ? {} : { positionJitter: options.positionJitter }),
      ...(options.densityJitter === undefined ? {} : { densityJitter: options.densityJitter }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
      ...(options.tipDensity === undefined ? {} : { tipDensity: options.tipDensity }),
      ...(options.tipAngleDegrees === undefined
        ? {}
        : { tipAngleDegrees: options.tipAngleDegrees }),
      ...(options.tipDirectionDegrees === undefined
        ? {}
        : { tipDirectionDegrees: options.tipDirectionDegrees }),
      ...(options.followStrokeRotation === undefined
        ? {}
        : { followStrokeRotation: options.followStrokeRotation }),
      ...(options.penOrientationEnabled === undefined
        ? {}
        : { penOrientationEnabled: options.penOrientationEnabled }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
      ...(options.sampledTipAlpha === undefined
        ? {}
        : { sampledTipAlpha: options.sampledTipAlpha }),
      ...(options.sampledTipAlphas === undefined
        ? {}
        : { sampledTipAlphas: options.sampledTipAlphas }),
      ...(options.tipSelectionMode === undefined
        ? {}
        : { tipSelectionMode: options.tipSelectionMode }),
      ...(options.tipSelectionStartIndex === undefined
        ? {}
        : { tipSelectionStartIndex: options.tipSelectionStartIndex }),
      ...(options.tipSelectionSeed === undefined
        ? {}
        : { tipSelectionSeed: options.tipSelectionSeed }),
    });
  }

  beginConfirmed(sample: CanonicalRasterBrushSampleV1): readonly BaselineBrushDabV1[] {
    if (this.#begun) throw new Error('canonical raster brush stroke has already begun');
    if (this.#finished) throw new Error('canonical raster brush stroke is finished');
    this.#begun = true;
    return this.#recordDelta(1, this.#kernel.beginDelta(sample));
  }

  appendConfirmed(samples: readonly CanonicalRasterBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    if (this.#finished) throw new Error('canonical raster brush stroke is finished');
    if (!this.#begun) {
      const first = samples[0];
      if (first === undefined) return Object.freeze([]);
      const firstDelta = this.beginConfirmed(first);
      const remainder = samples.slice(1);
      if (remainder.length === 0) return firstDelta;
      const remainderDelta = this.#recordDelta(
        remainder.length,
        this.#kernel.appendDelta(remainder),
      );
      return freezeDelta([...firstDelta, ...remainderDelta]);
    }
    if (samples.length === 0) return Object.freeze([]);
    return this.#recordDelta(samples.length, this.#kernel.appendDelta(samples));
  }

  finishConfirmed(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return Object.freeze([]);
    this.#finished = true;
    if (!this.#begun) return Object.freeze([]);
    return this.#recordDelta(0, this.#kernel.finishDelta());
  }

  dabCount(): number {
    return this.#kernel.dabCount();
  }

  dabs(): readonly BaselineBrushDabV1[] {
    return this.#kernel.dabs();
  }

  snapshot(): CanonicalRasterBrushWorkSnapshotV1 {
    return Object.freeze({
      schema: CANONICAL_BRUSH_ENGINE_SCHEMA_V1,
      mode: this.#mode,
      confirmedSampleCount: this.#confirmedSampleCount,
      generatedDabCount: this.#generatedDabCount,
      emittedDabCount: this.#emittedDabCount,
      stablePrefixDabCount: this.#kernel.stablePrefixDabCount(),
      mutableTailDabCount: this.#kernel.mutableTailDabCount(),
      reprocessedStableDabCount: 0 as const,
      batchCount: this.#batchCount,
      finished: this.#finished,
    });
  }

  #recordDelta(
    confirmedSampleCount: number,
    delta: readonly BaselineBrushDabV1[],
  ): readonly BaselineBrushDabV1[] {
    this.#confirmedSampleCount += confirmedSampleCount;
    this.#generatedDabCount += delta.length;
    this.#emittedDabCount += delta.length;
    this.#batchCount += 1;
    return freezeDelta(delta);
  }
}
