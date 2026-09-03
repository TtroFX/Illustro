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
export type BaselineBrushColorV1 = readonly [number, number, number];
export type BaselineBrushTipShapeV1 = 'round' | 'square' | 'sampled-image';

export const BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 = 5 as const;
export const BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1 = Object.freeze([
  0, 42, 86, 34, 0, 28, 134, 218, 112, 18, 72, 230, 255, 184, 38, 36, 152, 206, 96, 12, 0, 48, 104,
  24, 0,
] as const);
export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge' | 'blur';
export const DEFAULT_BASELINE_BRUSH_COLOR_V1: BaselineBrushColorV1 = Object.freeze([0, 0, 0]);

export function freezeBaselineBrushColorV1(color: readonly number[]): BaselineBrushColorV1 {
  if (
    color.length !== 3 ||
    color.some((component) => !Number.isFinite(component) || component < 0 || component > 1)
  ) {
    throw new RangeError('baseline brush RGB components must be finite values in 0..1');
  }
  return Object.freeze([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0]);
}

export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
}

export interface BaselineBrushDabV1 {
  readonly schema: 'illustro.baseline-brush-dab/1';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly radiusX?: number;
  readonly radiusY?: number;
  readonly opacity: number;
  readonly flow?: number;
  readonly strokeOpacity?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
  readonly color?: BaselineBrushColorV1;
}

export function baselineDabColorV1(dab: BaselineBrushDabV1): BaselineBrushColorV1 {
  return dab.color ?? DEFAULT_BASELINE_BRUSH_COLOR_V1;
}

export function baselineDabRadiusXV1(dab: BaselineBrushDabV1): number {
  return dab.radiusX ?? dab.radius;
}

export function baselineDabRadiusYV1(dab: BaselineBrushDabV1): number {
  return dab.radiusY ?? dab.radius;
}

export function baselineDabFlowV1(dab: BaselineBrushDabV1): number {
  return dab.flow ?? dab.opacity;
}

export function baselineDabStrokeOpacityV1(dab: BaselineBrushDabV1): number {
  return dab.strokeOpacity ?? 1;
}

export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {
  return dab.flow !== undefined || dab.strokeOpacity !== undefined;
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

function freezeDab(
  x: number,
  y: number,
  radius: number,
  flow: number,
  strokeOpacity: number,
  color: BaselineBrushColorV1,
  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,
): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius,
    opacity: flow * strokeOpacity,
    flow,
    strokeOpacity,
    tipShape,
    color,
  });
}

