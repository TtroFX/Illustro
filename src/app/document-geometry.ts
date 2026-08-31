import { createCanvasSpec, MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from '../domain/document.js';
import type { Revision } from '../domain/identity.js';
import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
  PaintStrokeSampleV1,
} from './paint-session-controller.js';

export interface CanvasResizeInputV1 {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface CanvasCropInputV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ImageResizeInputV1 {
  readonly width: number;
  readonly height: number;
}

export type DocumentQuarterTurnV1 = 'clockwise-90' | 'counterclockwise-90' | 'rotate-180';
export type DocumentFlipAxisV1 = 'horizontal' | 'vertical';

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CANVAS_DIMENSION) {
    throw new RangeError(`${label} must be an integer in 1..${MAX_CANVAS_DIMENSION}`);
  }
}

function assertOffset(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function assertCanvasArea(width: number, height: number): void {
  if (width > Math.floor(MAX_CANVAS_AREA / height)) {
    throw new RangeError(`canvas logical area must not exceed ${MAX_CANVAS_AREA}`);
  }
}

function transformedSample(
  sample: PaintStrokeSampleV1,
  transform: (x: number, y: number) => readonly [number, number],
): PaintStrokeSampleV1 {
  const [documentX, documentY] = transform(sample.documentX, sample.documentY);
  return Object.freeze({ ...sample, documentX, documentY });
}

function transformedDab(
  dab: BaselineBrushDabV1,
  transform: (dab: BaselineBrushDabV1) => {
    readonly x: number;
    readonly y: number;
    readonly radiusX: number;
    readonly radiusY: number;
  },
): BaselineBrushDabV1 {
  const next = transform(dab);
  if (
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y) ||
    !Number.isFinite(next.radiusX) ||
    next.radiusX <= 0 ||
    !Number.isFinite(next.radiusY) ||
    next.radiusY <= 0
  ) {
    throw new RangeError('document transform produced an invalid baseline dab');
  }
  return Object.freeze({
    ...dab,
    x: next.x,
    y: next.y,
    radius: Math.max(next.radiusX, next.radiusY),
    radiusX: next.radiusX,
    radiusY: next.radiusY,
  });
}

function dabIntersectsCanvas(dab: BaselineBrushDabV1, width: number, height: number): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  return (
    dab.opacity > 0 &&
    dab.x + radiusX > 0 &&
    dab.y + radiusY > 0 &&
    dab.x - radiusX < width &&
    dab.y - radiusY < height
  );
}

function transformStroke(
  completed: CompletedPaintStrokeV1,
  width: number,
  height: number,
  pointTransform: (x: number, y: number) => readonly [number, number],
  dabTransform: (dab: BaselineBrushDabV1) => {
    readonly x: number;
    readonly y: number;
    readonly radiusX: number;
    readonly radiusY: number;
  },
): CompletedPaintStrokeV1 | null {
  const dabs = completed.dabs
    .map((dab) => transformedDab(dab, dabTransform))
    .filter((dab) => dabIntersectsCanvas(dab, width, height));
  if (dabs.length === 0) return null;
  return Object.freeze({
    stroke: Object.freeze({
      ...completed.stroke,
      samples: Object.freeze(
        completed.stroke.samples.map((sample) => transformedSample(sample, pointTransform)),
      ),
    }),
    dabs: Object.freeze(dabs),
  });
}

function transformedDocument(
  snapshot: PaintProjectSnapshotV1,
  width: number,
  height: number,
  revision: Revision,
  now: Date,
) {
  const current = snapshot.document;
  return Object.freeze({
    ...current,
    revision,
    modifiedAt: now.toISOString(),
    canvas: createCanvasSpec({
      width,
      height,
      ppi: current.canvas.resolution.ppi,
      background: current.canvas.background,
    }),
  });
}

