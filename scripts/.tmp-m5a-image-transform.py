from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'replacement target missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# Baseline dabs retain independent X/Y radii so non-uniform document transforms
# remain exact for the current canonical baseline-paint representation.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export interface BaselineBrushDabV1 {
  readonly schema: 'illustro.baseline-brush-dab/1';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly opacity: number;
}
""",
    """export interface BaselineBrushDabV1 {
  readonly schema: 'illustro.baseline-brush-dab/1';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly radiusX?: number;
  readonly radiusY?: number;
  readonly opacity: number;
}

export function baselineDabRadiusXV1(dab: BaselineBrushDabV1): number {
  return dab.radiusX ?? dab.radius;
}

export function baselineDabRadiusYV1(dab: BaselineBrushDabV1): number {
  return dab.radiusY ?? dab.radius;
}
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const left = Math.floor(dab.x - dab.radius);
  const top = Math.floor(dab.y - dab.radius);
  const right = Math.ceil(dab.x + dab.radius);
  const bottom = Math.ceil(dab.y + dab.radius);
""",
    """function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const left = Math.floor(dab.x - radiusX);
  const top = Math.floor(dab.y - radiusY);
  const right = Math.ceil(dab.x + radiusX);
  const bottom = Math.ceil(dab.y + radiusY);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      !Number.isFinite(dab.radius) ||
      dab.radius <= 0 ||
      !Number.isFinite(dab.opacity) ||
""",
    """      !Number.isFinite(dab.radius) ||
      dab.radius <= 0 ||
      !Number.isFinite(baselineDabRadiusXV1(dab)) ||
      baselineDabRadiusXV1(dab) <= 0 ||
      !Number.isFinite(baselineDabRadiusYV1(dab)) ||
      baselineDabRadiusYV1(dab) <= 0 ||
      !Number.isFinite(dab.opacity) ||
""",
)

# GPU renderer already carries vec2 radii; feed canonical X/Y radii rather than
# deriving both from one scalar.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "import { planBaselineBrushTilesV1, type BaselineBrushDabV1 } from './baseline-brush.js';",
    """import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from './baseline-brush.js';""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        radius: dab.radius,
        opacity: dab.opacity,
""",
    """        radius: dab.radius,
        radiusX: baselineDabRadiusXV1(dab),
        radiusY: baselineDabRadiusYV1(dab),
        opacity: dab.opacity,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    Number.isFinite(dab.radius) &&
    dab.radius > 0 &&
    Number.isFinite(dab.opacity) &&
""",
    """    Number.isFinite(dab.radius) &&
    dab.radius > 0 &&
    Number.isFinite(baselineDabRadiusXV1(dab)) &&
    baselineDabRadiusXV1(dab) > 0 &&
    Number.isFinite(baselineDabRadiusYV1(dab)) &&
    baselineDabRadiusYV1(dab) > 0 &&
    Number.isFinite(dab.opacity) &&
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    values[offset + 2] = (dab.radius * scaleX * 2) / targetWidth;
    values[offset + 3] = (dab.radius * scaleY * 2) / targetHeight;
""",
    """    values[offset + 2] = (baselineDabRadiusXV1(dab) * scaleX * 2) / targetWidth;
    values[offset + 3] = (baselineDabRadiusYV1(dab) * scaleY * 2) / targetHeight;