function pushBaselineBrushStampV1(
  target: BaselineBrushDabV1[],
  x: number,
  y: number,
  radius: number,
  flow: number,
  strokeOpacity: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
): void {
  if (tipShape !== 'sampled-image') {
    target.push(freezeDab(x, y, radius, flow, strokeOpacity, color, tipShape));
    return;
  }

  const side = BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1;
  const microRadius = (radius / side) * 1.1;
  const centerIndex = Math.floor(side / 2) * side + Math.floor(side / 2);
  const emit = (index: number): void => {
    const alphaByte = BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1[index] ?? 0;
    if (alphaByte <= 0) return;
    const row = Math.floor(index / side);
    const column = index % side;
    const offsetX = ((column + 0.5) / side - 0.5) * radius * 2;
    const offsetY = ((row + 0.5) / side - 0.5) * radius * 2;
    target.push(
      freezeDab(
        x + offsetX,
        y + offsetY,
        microRadius,
        flow * (alphaByte / 255),
        strokeOpacity,
        color,
        'round',
      ),
    );
  };

  for (let index = 0; index < BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1.length; index += 1) {
    if (index !== centerIndex) emit(index);
  }
  // Keep the center primitive last so existing finish detection remains tied to the logical stamp center.
  emit(centerIndex);
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  readonly #color: BaselineBrushColorV1;
  readonly #radius: number;
  readonly #spacing: number;
  readonly #flow: number;
  readonly #strokeOpacity: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
  #lastPoint: { x: number; y: number } | null = null;
  #distanceUntilNext: number;
  #finished = false;

  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
    } = {},
  ) {
    this.#color =
      options.color === undefined
        ? DEFAULT_BASELINE_BRUSH_COLOR_V1
        : freezeBaselineBrushColorV1(options.color);
    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;
    const opacity = options.opacity ?? BASELINE_BRUSH_OPACITY;
    const flow = options.flow ?? 1;
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
      throw new RangeError('baseline brush size must be finite and within 0..4096 px');
    }
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('baseline brush opacity must be within 0..1');
    }
    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    this.#radius = sizePx / 2;
    this.#spacing = Math.max(0.25, sizePx * 0.25);
    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#tipShape = options.tipShape ?? 'round';
    if (
      this.#tipShape !== 'round' &&
      this.#tipShape !== 'square' &&
      this.#tipShape !== 'sampled-image'
    ) {
      throw new TypeError('unsupported baseline brush tip shape');
    }
    this.#distanceUntilNext = this.#spacing;
  }

  begin(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {
    this.beginDelta(sample);
    return this.dabs();
  }

  beginDelta(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {
    if (this.#lastPoint !== null) throw new Error('baseline brush dab builder has already begun');
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    assertFinitePoint(sample);
    const start = this.#dabs.length;
    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    pushBaselineBrushStampV1(
      this.#dabs,
      sample.documentX,
      sample.documentY,
      this.#radius,
      this.#flow,
      this.#strokeOpacity,
      this.#color,
      this.#tipShape,
    );
    this.#distanceUntilNext = this.#spacing;
    return this.#deltaFrom(start);
  }

  append(samples: readonly BaselineBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    this.appendDelta(samples);
    return this.dabs();
  }

  appendDelta(samples: readonly BaselineBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    const start = this.#dabs.length;
    if (this.#lastPoint === null) {
      const first = samples[0];
      if (first === undefined) return Object.freeze([]);
      this.beginDelta(first);
      for (const sample of samples.slice(1)) {
        assertFinitePoint(sample);
        this.#appendPoint(sample.documentX, sample.documentY);
      }
      return this.#deltaFrom(start);
    }

    for (const sample of samples) {
      assertFinitePoint(sample);
      this.#appendPoint(sample.documentX, sample.documentY);
    }
    return this.#deltaFrom(start);
  }

  finish(): readonly BaselineBrushDabV1[] {
    this.finishDelta();
    return this.dabs();
  }

  finishDelta(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return Object.freeze([]);
    const start = this.#dabs.length;
    this.#finished = true;
    const lastPoint = this.#lastPoint;
    const lastDab = this.#dabs.at(-1);
    if (lastPoint !== null && lastDab !== undefined) {
      const distance = Math.hypot(lastPoint.x - lastDab.x, lastPoint.y - lastDab.y);
      if (distance > 1e-6) {
        pushBaselineBrushStampV1(
          this.#dabs,
          lastPoint.x,
          lastPoint.y,
          this.#radius,
          this.#flow,
          this.#strokeOpacity,
          this.#color,
          this.#tipShape,
        );
      }
    }
    return this.#deltaFrom(start);
  }

  dabCount(): number {
    return this.#dabs.length;
  }

  dabs(): readonly BaselineBrushDabV1[] {
    return Object.freeze([...this.#dabs]);
  }

  #deltaFrom(start: number): readonly BaselineBrushDabV1[] {
    return Object.freeze(this.#dabs.slice(start));
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
      pushBaselineBrushStampV1(
        this.#dabs,
        cursorX,
        cursorY,
        this.#radius,
        this.#flow,
        this.#strokeOpacity,
        this.#color,
        this.#tipShape,
      );
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;
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
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const left = Math.floor(dab.x - radiusX);
  const top = Math.floor(dab.y - radiusY);
  const right = Math.ceil(dab.x + radiusX);
  const bottom = Math.ceil(dab.y + radiusY);
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
      !Number.isFinite(baselineDabRadiusXV1(dab)) ||
      baselineDabRadiusXV1(dab) <= 0 ||
      !Number.isFinite(baselineDabRadiusYV1(dab)) ||
      baselineDabRadiusYV1(dab) <= 0 ||
      !Number.isFinite(dab.opacity) ||
      dab.opacity < 0 ||
      dab.opacity > 1 ||
      (dab.flow !== undefined && (!Number.isFinite(dab.flow) || dab.flow < 0 || dab.flow > 1)) ||
      (dab.strokeOpacity !== undefined &&
        (!Number.isFinite(dab.strokeOpacity) || dab.strokeOpacity < 0 || dab.strokeOpacity > 1)) ||
      (dab.color !== undefined &&
        (dab.color.length !== 3 ||
          dab.color.some(
            (component) => !Number.isFinite(component) || component < 0 || component > 1,
          )))
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