function transformSnapshot(
  snapshot: PaintProjectSnapshotV1,
  width: number,
  height: number,
  revision: Revision,
  pointTransform: (x: number, y: number) => readonly [number, number],
  dabTransform: (dab: BaselineBrushDabV1) => {
    readonly x: number;
    readonly y: number;
    readonly radiusX: number;
    readonly radiusY: number;
  },
  now: Date,
): PaintProjectSnapshotV1 {
  const committedStrokes = snapshot.committedStrokes
    .map((completed) => transformStroke(completed, width, height, pointTransform, dabTransform))
    .filter((completed): completed is CompletedPaintStrokeV1 => completed !== null);
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: transformedDocument(snapshot, width, height, revision, now),
    committedStrokes: Object.freeze(committedStrokes),
  });
}

export function resizeCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasResizeInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertDimension(input.width, 'canvas width');
  assertDimension(input.height, 'canvas height');
  assertCanvasArea(input.width, input.height);
  assertOffset(input.offsetX, 'canvas offsetX');
  assertOffset(input.offsetY, 'canvas offsetY');
  if (
    input.width === snapshot.document.canvas.width &&
    input.height === snapshot.document.canvas.height &&
    input.offsetX === 0 &&
    input.offsetY === 0
  ) {
    throw new Error('canvas resize has no changes');
  }
  return transformSnapshot(
    snapshot,
    input.width,
    input.height,
    revision,
    (x, y) => [x + input.offsetX, y + input.offsetY],
    (dab) => ({
      x: dab.x + input.offsetX,
      y: dab.y + input.offsetY,
      radiusX: baselineDabRadiusXV1(dab),
      radiusY: baselineDabRadiusYV1(dab),
    }),
    now,
  );
}

export function imageResizeSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  input: ImageResizeInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertDimension(input.width, 'image width');
  assertDimension(input.height, 'image height');
  assertCanvasArea(input.width, input.height);
  const oldWidth = snapshot.document.canvas.width;
  const oldHeight = snapshot.document.canvas.height;
  if (input.width === oldWidth && input.height === oldHeight) {
    throw new Error('image resize has no changes');
  }
  const scaleX = input.width / oldWidth;
  const scaleY = input.height / oldHeight;
  return transformSnapshot(
    snapshot,
    input.width,
    input.height,
    revision,
    (x, y) => [x * scaleX, y * scaleY],
    (dab) => ({
      x: dab.x * scaleX,
      y: dab.y * scaleY,
      radiusX: baselineDabRadiusXV1(dab) * scaleX,
      radiusY: baselineDabRadiusYV1(dab) * scaleY,
    }),
    now,
  );
}

export function cropCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasCropInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertOffset(input.x, 'crop x');
  assertOffset(input.y, 'crop y');
  assertDimension(input.width, 'crop width');
  assertDimension(input.height, 'crop height');
  if (input.x < 0 || input.y < 0) throw new RangeError('crop origin must be inside the canvas');
  if (
    input.x + input.width > snapshot.document.canvas.width ||
    input.y + input.height > snapshot.document.canvas.height
  ) {
    throw new RangeError('crop rectangle must be inside the canvas');
  }
  if (
    input.x === 0 &&
    input.y === 0 &&
    input.width === snapshot.document.canvas.width &&
    input.height === snapshot.document.canvas.height
  ) {
    throw new Error('crop has no changes');
  }
  return resizeCanvasSnapshotV1(
    snapshot,
    { width: input.width, height: input.height, offsetX: -input.x, offsetY: -input.y },
    revision,
    now,
  );
}

export function transparentContentBoundsV1(
  snapshot: PaintProjectSnapshotV1,
): CanvasCropInputV1 | null {
  if (snapshot.document.canvas.background.kind !== 'transparent') return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const completed of snapshot.committedStrokes) {
    for (const dab of completed.dabs) {
      if (
        dab.opacity <= 0 ||
        !dabIntersectsCanvas(dab, snapshot.document.canvas.width, snapshot.document.canvas.height)
      ) {
        continue;
      }
      const radiusX = baselineDabRadiusXV1(dab);
      const radiusY = baselineDabRadiusYV1(dab);
      left = Math.min(left, Math.floor(dab.x - radiusX));
      top = Math.min(top, Math.floor(dab.y - radiusY));
      right = Math.max(right, Math.ceil(dab.x + radiusX));
      bottom = Math.max(bottom, Math.ceil(dab.y + radiusY));
    }
  }
  if (!Number.isFinite(left)) return null;
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const rightEdge = Math.min(snapshot.document.canvas.width, right);
  const bottomEdge = Math.min(snapshot.document.canvas.height, bottom);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

