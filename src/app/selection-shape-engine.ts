import type { Revision } from '../domain/identity.js';
import type { RasterTileReferenceV1 } from '../domain/layers.js';
import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileGridForDocumentV1,
} from '../gpu/sparse-tile-model.js';
import type { PaintPersistedRasterTileV1 } from './paint-persistence-controller.js';

export interface SelectionPointV1 {
  readonly x: number;
  readonly y: number;
}

export interface SelectionBrushDabV1 extends SelectionPointV1 {
  readonly radius: number;
  readonly opacity?: number;
}

export type SelectionShapeV1 =
  | {
      readonly kind: 'rectangle';
      readonly start: SelectionPointV1;
      readonly end: SelectionPointV1;
    }
  | {
      readonly kind: 'ellipse';
      readonly start: SelectionPointV1;
      readonly end: SelectionPointV1;
    }
  | {
      readonly kind: 'lasso';
      readonly points: readonly SelectionPointV1[];
    }
  | {
      readonly kind: 'freehand';
      readonly points: readonly SelectionPointV1[];
    }
  | {
      readonly kind: 'brush';
      readonly dabs: readonly SelectionBrushDabV1[];
    };

export interface SelectionCoveragePersistencePortV1 {
  persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: 'rgba8-unorm';
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1>;
}

export interface PreparedSelectionCoverageV1 {
  readonly schema: 'illustro.prepared-selection-coverage/1';
  readonly defaultCoverage: 0;
  readonly tiles: readonly RasterTileReferenceV1[];
  readonly sourceRevision: Revision;
}

interface BoundsV1 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function point(input: SelectionPointV1, label: string): SelectionPointV1 {
  return Object.freeze({
    x: finite(input.x, `${label}.x`),
    y: finite(input.y, `${label}.y`),
  });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rectangularBounds(startValue: SelectionPointV1, endValue: SelectionPointV1): BoundsV1 {
  const start = point(startValue, 'selection start');
  const end = point(endValue, 'selection end');
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);
  if (maxX <= minX || maxY <= minY)
    throw new RangeError('selection bounds must have positive area');
  return Object.freeze({ minX, minY, maxX, maxY });
}

function polygonPoints(
  points: readonly SelectionPointV1[],
  label: string,
): readonly SelectionPointV1[] {
  if (points.length < 3) throw new RangeError(`${label} requires at least three points`);
  const normalized: SelectionPointV1[] = [];
  for (const [index, input] of points.entries()) {
    const next = point(input, `${label}[${index}]`);
    const previous = normalized.at(-1);
    if (previous === undefined || previous.x !== next.x || previous.y !== next.y)
      normalized.push(next);
  }
  if (normalized.length < 3)
    throw new RangeError(`${label} requires three distinct consecutive points`);
  return Object.freeze(normalized);
}

function polygonBounds(points: readonly SelectionPointV1[]): BoundsV1 {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of points) {
    minX = Math.min(minX, entry.x);
    minY = Math.min(minY, entry.y);
    maxX = Math.max(maxX, entry.x);
    maxY = Math.max(maxY, entry.y);
  }
  if (maxX <= minX || maxY <= minY)
    throw new RangeError('polygon selection must have positive area');
  return Object.freeze({ minX, minY, maxX, maxY });
}

function brushDabs(dabs: readonly SelectionBrushDabV1[]): readonly SelectionBrushDabV1[] {
  if (dabs.length === 0) throw new RangeError('brush-painted selection requires at least one dab');
  return Object.freeze(
    dabs.map((input, index) => {
      const center = point(input, `selection dab[${index}]`);
      const radius = finite(input.radius, `selection dab[${index}].radius`);
      if (radius <= 0) throw new RangeError('selection brush radius must be positive');
      const opacity =
        input.opacity === undefined ? 1 : finite(input.opacity, `selection dab[${index}].opacity`);
      if (opacity < 0 || opacity > 1)
        throw new RangeError('selection brush opacity must be between 0 and 1');
      return Object.freeze({ ...center, radius, opacity });
    }),
  );
}