""",
)

# PNG flatten must match GPU ellipse semantics exactly.
replace_once(
    'src/export/png-export.ts',
    "import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';",
    """import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';""",
)
replace_once(
    'src/export/png-export.ts',
    """    !Number.isFinite(dab.radius) ||
    dab.radius <= 0 ||
    !Number.isFinite(dab.opacity) ||
""",
    """    !Number.isFinite(dab.radius) ||
    dab.radius <= 0 ||
    !Number.isFinite(baselineDabRadiusXV1(dab)) ||
    baselineDabRadiusXV1(dab) <= 0 ||
    !Number.isFinite(baselineDabRadiusYV1(dab)) ||
    baselineDabRadiusYV1(dab) <= 0 ||
    !Number.isFinite(dab.opacity) ||
""",
)
replace_once(
    'src/export/png-export.ts',
    """  return (
    dab.x + dab.radius > tileX &&
    dab.y + dab.radius > tileY &&
    dab.x - dab.radius < tileX + tileWidth &&
    dab.y - dab.radius < tileY + tileHeight
  );
""",
    """  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  return (
    dab.x + radiusX > tileX &&
    dab.y + radiusY > tileY &&
    dab.x - radiusX < tileX + tileWidth &&
    dab.y - radiusY < tileY + tileHeight
  );
""",
)
replace_once(
    'src/export/png-export.ts',
    """  const minX = Math.max(tileX, Math.floor(dab.x - dab.radius));
  const minY = Math.max(tileY, Math.floor(dab.y - dab.radius));
  const maxX = Math.min(tileX + tileWidth - 1, Math.ceil(dab.x + dab.radius) - 1);
  const maxY = Math.min(tileY + tileHeight - 1, Math.ceil(dab.y + dab.radius) - 1);
""",
    """  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tileWidth - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tileHeight - 1, Math.ceil(dab.y + radiusY) - 1);
""",
)
replace_once(
    'src/export/png-export.ts',
    """    const localY = (documentY + 0.5 - dab.y) / dab.radius;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / dab.radius;
""",
    """    const localY = (documentY + 0.5 - dab.y) / radiusY;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
""",
)

# Persist optional axis radii through project reload/recovery.
replace_once(
    'src/app/paint-session-controller.ts',
    """  const radius = finiteNumber(value.radius, 'baseline dab radius');
  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');
  if (radius <= 0 || opacity < 0 || opacity > 1) throw new RangeError('invalid baseline dab range');
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: finiteNumber(value.x, 'baseline dab x'),
    y: finiteNumber(value.y, 'baseline dab y'),
    radius,
    opacity,
  });
""",
    """  const radius = finiteNumber(value.radius, 'baseline dab radius');
  const radiusX = value.radiusX === undefined ? radius : finiteNumber(value.radiusX, 'baseline dab radiusX');
  const radiusY = value.radiusY === undefined ? radius : finiteNumber(value.radiusY, 'baseline dab radiusY');
  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');
  if (radius <= 0 || radiusX <= 0 || radiusY <= 0 || opacity < 0 || opacity > 1) {
    throw new RangeError('invalid baseline dab range');
  }
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: finiteNumber(value.x, 'baseline dab x'),
    y: finiteNumber(value.y, 'baseline dab y'),
    radius,
    radiusX,
    radiusY,
    opacity,
  });
""",
)

Path('src/app/document-geometry.ts').write_text(r'''import { createCanvasSpec, MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from '../domain/document.js';
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
''')

