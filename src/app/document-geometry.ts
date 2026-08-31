import { createCanvasSpec, MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from '../domain/document.js';
import type { Revision } from '../domain/identity.js';
import { planBaselineBrushTilesV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
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

function shiftedSample(
  sample: PaintStrokeSampleV1,
  offsetX: number,
  offsetY: number,
): PaintStrokeSampleV1 {
  return Object.freeze({
    ...sample,
    documentX: sample.documentX + offsetX,
    documentY: sample.documentY + offsetY,
  });
}

function shiftedDab(dab: BaselineBrushDabV1, offsetX: number, offsetY: number): BaselineBrushDabV1 {
  return Object.freeze({ ...dab, x: dab.x + offsetX, y: dab.y + offsetY });
}

function dabIntersectsCanvas(dab: BaselineBrushDabV1, width: number, height: number): boolean {
  return (
    dab.opacity > 0 &&
    dab.x + dab.radius > 0 &&
    dab.y + dab.radius > 0 &&
    dab.x - dab.radius < width &&
    dab.y - dab.radius < height
  );
}

function translateAndClipStroke(
  completed: CompletedPaintStrokeV1,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): CompletedPaintStrokeV1 | null {
  const dabs = completed.dabs
    .map((dab) => shiftedDab(dab, offsetX, offsetY))
    .filter((dab) => dabIntersectsCanvas(dab, width, height));
  if (dabs.length === 0) return null;
  return Object.freeze({
    stroke: Object.freeze({
      ...completed.stroke,
      samples: Object.freeze(
        completed.stroke.samples.map((sample) => shiftedSample(sample, offsetX, offsetY)),
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
  const committedStrokes = snapshot.committedStrokes
    .map((completed) =>
      translateAndClipStroke(completed, input.width, input.height, input.offsetX, input.offsetY),
    )
    .filter((completed): completed is CompletedPaintStrokeV1 => completed !== null);
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: transformedDocument(snapshot, input.width, input.height, revision, now),
    committedStrokes: Object.freeze(committedStrokes),
  });
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
      left = Math.min(left, Math.floor(dab.x - dab.radius));
      top = Math.min(top, Math.floor(dab.y - dab.radius));
      right = Math.max(right, Math.ceil(dab.x + dab.radius));
      bottom = Math.max(bottom, Math.ceil(dab.y + dab.radius));
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
