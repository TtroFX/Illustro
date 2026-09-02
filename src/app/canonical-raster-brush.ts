import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushColorV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
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
}

export interface CanonicalRasterBrushWorkSnapshotV1 {
  readonly schema: typeof CANONICAL_BRUSH_ENGINE_SCHEMA_V1;
  readonly mode: CanonicalBrushModeV1;
  readonly confirmedSampleCount: number;
  readonly generatedDabCount: number;
  readonly emittedDabCount: number;
  readonly stablePrefixDabCount: number;
  readonly mutableTailDabCount: 0;
  readonly reprocessedStableDabCount: 0;
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
    options: { readonly color?: BaselineBrushColorV1; readonly mode?: CanonicalBrushModeV1 } = {},
  ) {
    this.#mode = options.mode ?? 'raster';
    this.#kernel =
      options.color === undefined
        ? new BaselineBrushDabBuilderV1()
        : new BaselineBrushDabBuilderV1({ color: options.color });
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
      stablePrefixDabCount: this.#kernel.dabCount(),
      mutableTailDabCount: 0 as const,
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