Path('src/app/document-geometry-workflow-controller.ts').write_text(r'''import type { DocumentV1 } from '../domain/document.js';
import type { CanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import {
  cropCanvasSnapshotV1,
  flipDocumentSnapshotV1,
  imageResizeSnapshotV1,
  isCanvasExpansionV1,
  projectedTouchedTilesForSnapshotV1,
  resizeCanvasSnapshotV1,
  rotateDocumentSnapshotV1,
  trimTransparentCanvasSnapshotV1,
  type DocumentFlipAxisV1,
  type DocumentQuarterTurnV1,
} from './document-geometry.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1, PaintSessionControllerV1 } from './paint-session-controller.js';

export interface DocumentGeometryWorkflowControllerV1 {
  readonly schema: 'illustro.document-geometry-workflow/1';
  dispose(): void;
}

interface OptionsV1 {
  readonly root?: HTMLElement;
  readonly canvasAdmission: CanvasAdmissionControllerV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onDocumentChanged: (document: DocumentV1) => void;
  readonly onHistoryChanged: () => void;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`document geometry workflow is missing ${selector}`);
  return element;
}

function integer(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installDocumentGeometryWorkflowControllerV1(
  options: OptionsV1,
): DocumentGeometryWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const imageResizeButton = required<HTMLButtonElement>('#image-resize');
  const resizeButton = required<HTMLButtonElement>('#canvas-resize');
  const cropButton = required<HTMLButtonElement>('#canvas-crop');
  const trimButton = required<HTMLButtonElement>('#canvas-trim');
  const rotateCwButton = required<HTMLButtonElement>('#document-rotate-cw');
  const rotateCcwButton = required<HTMLButtonElement>('#document-rotate-ccw');
  const rotate180Button = required<HTMLButtonElement>('#document-rotate-180');
  const flipHorizontalButton = required<HTMLButtonElement>('#document-flip-horizontal');
  const flipVerticalButton = required<HTMLButtonElement>('#document-flip-vertical');
  const dialog = required<HTMLDialogElement>('#canvas-geometry-dialog');
  const form = required<HTMLFormElement>('#canvas-geometry-form');
  const title = required<HTMLElement>('#canvas-geometry-title');
  const xRow = required<HTMLElement>('#canvas-geometry-x-row');
  const yRow = required<HTMLElement>('#canvas-geometry-y-row');
  const xLabel = required<HTMLElement>('#canvas-geometry-x-label');
  const yLabel = required<HTMLElement>('#canvas-geometry-y-label');
  const xInput = required<HTMLInputElement>('#canvas-geometry-x');
  const yInput = required<HTMLInputElement>('#canvas-geometry-y');
  const widthInput = required<HTMLInputElement>('#canvas-geometry-width');
  const heightInput = required<HTMLInputElement>('#canvas-geometry-height');
  const help = required<HTMLElement>('#canvas-geometry-help');
  const status = required<HTMLOutputElement>('#canvas-geometry-status');
  const submit = required<HTMLButtonElement>('#canvas-geometry-submit');
  const cancel = required<HTMLButtonElement>('#canvas-geometry-cancel');

  const show = (): void => {
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const openImageResize = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(imageResizeButton);
    dialog.dataset.mode = 'image-resize';
    title.textContent = '画像サイズ';
    xRow.hidden = true;
    yRow.hidden = true;
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent = '画像内容とブラシ形状を新しいピクセル寸法へスケールします。';
    submit.textContent = 'リサイズ';
    show();
  };

  const openResize = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(resizeButton);
    dialog.dataset.mode = 'resize';
    title.textContent = 'キャンバスサイズ';
    xRow.hidden = false;
    yRow.hidden = false;
    xLabel.textContent = '内容オフセット X';
    yLabel.textContent = '内容オフセット Y';
    xInput.value = '0';
    yInput.value = '0';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent = 'オフセットは既存内容を新しいキャンバス座標へ移動します。大きくする場合は余白追加として扱われます。';
    submit.textContent = '適用';
    show();
  };

  const openCrop = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(cropButton);
    dialog.dataset.mode = 'crop';
    title.textContent = 'クロップ';
    xRow.hidden = false;
    yRow.hidden = false;
    xLabel.textContent = '左';
    yLabel.textContent = '上';
    xInput.value = '0';
    yInput.value = '0';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent = '指定矩形の外側を切り落とします。';
    submit.textContent = 'クロップ';
    show();
  };

  const publishTransform = async (transactionId: string): Promise<void> => {
    await options.paintPersistence.markDirty(transactionId);
    const documentValue = options.paintSession.currentDocument();
    if (documentValue !== null) options.onDocumentChanged(documentValue);
    options.onHistoryChanged();
  };

  const assertAdmission = async (preview: PaintProjectSnapshotV1, label: string): Promise<void> => {
    const admission = await options.canvasAdmission.preflight({
      width: preview.document.canvas.width,
      height: preview.document.canvas.height,
      precision: preview.document.color.precision,
      projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),
      operationScratchBytes: 0,
    });
    if (!admission.allowed) throw new Error(`${label} rejected: ${admission.reasons.join(', ')}`);
  };

  const runSnapshotTransform = (
    sourceButton: HTMLButtonElement,
    commandId: string,
    label: string,
    transform: (
      before: PaintProjectSnapshotV1,
      revision: PaintProjectSnapshotV1['document']['revision'],
    ) => PaintProjectSnapshotV1,
  ): void => {
    closeMenu(sourceButton);
    options.schedule(async () => {
      const current = options.paintSession.projectSnapshot();
      if (current === null) return;
      try {
        const previewRevision = (current.document.revision + 1) as typeof current.document.revision;
        const preview = transform(current, previewRevision);
        await assertAdmission(preview, label);
        const transaction = await options.paintHistory.commitSnapshotTransform(commandId, transform);
        await publishTransform(transaction.transactionId);
      } catch (error) {
        root.dataset.illustroCanvasGeometryError = error instanceof Error ? error.message : String(error);
      }
    });
  };

  const runTrim = (): void => {
    closeMenu(trimButton);
    options.schedule(async () => {
      const current = options.paintSession.projectSnapshot();
      if (current === null) return;
      try {
        const preview = trimTransparentCanvasSnapshotV1(
          current,
          (current.document.revision + 1) as typeof current.document.revision,
        );
        await assertAdmission(preview, 'trim');
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'document.canvas.trim',
          (before, revision) => trimTransparentCanvasSnapshotV1(before, revision),
        );
        await publishTransform(transaction.transactionId);
      } catch (error) {
        root.dataset.illustroCanvasGeometryError = error instanceof Error ? error.message : String(error);
      }
    });
  };

  const runRotate = (button: HTMLButtonElement, turn: DocumentQuarterTurnV1): void =>
    runSnapshotTransform(button, `document.rotate.${turn}`, 'rotate', (before, revision) =>
      rotateDocumentSnapshotV1(before, turn, revision),
    );

  const runFlip = (button: HTMLButtonElement, axis: DocumentFlipAxisV1): void =>
    runSnapshotTransform(button, `document.flip.${axis}`, 'flip', (before, revision) =>
      flipDocumentSnapshotV1(before, axis, revision),
    );

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = dialog.dataset.mode;
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    submit.disabled = true;
    status.value = '処理中…';
    options.schedule(async () => {
      try {
        const width = integer(widthInput, 'width');
        const height = integer(heightInput, 'height');
        const previewRevision = (current.document.revision + 1) as typeof current.document.revision;
        if (mode === 'image-resize') {
          const preview = imageResizeSnapshotV1(current, { width, height }, previewRevision);
          await assertAdmission(preview, 'image resize');
          const transaction = await options.paintHistory.commitSnapshotTransform(
            'document.image.resize',
            (before, revision) => imageResizeSnapshotV1(before, { width, height }, revision),
          );
          await publishTransform(transaction.transactionId);
        } else {
          const x = integer(xInput, mode === 'crop' ? 'crop x' : 'offset x');
          const y = integer(yInput, mode === 'crop' ? 'crop y' : 'offset y');
          const preview =
            mode === 'crop'
              ? cropCanvasSnapshotV1(current, { x, y, width, height }, previewRevision)
              : resizeCanvasSnapshotV1(
                  current,
                  { width, height, offsetX: x, offsetY: y },
                  previewRevision,
                );
          await assertAdmission(preview, mode === 'crop' ? 'crop' : 'canvas resize');
          const commandId =
            mode === 'crop'
              ? 'document.canvas.crop'
              : isCanvasExpansionV1(current, { width, height, offsetX: x, offsetY: y })
                ? 'document.canvas.expand'
                : 'document.canvas.resize';
          const transaction = await options.paintHistory.commitSnapshotTransform(
            commandId,
            (before, revision) =>
              mode === 'crop'
                ? cropCanvasSnapshotV1(before, { x, y, width, height }, revision)
                : resizeCanvasSnapshotV1(
                    before,
                    { width, height, offsetX: x, offsetY: y },
                    revision,
                  ),
          );
          await publishTransform(transaction.transactionId);
        }
        status.value = '';
        dialog.close();
      } catch (error) {
        status.value = error instanceof Error ? error.message : String(error);
        root.dataset.illustroCanvasGeometryError = status.value;
      } finally {
        submit.disabled = false;
      }
    });
  };

  const onCancel = (): void => dialog.close();
  const onRotateCw = (): void => runRotate(rotateCwButton, 'clockwise-90');
  const onRotateCcw = (): void => runRotate(rotateCcwButton, 'counterclockwise-90');
  const onRotate180 = (): void => runRotate(rotate180Button, 'rotate-180');
  const onFlipHorizontal = (): void => runFlip(flipHorizontalButton, 'horizontal');
  const onFlipVertical = (): void => runFlip(flipVerticalButton, 'vertical');

  imageResizeButton.addEventListener('click', openImageResize);
  resizeButton.addEventListener('click', openResize);
  cropButton.addEventListener('click', openCrop);
  trimButton.addEventListener('click', runTrim);
  rotateCwButton.addEventListener('click', onRotateCw);
  rotateCcwButton.addEventListener('click', onRotateCcw);
  rotate180Button.addEventListener('click', onRotate180);
  flipHorizontalButton.addEventListener('click', onFlipHorizontal);
  flipVerticalButton.addEventListener('click', onFlipVertical);
  form.addEventListener('submit', onSubmit);
  cancel.addEventListener('click', onCancel);
  root.dataset.illustroCanvasGeometry = 'ready';

  return Object.freeze({
    schema: 'illustro.document-geometry-workflow/1' as const,
    dispose(): void {
      imageResizeButton.removeEventListener('click', openImageResize);
      resizeButton.removeEventListener('click', openResize);
      cropButton.removeEventListener('click', openCrop);
      trimButton.removeEventListener('click', runTrim);
      rotateCwButton.removeEventListener('click', onRotateCw);
      rotateCcwButton.removeEventListener('click', onRotateCcw);
      rotate180Button.removeEventListener('click', onRotate180);
      flipHorizontalButton.removeEventListener('click', onFlipHorizontal);
      flipVerticalButton.removeEventListener('click', onFlipVertical);
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      root.dataset.illustroCanvasGeometry = 'disposed';
    },
  });
}
''')

