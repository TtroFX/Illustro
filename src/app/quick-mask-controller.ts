import type { Revision } from '../domain/identity.js';
import {
  prepareCombinedSelectionCoverageV1,
  type SelectionCoverageStoragePortV1,
} from './selection-combine-engine.js';
import {
  rasterSelectionCoverageFromPreparedV1,
  type RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
  type SelectionCoverageSnapshotV1,
} from './selection-coverage-controller.js';
import {
  prepareBrushPaintedSelectionV1,
  type PreparedSelectionCoverageV1,
  type SelectionBrushDabV1,
} from './selection-shape-engine.js';

export type QuickMaskPaintModeV1 = 'select' | 'mask';

export interface QuickMaskEditInputV1 {
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly revision: Revision;
  readonly storage: SelectionCoverageStoragePortV1;
}

export interface QuickMaskSnapshotV1 {
  readonly schema: 'illustro.quick-mask-controller/1';
  readonly active: boolean;
  readonly originalCoverage: RasterSelectionCoverageV1 | null;
  readonly workingCoverage: RasterSelectionCoverageV1 | null;
}

function emptyCoverageV1(revision: Revision): RasterSelectionCoverageV1 {
  return Object.freeze({
    schema: 'illustro.raster-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze([]),
    inverted: false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: revision,
  });
}

function assertEditableCoverageV1(coverage: RasterSelectionCoverageV1 | null): void {
  if (coverage === null) return;
  if (coverage.transformStack.length > 0) {
    throw new Error('Quick Mask requires transformed selection coverage to be baked first');
  }
  if (coverage.effectStack.length > 0) {
    throw new Error('Quick Mask requires effected selection coverage to be baked first');
  }
}

function effectiveDefaultV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

function isDefinitelyEmptyCoverageV1(coverage: RasterSelectionCoverageV1): boolean {
  return coverage.tiles.length === 0 && effectiveDefaultV1(coverage) === 0;
}

function combineModeForPaintV1(mode: QuickMaskPaintModeV1): 'add' | 'subtract' {
  return mode === 'select' ? 'add' : 'subtract';
}

export function quickMaskOverlayAlphaV1(
  selectionCoverageByte: number,
  overlayOpacity = 0.45,
): number {
  if (
    !Number.isInteger(selectionCoverageByte) ||
    selectionCoverageByte < 0 ||
    selectionCoverageByte > 255
  ) {
    throw new RangeError('Quick Mask selection coverage byte must be an integer between 0 and 255');
  }
  if (!Number.isFinite(overlayOpacity) || overlayOpacity < 0 || overlayOpacity > 1) {
    throw new RangeError('Quick Mask overlay opacity must be between 0 and 1');
  }
  return (1 - selectionCoverageByte / 255) * overlayOpacity;
}

export class QuickMaskControllerV1 {
  readonly #selectionController: SelectionCoverageControllerV1;
  #active = false;
  #originalCoverage: RasterSelectionCoverageV1 | null = null;
  #workingCoverage: RasterSelectionCoverageV1 | null = null;

  constructor(selectionController: SelectionCoverageControllerV1) {
    this.#selectionController = selectionController;
  }

  snapshot(): QuickMaskSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.quick-mask-controller/1' as const,
      active: this.#active,
      originalCoverage: this.#originalCoverage,
      workingCoverage: this.#workingCoverage,
    });
  }

  enter(revision: Revision): QuickMaskSnapshotV1 {
    if (this.#active) throw new Error('Quick Mask is already active');
    const originalCoverage = this.#selectionController.snapshot().coverage;
    assertEditableCoverageV1(originalCoverage);
    this.#active = true;
    this.#originalCoverage = originalCoverage;
    this.#workingCoverage = originalCoverage ?? emptyCoverageV1(revision);
    return this.snapshot();
  }

  async applyPreparedCoverage(
    prepared: PreparedSelectionCoverageV1,
    mode: QuickMaskPaintModeV1,
    input: QuickMaskEditInputV1,
  ): Promise<QuickMaskSnapshotV1> {
    if (!this.#active || this.#workingCoverage === null) {
      throw new Error('Quick Mask must be active before editing');
    }
    const combined = await prepareCombinedSelectionCoverageV1(
      this.#workingCoverage,
      prepared,
      combineModeForPaintV1(mode),
      input,
    );
    this.#workingCoverage = rasterSelectionCoverageFromPreparedV1(combined);
    return this.snapshot();
  }

  async paintBrush(
    dabs: readonly SelectionBrushDabV1[],
    mode: QuickMaskPaintModeV1,
    input: QuickMaskEditInputV1,
  ): Promise<QuickMaskSnapshotV1> {
    if (!this.#active) throw new Error('Quick Mask must be active before painting');
    const prepared = await prepareBrushPaintedSelectionV1(dabs, {
      documentWidth: input.documentWidth,
      documentHeight: input.documentHeight,
      revision: input.revision,
      persistence: input.storage,
    });
    return this.applyPreparedCoverage(prepared, mode, input);
  }

  commit(): SelectionCoverageSnapshotV1 {
    if (!this.#active || this.#workingCoverage === null) {
      throw new Error('Quick Mask must be active before commit');
    }
    const result = isDefinitelyEmptyCoverageV1(this.#workingCoverage)
      ? this.#selectionController.clear()
      : this.#selectionController.replace(this.#workingCoverage);
    this.#resetTransientState();
    return result;
  }

  cancel(): SelectionCoverageSnapshotV1 {
    if (!this.#active) throw new Error('Quick Mask must be active before cancel');
    const result =
      this.#originalCoverage === null
        ? this.#selectionController.clear()
        : this.#selectionController.replace(this.#originalCoverage);
    this.#resetTransientState();
    return result;
  }

  #resetTransientState(): void {
    this.#active = false;
    this.#originalCoverage = null;
    this.#workingCoverage = null;
  }
}