function brushBounds(dabs: readonly SelectionBrushDabV1[]): BoundsV1 {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const dab of dabs) {
    minX = Math.min(minX, dab.x - dab.radius);
    minY = Math.min(minY, dab.y - dab.radius);
    maxX = Math.max(maxX, dab.x + dab.radius);
    maxY = Math.max(maxY, dab.y + dab.radius);
  }
  return Object.freeze({ minX, minY, maxX, maxY });
}

function pointInPolygon(x: number, y: number, points: readonly SelectionPointV1[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (currentPoint === undefined || previousPoint === undefined) continue;
    const crosses =
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function brushCoverage(x: number, y: number, dabs: readonly SelectionBrushDabV1[]): number {
  let coverage = 0;
  for (const dab of dabs) {
    const opacity = dab.opacity ?? 1;
    if (opacity <= coverage) continue;
    const distance = Math.hypot(x - dab.x, y - dab.y);
    const inner = Math.max(0, dab.radius - 0.5);
    const outer = dab.radius + 0.5;
    if (distance <= inner) {
      coverage = Math.max(coverage, opacity);
      continue;
    }
    if (distance < outer) {
      coverage = Math.max(coverage, opacity * clamp01(outer - distance));
    }
  }
  return coverage;
}

function normalizedShape(input: SelectionShapeV1): {
  readonly shape: SelectionShapeV1;
  readonly bounds: BoundsV1;
} {
  switch (input.kind) {
    case 'rectangle': {
      const start = point(input.start, 'rectangle start');
      const end = point(input.end, 'rectangle end');
      return Object.freeze({
        shape: Object.freeze({ kind: 'rectangle' as const, start, end }),
        bounds: rectangularBounds(start, end),
      });
    }
    case 'ellipse': {
      const start = point(input.start, 'ellipse start');
      const end = point(input.end, 'ellipse end');
      return Object.freeze({
        shape: Object.freeze({ kind: 'ellipse' as const, start, end }),
        bounds: rectangularBounds(start, end),
      });
    }
    case 'lasso':
    case 'freehand': {
      const points = polygonPoints(input.points, input.kind);
      return Object.freeze({
        shape: Object.freeze({ kind: input.kind, points }),
        bounds: polygonBounds(points),
      });
    }
    case 'brush': {
      const dabs = brushDabs(input.dabs);
      return Object.freeze({
        shape: Object.freeze({ kind: 'brush' as const, dabs }),
        bounds: brushBounds(dabs),
      });
    }
  }
}

function coverageAt(shape: SelectionShapeV1, x: number, y: number): number {
  switch (shape.kind) {
    case 'rectangle': {
      const bounds = rectangularBounds(shape.start, shape.end);
      return x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY ? 1 : 0;
    }
    case 'ellipse': {
      const bounds = rectangularBounds(shape.start, shape.end);
      const radiusX = (bounds.maxX - bounds.minX) / 2;
      const radiusY = (bounds.maxY - bounds.minY) / 2;
      const centerX = bounds.minX + radiusX;
      const centerY = bounds.minY + radiusY;
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      return dx * dx + dy * dy <= 1 ? 1 : 0;
    }
    case 'lasso':
    case 'freehand':
      return pointInPolygon(x, y, shape.points) ? 1 : 0;
    case 'brush':
      return brushCoverage(x, y, shape.dabs);
  }
}

export function rasterizeSelectionShapeTileV1(
  shapeInput: SelectionShapeV1,
  input: {
    readonly tileDocumentX: number;
    readonly tileDocumentY: number;
    readonly width: number;
    readonly height: number;
  },
): Uint8Array<ArrayBuffer> {
  const { shape } = normalizedShape(shapeInput);
  if (!Number.isSafeInteger(input.width) || input.width < 1)
    throw new RangeError('selection tile width is invalid');
  if (!Number.isSafeInteger(input.height) || input.height < 1)
    throw new RangeError('selection tile height is invalid');
  const bytes = new Uint8Array(input.width * input.height * 4);
  for (let localY = 0; localY < input.height; localY += 1) {
    const documentY = input.tileDocumentY + localY + 0.5;
    for (let localX = 0; localX < input.width; localX += 1) {
      const documentX = input.tileDocumentX + localX + 0.5;
      const encoded = Math.round(clamp01(coverageAt(shape, documentX, documentY)) * 255);
      const offset = (localY * input.width + localX) * 4;
      bytes[offset] = encoded;
      bytes[offset + 1] = encoded;
      bytes[offset + 2] = encoded;
      bytes[offset + 3] = 255;
    }
  }
  return bytes;
}

function hasCoverage(bytes: Uint8Array): boolean {
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    if ((bytes[offset] ?? 0) !== 0) return true;
  }
  return false;
}

export async function prepareSelectionShapeCoverageV1(
  shapeInput: SelectionShapeV1,
  input: {
    readonly documentWidth: number;
    readonly documentHeight: number;
    readonly revision: Revision;
    readonly persistence: SelectionCoveragePersistencePortV1;
  },
): Promise<PreparedSelectionCoverageV1> {
  const grid = tileGridForDocumentV1(input.documentWidth, input.documentHeight);
  const { shape, bounds } = normalizedShape(shapeInput);
  const clippedMinX = Math.max(0, bounds.minX);
  const clippedMinY = Math.max(0, bounds.minY);
  const clippedMaxX = Math.min(input.documentWidth, bounds.maxX);
  const clippedMaxY = Math.min(input.documentHeight, bounds.maxY);
  if (clippedMaxX <= clippedMinX || clippedMaxY <= clippedMinY) {
    return Object.freeze({
      schema: 'illustro.prepared-selection-coverage/1' as const,
      defaultCoverage: 0 as const,
      tiles: Object.freeze([]),
      sourceRevision: input.revision,
    });
  }

  const minTx = Math.max(0, Math.floor(clippedMinX / CANONICAL_TILE_SIZE_PX));
  const minTy = Math.max(0, Math.floor(clippedMinY / CANONICAL_TILE_SIZE_PX));
  const maxTx = Math.min(
    grid.columns - 1,
    Math.floor((clippedMaxX - Number.EPSILON) / CANONICAL_TILE_SIZE_PX),
  );
  const maxTy = Math.min(
    grid.rows - 1,
    Math.floor((clippedMaxY - Number.EPSILON) / CANONICAL_TILE_SIZE_PX),
  );
  const tiles: RasterTileReferenceV1[] = [];

  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const tileBounds = tileBoundsForDocumentV1(input.documentWidth, input.documentHeight, {
        tx,
        ty,
      });
      const bytes = rasterizeSelectionShapeTileV1(shape, {
        tileDocumentX: tileBounds.x,
        tileDocumentY: tileBounds.y,
        width: tileBounds.validWidth,
        height: tileBounds.validHeight,
      });
      if (!hasCoverage(bytes)) continue;
      const persisted = await input.persistence.persistRasterTile({
        width: tileBounds.validWidth,
        height: tileBounds.validHeight,
        pixelFormat: 'rgba8-unorm',
        bytes,
      });
      tiles.push(
        Object.freeze({
          x: tx,
          y: ty,
          revision: input.revision,
          payloadRef: persisted.payloadRef,
        }),
      );
    }
  }

  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze(tiles),
    sourceRevision: input.revision,
  });
}