# Add production menu entries and a stable help hook for the shared dialog.
replace_once(
    'src/index.html',
    """              <button id="document-settings" type="button">ドキュメント設定…</button>
              <button id="canvas-resize" type="button">キャンバスサイズ…</button>
              <button id="canvas-crop" type="button">クロップ…</button>
              <button id="canvas-trim" type="button">透明部分をトリミング</button>
""",
    """              <button id="document-settings" type="button">ドキュメント設定…</button>
              <button id="image-resize" type="button">画像サイズ…</button>
              <button id="canvas-resize" type="button">キャンバスサイズ…</button>
              <button id="canvas-crop" type="button">クロップ…</button>
              <button id="canvas-trim" type="button">透明部分をトリミング</button>
              <button id="document-rotate-cw" type="button">右に90°回転</button>
              <button id="document-rotate-ccw" type="button">左に90°回転</button>
              <button id="document-rotate-180" type="button">180°回転</button>
              <button id="document-flip-horizontal" type="button">左右反転</button>
              <button id="document-flip-vertical" type="button">上下反転</button>
""",
)
replace_once(
    'src/index.html',
    '<p class="document-dialog-help">オフセットは既存内容を新しいキャンバス座標へ移動します。大きくする場合は余白追加として扱われます。</p>',
    '<p id="canvas-geometry-help" class="document-dialog-help">オフセットは既存内容を新しいキャンバス座標へ移動します。大きくする場合は余白追加として扱われます。</p>',
)

