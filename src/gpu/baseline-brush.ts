import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileKeyV1,
  type RectV1,
  type TileCoordinateV1,
} from './sparse-tile-model.js';

export const BASELINE_BRUSH_RADIUS_PX = 8 as const;
export const BASELINE_BRUSH_SPACING_PX = 4 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;

export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
}

export interface BaselineBrushDabV1 {
  readonly schema: 'illustro.baseline-brush-dab/1';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly opacity: number;
}

export interface BaselineBrushTilePlanV1 {
  readonly coordinate: TileCoordinateV1;
  readonly dirtyRect: RectV1;
  readonly dabs: readonly BaselineBrushDabV1[];
}

function assertFinitePoint(sample: BaselineBrushSampleV1): void {
  if (!Number.isFinite(sample.documentX) || !Number.isFinite(sample.documentY)) {
    throw new RangeError('baseline brush samples require finite document coordinates');
  }
}

function freezeDab(x: number, y: number): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: BASELINE_BRUSH_RADIUS_PX,
    opacity: BASELINE_BRUSH_OPACITY,
  });
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  #lastPoint: { x: number; y: number } | null = null;
  #distanceUntilNext = BASELINE_BRUSH_SPACING_PX;
  #finished = false;

  begin(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {
    if (this.#lastPoint !== null) throw new Error('baseline brush dab builder has already begun');
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    assertFinitePoint(sample);
    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    this.#dabs.push(freezeDab(sample.documentX, sample.documentY));
    this.#distanceUntilNext = BASELINE_BRUSH_SPACING_PX;
    return this.dabs();
  }

  append(samples: readonly BaselineBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    if (this.#lastPoint === null) {
      if (samples.length === 0) return this.dabs();
      const first = samples[0];
      if (first === undefined) return this.dabs();
      this.begin(first);
      return this.append(samples.slice(1));
    }

    for (const sample of samples) {
      assertFinitePoint(sample);
      this.#appendPoint(sample.documentX, sample.documentY);
    }
    return this.dabs();
  }

  finish(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return this.dabs();
    this.#finished = true;
    const lastPoint = this.#lastPoint;
    const lastDab = this.#dabs.at(-1);
    if (lastPoint !== null && lastDab !== undefined) {
      const distance = Math.hypot(lastPoint.x - lastDab.x, lastPoint.y - lastDab.y);
      if (distance > 1e-6) this.#dabs.push(freezeDab(lastPoint.x, lastPoint.y));
    }
    return this.dabs();
  }

  dabs(): readonly BaselineBrushDabV1[] {
    return Object.freeze([...this.#dabs]);
  }

  #appendPoint(x: number, y: number): void {
    const lastPoint = this.#lastPoint;
    if (lastPoint === null) return;

    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let remaining = Math.hypot(x - cursorX, y - cursorY);

    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
      const ratio = this.#distanceUntilNext / remaining;
      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      this.#dabs.push(freezeDab(cursorX, cursorY));
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = BASELINE_BRUSH_SPACING_PX;
    }

    if (remaining > 0) this.#distanceUntilNext -= remaining;
    this.#lastPoint = { x, y };
  }
}

function unionRect(left: RectV1, right: RectV1): RectV1 {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function intersectRect(left: RectV1, right: RectV1): RectV1 | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const left = Math.floor(dab.x - dab.radius);
  const top = Math.floor(dab.y - dab.radius);
  const right = Math.ceil(dab.x + dab.radius);
  const bottom = Math.ceil(dab.y + dab.radius);
  return Object.freeze({
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  });
}

export function planBaselineBrushTilesV1(
  dabs: readonly BaselineBrushDabV1[],
  documentWidth: number,
  documentHeight: number,
): readonly BaselineBrushTilePlanV1[] {
  if (!Number.isSafeInteger(documentWidth) || documentWidth < 1) {
    throw new RangeError('baseline brush document width must be a positive safe integer');
  }
  if (!Number.isSafeInteger(documentHeight) || documentHeight < 1) {
    throw new RangeError('baseline brush document height must be a positive safe integer');
  }

  const documentRect: RectV1 = Object.freeze({
    x: 0,
    y: 0,
    width: documentWidth,
    height: documentHeight,
  });
  const plans = new Map<
    string,
    {
      coordinate: TileCoordinateV1;
      dirtyRect: RectV1;
      dabs: BaselineBrushDabV1[];
    }
  >();

  for (const dab of dabs) {
    if (
      dab.schema !== 'illustro.baseline-brush-dab/1' ||
      !Number.isFinite(dab.x) ||
      !Number.isFinite(dab.y) ||
      !Number.isFinite(dab.radius) ||
      dab.radius <= 0 ||
      !Number.isFinite(dab.opacity) ||
      dab.opacity < 0 ||
      dab.opacity > 1
    ) {
      throw new RangeError('invalid baseline brush dab');
    }

    const clippedDabBounds = intersectRect(dabDocumentBounds(dab), documentRect);
    if (clippedDabBounds === null) continue;
    const minTx = Math.floor(clippedDabBounds.x / CANONICAL_TILE_SIZE_PX);
    const minTy = Math.floor(clippedDabBounds.y / CANONICAL_TILE_SIZE_PX);
    const maxTx = Math.floor(
      (clippedDabBounds.x + clippedDabBounds.width - 1) / CANONICAL_TILE_SIZE_PX,
    );
    const maxTy = Math.floor(
      (clippedDabBounds.y + clippedDabBounds.height - 1) / CANONICAL_TILE_SIZE_PX,
    );

    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        const coordinate = Object.freeze({ tx, ty });
        const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
        const tileDocumentRect: RectV1 = Object.freeze({
          x: bounds.x,
          y: bounds.y,
          width: bounds.validWidth,
          height: bounds.validHeight,
        });
        const affected = intersectRect(clippedDabBounds, tileDocumentRect);
        if (affected === null) continue;
        const localDirtyRect = Object.freeze({
          x: affected.x - bounds.x,
          y: affected.y - bounds.y,
          width: affected.width,
          height: affected.height,
        });
        const key = tileKeyV1(coordinate);
        const existing = plans.get(key);
        if (existing === undefined) {
          plans.set(key, {
            coordinate,
            dirtyRect: localDirtyRect,
            dabs: [dab],
          });
        } else {
          existing.dirtyRect = unionRect(existing.dirtyRect, localDirtyRect);
          existing.dabs.push(dab);
        }
      }
    }
  }

  return Object.freeze(
    [...plans.values()]
      .sort(
        (left, right) =>
          left.coordinate.ty - right.coordinate.ty || left.coordinate.tx - right.coordinate.tx,
      )
      .map((plan) =>
        Object.freeze({
          coordinate: plan.coordinate,
          dirtyRect: plan.dirtyRect,
          dabs: Object.freeze([...plan.dabs]),
        }),
      ),
  );
}