export function trimTransparentCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  if (snapshot.document.canvas.background.kind !== 'transparent') {
    throw new Error('trim transparent edges requires a transparent canvas background');
  }
  const bounds = transparentContentBoundsV1(snapshot);
  if (bounds === null) throw new Error('trim requires visible painted content');
  if (
    bounds.x === 0 &&
    bounds.y === 0 &&
    bounds.width === snapshot.document.canvas.width &&
    bounds.height === snapshot.document.canvas.height
  ) {
    throw new Error('trim has no transparent border');
  }
  return cropCanvasSnapshotV1(snapshot, bounds, revision, now);
}

export function rotateDocumentSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  turn: DocumentQuarterTurnV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const oldWidth = snapshot.document.canvas.width;
  const oldHeight = snapshot.document.canvas.height;
  if (turn === 'rotate-180') {
    return transformSnapshot(
      snapshot,
      oldWidth,
      oldHeight,
      revision,
      (x, y) => [oldWidth - x, oldHeight - y],
      (dab) => ({
        x: oldWidth - dab.x,
        y: oldHeight - dab.y,
        radiusX: baselineDabRadiusXV1(dab),
        radiusY: baselineDabRadiusYV1(dab),
      }),
      now,
    );
  }
  if (turn === 'clockwise-90') {
    return transformSnapshot(
      snapshot,
      oldHeight,
      oldWidth,
      revision,
      (x, y) => [oldHeight - y, x],
      (dab) => ({
        x: oldHeight - dab.y,
        y: dab.x,
        radiusX: baselineDabRadiusYV1(dab),
        radiusY: baselineDabRadiusXV1(dab),
      }),
      now,
    );
  }
  if (turn === 'counterclockwise-90') {
    return transformSnapshot(
      snapshot,
      oldHeight,
      oldWidth,
      revision,
      (x, y) => [y, oldWidth - x],
      (dab) => ({
        x: dab.y,
        y: oldWidth - dab.x,
        radiusX: baselineDabRadiusYV1(dab),
        radiusY: baselineDabRadiusXV1(dab),
      }),
      now,
    );
  }
  throw new TypeError(`unsupported document rotation: ${String(turn)}`);
}

export function flipDocumentSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  axis: DocumentFlipAxisV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  if (axis === 'horizontal') {
    return transformSnapshot(
      snapshot,
      width,
      height,
      revision,
      (x, y) => [width - x, y],
      (dab) => ({
        x: width - dab.x,
        y: dab.y,
        radiusX: baselineDabRadiusXV1(dab),
        radiusY: baselineDabRadiusYV1(dab),
      }),
      now,
    );
  }
  if (axis === 'vertical') {
    return transformSnapshot(
      snapshot,
      width,
      height,
      revision,
      (x, y) => [x, height - y],
      (dab) => ({
        x: dab.x,
        y: height - dab.y,
        radiusX: baselineDabRadiusXV1(dab),
        radiusY: baselineDabRadiusYV1(dab),
      }),
      now,
    );
  }
  throw new TypeError(`unsupported document flip axis: ${String(axis)}`);
}

export function isCanvasExpansionV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasResizeInputV1,
): boolean {
  const oldWidth = snapshot.document.canvas.width;
  const oldHeight = snapshot.document.canvas.height;
  return (
    input.width >= oldWidth &&
    input.height >= oldHeight &&
    input.offsetX >= 0 &&
    input.offsetY >= 0 &&
    input.offsetX + oldWidth <= input.width &&
    input.offsetY + oldHeight <= input.height &&
    (input.width > oldWidth || input.height > oldHeight || input.offsetX > 0 || input.offsetY > 0)
  );
}

export function projectedTouchedTilesForSnapshotV1(snapshot: PaintProjectSnapshotV1): number {
  const dabs = snapshot.committedStrokes.flatMap((completed) => completed.dabs);
  return planBaselineBrushTilesV1(
    dabs,
    snapshot.document.canvas.width,
    snapshot.document.canvas.height,
  ).length;
}