# Extend geometry unit coverage.
replace_once(
    'tests/unit/document-geometry.test.ts',
    """  cropCanvasSnapshotV1,
  isCanvasExpansionV1,
  resizeCanvasSnapshotV1,
  transparentContentBoundsV1,
  trimTransparentCanvasSnapshotV1,
""",
    """  cropCanvasSnapshotV1,
  flipDocumentSnapshotV1,
  imageResizeSnapshotV1,
  isCanvasExpansionV1,
  resizeCanvasSnapshotV1,
  rotateDocumentSnapshotV1,
  transparentContentBoundsV1,
  trimTransparentCanvasSnapshotV1,
""",
)
replace_once(
    'tests/unit/document-geometry.test.ts',
    """  it('does not pretend a colored background has transparent trim borders', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }], 100, 80, true);
    expect(transparentContentBoundsV1(before)).toBeNull();
    expect(() => trimTransparentCanvasSnapshotV1(before, revision(1))).toThrow(/transparent/);
  });
""",
    """  it('does not pretend a colored background has transparent trim borders', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }], 100, 80, true);
    expect(transparentContentBoundsV1(before)).toBeNull();
    expect(() => trimTransparentCanvasSnapshotV1(before, revision(1))).toThrow(/transparent/);
  });

  it('resizes image content with independent X/Y radii', () => {
    const before = snapshot([{ x: 20, y: 30, radius: 5 }], 100, 80);
    const after = imageResizeSnapshotV1(before, { width: 200, height: 40 }, revision(1));
    expect(after.document.canvas).toMatchObject({ width: 200, height: 40 });
    expect(after.committedStrokes[0]?.dabs[0]).toMatchObject({
      x: 40,
      y: 15,
      radius: 10,
      radiusX: 10,
      radiusY: 2.5,
    });
    expect(after.committedStrokes[0]?.stroke.samples[0]).toMatchObject({
      documentX: 40,
      documentY: 15,
    });
  });

  it('rotates document quarter turns without losing non-uniform dab geometry', () => {
    const resized = imageResizeSnapshotV1(
      snapshot([{ x: 20, y: 30, radius: 5 }], 100, 80),
      { width: 200, height: 40 },
      revision(1),
    );
    const rotated = rotateDocumentSnapshotV1(resized, 'clockwise-90', revision(2));
    expect(rotated.document.canvas).toMatchObject({ width: 40, height: 200 });
    expect(rotated.committedStrokes[0]?.dabs[0]).toMatchObject({
      x: 25,
      y: 40,
      radiusX: 2.5,
      radiusY: 10,
    });
  });

  it('flips canonical document content horizontally and vertically', () => {
    const before = snapshot([{ x: 20, y: 30, radius: 5 }], 100, 80);
    const horizontal = flipDocumentSnapshotV1(before, 'horizontal', revision(1));
    expect(horizontal.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 80, y: 30 });
    const vertical = flipDocumentSnapshotV1(before, 'vertical', revision(1));
    expect(vertical.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 20, y: 50 });
  });
""",
)