export function prepareRectangularSelectionV1(
  start: SelectionPointV1,
  end: SelectionPointV1,
  input: Parameters<typeof prepareSelectionShapeCoverageV1>[1],
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionShapeCoverageV1({ kind: 'rectangle', start, end }, input);
}

export function prepareEllipticalSelectionV1(
  start: SelectionPointV1,
  end: SelectionPointV1,
  input: Parameters<typeof prepareSelectionShapeCoverageV1>[1],
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionShapeCoverageV1({ kind: 'ellipse', start, end }, input);
}

export function prepareLassoSelectionV1(
  points: readonly SelectionPointV1[],
  input: Parameters<typeof prepareSelectionShapeCoverageV1>[1],
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionShapeCoverageV1({ kind: 'lasso', points }, input);
}

export function prepareFreehandSelectionV1(
  points: readonly SelectionPointV1[],
  input: Parameters<typeof prepareSelectionShapeCoverageV1>[1],
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionShapeCoverageV1({ kind: 'freehand', points }, input);
}

export function prepareBrushPaintedSelectionV1(
  dabs: readonly SelectionBrushDabV1[],
  input: Parameters<typeof prepareSelectionShapeCoverageV1>[1],
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionShapeCoverageV1({ kind: 'brush', dabs }, input);
}