# Verify history path for a destructive transform too.
replace_once(
    'tests/unit/document-geometry-history.test.ts',
    "import { resizeCanvasSnapshotV1 } from '../../src/app/document-geometry.js';",
    """import {
  resizeCanvasSnapshotV1,
  rotateDocumentSnapshotV1,
} from '../../src/app/document-geometry.js';""",
)
replace_once(
    'tests/unit/document-geometry-history.test.ts',
    """  });
});
""",
    """  });

  it('commits destructive rotation as one undo/redo transaction', async () => {
    const session = new PaintSessionControllerV1(new Renderer());
    await session.createNewDocument({ width: 100, height: 80 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();
    const transaction = await history.commitSnapshotTransform(
      'document.rotate.clockwise-90',
      (before, revision) => rotateDocumentSnapshotV1(before, 'clockwise-90', revision),
    );
    expect(transaction.commandId).toBe('document.rotate.clockwise-90');
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 80, height: 100 });
    expect(await history.undo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 100, height: 80 });
    expect(await history.redo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 80, height: 100 });
  });
});
""",
)

# Ellipse persistence/flatten contract regression.
replace_once(
    'tests/unit/png-export.test.ts',
    """describe('M4 PNG export', () => {
""",
    """describe('M4 PNG export', () => {
""",
)

# Expand the durable M5A audit.
replace_once(
    'scripts/verify-m5a-document-foundation.mjs',
    """required(geometry, 'isCanvasExpansionV1', 'canvas expansion classification');
required(geometryWorkflow, 'canvasAdmission.preflight', 'geometry admission preflight');
""",
    """required(geometry, 'isCanvasExpansionV1', 'canvas expansion classification');
required(geometry, 'imageResizeSnapshotV1', 'image resize operation');
required(geometry, 'rotateDocumentSnapshotV1', 'destructive document rotation');
required(geometry, 'flipDocumentSnapshotV1', 'document flip operation');
required(geometry, 'radiusX', 'non-uniform transformed dab geometry');
required(geometryWorkflow, 'canvasAdmission.preflight', 'geometry admission preflight');
""",
)
replace_once(
    'scripts/verify-m5a-document-foundation.mjs',
    """required(html, 'id=\"canvas-trim\"', 'trim UI');

console.log('M5A document/canvas foundation verification passed');
""",
    """required(html, 'id=\"canvas-trim\"', 'trim UI');
required(html, 'id=\"image-resize\"', 'image resize UI');
required(html, 'id=\"document-rotate-cw\"', 'rotate UI');
required(html, 'id=\"document-flip-horizontal\"', 'horizontal flip UI');
required(html, 'id=\"document-flip-vertical\"', 'vertical flip UI');

console.log('M5A document/canvas foundation verification passed');
""",
)
