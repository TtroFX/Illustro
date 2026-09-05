import { CANONICAL_TILE_SIZE_PX, tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistenceControllerV1,
} from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import type {
  RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
} from './selection-coverage-controller.js';
import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export interface SelectionContourPointV1 {
  readonly x: number;
  readonly y: number;
}

export interface SelectionContourBoundsV1 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface SelectionContourSnapshotV1 {
  readonly schema: 'illustro.m8.selection-contour-presenter/1';
  readonly selectionKey: string | null;
  readonly documentBounds: SelectionContourBoundsV1 | null;
  readonly stageBounds: SelectionContourBoundsV1 | null;
  readonly contourCount: number;
  readonly pending: boolean;
}

export type SelectionContourListenerV1 = (snapshot: SelectionContourSnapshotV1) => void;

export interface SelectionContourPresenterHandleV1 {
  snapshot(): SelectionContourSnapshotV1;
  subscribe(listener: SelectionContourListenerV1): () => void;
  refresh(): void;
  dispose(): void;
}

interface SegmentV1 {
  readonly a: SelectionContourPointV1;
  readonly b: SelectionContourPointV1;
}

interface LoadedCoverageTileV1 {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array;
  readonly classification: 'outside' | 'inside' | 'mixed';
}

const THRESHOLD = 128;

function effectiveDefaultV1(coverage: RasterSelectionCoverageV1): number {
  const base = coverage.defaultCoverage === 1 ? 255 : 0;
  return coverage.inverted ? 255 - base : base;
}

export function selectionContourKeyV1(coverage: RasterSelectionCoverageV1): string {
  return [
    coverage.sourceRevision,
    coverage.defaultCoverage,
    coverage.inverted ? 1 : 0,
    ...coverage.tiles.map((tile) => `${tile.x}:${tile.y}:${tile.payloadRef}`),
  ].join('|');
}

function classifyValuesV1(values: Uint8Array): LoadedCoverageTileV1['classification'] {
  let hasInside = false;
  let hasOutside = false;
  for (const value of values) {
    if (value >= THRESHOLD) hasInside = true;
    else hasOutside = true;
    if (hasInside && hasOutside) return 'mixed';
  }
  return hasInside ? 'inside' : 'outside';
}

function decodeCoverageValuesV1(decoded: PaintDecodedRasterTileV1, inverted: boolean): Uint8Array {
  if (decoded.pixelFormat !== 'rgba8-unorm') {
    throw new Error('Selection contour requires rgba8-unorm coverage tiles');
  }
  const values = new Uint8Array(decoded.width * decoded.height);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const stored = decoded.bytes[pixel * 4] ?? 0;
    values[pixel] = inverted ? 255 - stored : stored;
  }
  return values;
}

function tileKeyV1(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

async function loadCoverageTilesV1(
  coverage: RasterSelectionCoverageV1,
  documentWidth: number,
  documentHeight: number,
  storage: PaintPersistenceControllerV1,
): Promise<ReadonlyMap<string, LoadedCoverageTileV1>> {
  const entries = await Promise.all(
    coverage.tiles.map(async (reference) => {
      const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, {
        tx: reference.x,
        ty: reference.y,
      });
      const decoded = await storage.readRasterTile(reference.payloadRef);
      if (decoded.width !== bounds.validWidth || decoded.height !== bounds.validHeight) {
        throw new Error('Selection contour tile dimensions do not match the document tile');
      }
      const values = decodeCoverageValuesV1(decoded, coverage.inverted);
      return Object.freeze({
        tx: reference.x,
        ty: reference.y,
        width: decoded.width,
        height: decoded.height,
        values,
        classification: classifyValuesV1(values),
      });
    }),
  );
  return new Map(entries.map((entry) => [tileKeyV1(entry.tx, entry.ty), entry]));
}

function cellKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function addCellV1(cells: Set<string>, x: number, y: number): void {
  cells.add(cellKeyV1(x, y));
}

function addTileCandidateCellsV1(
  cells: Set<string>,
  tile: LoadedCoverageTileV1,
  documentWidth: number,
  documentHeight: number,
): void {
  const startX = tile.tx * CANONICAL_TILE_SIZE_PX;
  const startY = tile.ty * CANONICAL_TILE_SIZE_PX;
  const endX = Math.min(documentWidth, startX + tile.width);
  const endY = Math.min(documentHeight, startY + tile.height);
  if (tile.classification === 'mixed') {
    for (let y = startY - 1; y <= endY - 1; y += 1) {
      for (let x = startX - 1; x <= endX - 1; x += 1) addCellV1(cells, x, y);
    }
    return;
  }
  for (let x = startX - 1; x <= endX - 1; x += 1) {
    addCellV1(cells, x, startY - 1);
    addCellV1(cells, x, endY - 1);
  }
  for (let y = startY - 1; y <= endY - 1; y += 1) {
    addCellV1(cells, startX - 1, y);
    addCellV1(cells, endX - 1, y);
  }
}

function addDocumentPerimeterCellsV1(cells: Set<string>, width: number, height: number): void {
  for (let x = -1; x <= width - 1; x += 1) {
    addCellV1(cells, x, -1);
    addCellV1(cells, x, height - 1);
  }
  for (let y = -1; y <= height - 1; y += 1) {
    addCellV1(cells, -1, y);
    addCellV1(cells, width - 1, y);
  }
}

function coverageSampleV1(
  x: number,
  y: number,
  documentWidth: number,
  documentHeight: number,
  defaultValue: number,
  tiles: ReadonlyMap<string, LoadedCoverageTileV1>,
): number {
  if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) return 0;
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = tiles.get(tileKeyV1(tx, ty));
  if (!tile) return defaultValue;
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) return 0;
  return tile.values[localY * tile.width + localX] ?? defaultValue;
}

function interpolateV1(
  first: SelectionContourPointV1,
  second: SelectionContourPointV1,
  firstValue: number,
  secondValue: number,
): SelectionContourPointV1 {
  if (firstValue === secondValue) {
    return Object.freeze({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
  }
  const ratio = Math.max(0, Math.min(1, (THRESHOLD - firstValue) / (secondValue - firstValue)));
  return Object.freeze({
    x: first.x + (second.x - first.x) * ratio,
    y: first.y + (second.y - first.y) * ratio,
  });
}

function marchingCellSegmentsV1(
  x: number,
  y: number,
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
): readonly SegmentV1[] {
  const tl = Object.freeze({ x: x + 0.5, y: y + 0.5 });
  const tr = Object.freeze({ x: x + 1.5, y: y + 0.5 });
  const br = Object.freeze({ x: x + 1.5, y: y + 1.5 });
  const bl = Object.freeze({ x: x + 0.5, y: y + 1.5 });
  const edges = {
    top: interpolateV1(tl, tr, topLeft, topRight),
    right: interpolateV1(tr, br, topRight, bottomRight),
    bottom: interpolateV1(bl, br, bottomLeft, bottomRight),
    left: interpolateV1(tl, bl, topLeft, bottomLeft),
  };
  const mask =
    (topLeft >= THRESHOLD ? 1 : 0) |
    (topRight >= THRESHOLD ? 2 : 0) |
    (bottomRight >= THRESHOLD ? 4 : 0) |
    (bottomLeft >= THRESHOLD ? 8 : 0);
  const segment = (first: keyof typeof edges, second: keyof typeof edges): SegmentV1 =>
    Object.freeze({ a: edges[first], b: edges[second] });
  const centerInside = (topLeft + topRight + bottomRight + bottomLeft) / 4 >= THRESHOLD;
  switch (mask) {
    case 0:
    case 15:
      return Object.freeze([]);
    case 1:
      return Object.freeze([segment('left', 'top')]);
    case 2:
      return Object.freeze([segment('top', 'right')]);
    case 3:
      return Object.freeze([segment('left', 'right')]);
    case 4:
      return Object.freeze([segment('right', 'bottom')]);
    case 5:
      return centerInside
        ? Object.freeze([segment('top', 'right'), segment('bottom', 'left')])
        : Object.freeze([segment('left', 'top'), segment('right', 'bottom')]);
    case 6:
      return Object.freeze([segment('top', 'bottom')]);
    case 7:
      return Object.freeze([segment('left', 'bottom')]);
    case 8:
      return Object.freeze([segment('bottom', 'left')]);
    case 9:
      return Object.freeze([segment('top', 'bottom')]);
    case 10:
      return centerInside
        ? Object.freeze([segment('left', 'top'), segment('right', 'bottom')])
        : Object.freeze([segment('top', 'right'), segment('bottom', 'left')]);
    case 11:
      return Object.freeze([segment('right', 'bottom')]);
    case 12:
      return Object.freeze([segment('left', 'right')]);
    case 13:
      return Object.freeze([segment('top', 'right')]);
    case 14:
      return Object.freeze([segment('left', 'top')]);
    default:
      return Object.freeze([]);
  }
}

function endpointKeyV1(point: SelectionContourPointV1): string {
  return `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
}

export function stitchSelectionContourSegmentsV1(
  segments: readonly SegmentV1[],
): readonly (readonly SelectionContourPointV1[])[] {
  const adjacency = new Map<string, number[]>();
  const add = (key: string, index: number): void => {
    const entries = adjacency.get(key);
    if (entries) entries.push(index);
    else adjacency.set(key, [index]);
  };
  for (const [index, segment] of segments.entries()) {
    add(endpointKeyV1(segment.a), index);
    add(endpointKeyV1(segment.b), index);
  }
  const visited = new Set<number>();
  const contours: SelectionContourPointV1[][] = [];

  const trace = (startIndex: number, startAtA: boolean): void => {
    if (visited.has(startIndex)) return;
    const first = segments[startIndex];
    if (!first) return;
    const points: SelectionContourPointV1[] = [startAtA ? first.a : first.b];
    let currentIndex = startIndex;
    let currentPoint = startAtA ? first.b : first.a;
    for (;;) {
      visited.add(currentIndex);
      points.push(currentPoint);
      const key = endpointKeyV1(currentPoint);
      const nextIndex = (adjacency.get(key) ?? []).find((index) => !visited.has(index));
      if (nextIndex === undefined) break;
      const next = segments[nextIndex];
      if (!next) break;
      currentIndex = nextIndex;
      currentPoint = endpointKeyV1(next.a) === key ? next.b : next.a;
      if (endpointKeyV1(currentPoint) === endpointKeyV1(points[0] ?? currentPoint)) {
        visited.add(currentIndex);
        points.push(currentPoint);
        break;
      }
    }
    if (points.length >= 2) contours.push(points);
  };

  for (const [key, indices] of adjacency) {
    if (indices.length === 2) continue;
    for (const index of indices) {
      const segment = segments[index];
      if (!segment || visited.has(index)) continue;
      trace(index, endpointKeyV1(segment.a) === key);
    }
  }
  for (let index = 0; index < segments.length; index += 1) trace(index, true);
  return Object.freeze(contours.map((contour) => Object.freeze(contour)));
}

function contourBoundsV1(
  contours: readonly (readonly SelectionContourPointV1[])[],
): SelectionContourBoundsV1 | null {
  if (contours.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const contour of contours) {
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return Number.isFinite(minX) ? Object.freeze({ minX, minY, maxX, maxY }) : null;
}

export async function extractSelectionCoverageContoursV1(input: {
  readonly coverage: RasterSelectionCoverageV1;
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly storage: PaintPersistenceControllerV1;
}): Promise<readonly (readonly SelectionContourPointV1[])[]> {
  const tiles = await loadCoverageTilesV1(
    input.coverage,
    input.documentWidth,
    input.documentHeight,
    input.storage,
  );
  const cells = new Set<string>();
  for (const tile of tiles.values()) {
    addTileCandidateCellsV1(cells, tile, input.documentWidth, input.documentHeight);
  }
  const defaultValue = effectiveDefaultV1(input.coverage);
  if (defaultValue >= THRESHOLD) {
    addDocumentPerimeterCellsV1(cells, input.documentWidth, input.documentHeight);
  }
  const segments: SegmentV1[] = [];
  for (const key of cells) {
    const [rawX, rawY] = key.split(':');
    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const topLeft = coverageSampleV1(
      x,
      y,
      input.documentWidth,
      input.documentHeight,
      defaultValue,
      tiles,
    );
    const topRight = coverageSampleV1(
      x + 1,
      y,
      input.documentWidth,
      input.documentHeight,
      defaultValue,
      tiles,
    );
    const bottomRight = coverageSampleV1(
      x + 1,
      y + 1,
      input.documentWidth,
      input.documentHeight,
      defaultValue,
      tiles,
    );
    const bottomLeft = coverageSampleV1(
      x,
      y + 1,
      input.documentWidth,
      input.documentHeight,
      defaultValue,
      tiles,
    );
    segments.push(...marchingCellSegmentsV1(x, y, topLeft, topRight, bottomRight, bottomLeft));
  }
  return stitchSelectionContourSegmentsV1(segments);
}

function documentPointToStageV1(
  point: SelectionContourPointV1,
  viewport: ViewportSnapshotV1,
): SelectionContourPointV1 {
  const localX = (point.x / viewport.documentWidth - 0.5) * viewport.baseWidth;
  const localY = (point.y / viewport.documentHeight - 0.5) * viewport.baseHeight;
  const scaledX = localX * (viewport.mirrored ? -viewport.zoom : viewport.zoom);
  const scaledY = localY * viewport.zoom;
  const angle = (viewport.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return Object.freeze({
    x: viewport.stageWidth / 2 + viewport.panX + cos * scaledX - sin * scaledY,
    y: viewport.stageHeight / 2 + viewport.panY + sin * scaledX + cos * scaledY,
  });
}

function projectContoursV1(
  contours: readonly (readonly SelectionContourPointV1[])[],
  viewport: ViewportSnapshotV1,
): readonly (readonly SelectionContourPointV1[])[] {
  return Object.freeze(
    contours.map((contour) =>
      Object.freeze(contour.map((point) => documentPointToStageV1(point, viewport))),
    ),
  );
}

function contoursToPathV1(contours: readonly (readonly SelectionContourPointV1[])[]): string {
  return contours
    .filter((contour) => contour.length >= 2)
    .map((contour) => {
      const first = contour[0];
      if (!first) return '';
      return `M ${first.x} ${first.y} ${contour
        .slice(1)
        .map((point) => `L ${point.x} ${point.y}`)
        .join(' ')}`;
    })
    .join(' ');
}

export function installSelectionContourPresenterV1(input: {
  readonly context: M8SelectionContextLayerHandleV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly selectionCoverage: SelectionCoverageControllerV1;
  readonly viewport: ViewportControllerV1;
}): SelectionContourPresenterHandleV1 {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('m8e-selection-contour-layer');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('hidden', '');
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outline.classList.add('m8e-selection-contour-outline');
  const ants = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ants.classList.add('m8e-selection-contour-ants');
  svg.append(outline, ants);
  input.context.overlay.prepend(svg);

  const listeners = new Set<SelectionContourListenerV1>();
  let documentContours: readonly (readonly SelectionContourPointV1[])[] = Object.freeze([]);
  let selectionKey: string | null = null;
  let resolvedSelectionKey: string | null = null;
  let pending = false;
  let generation = 0;
  let snapshotValue: SelectionContourSnapshotV1 = Object.freeze({
    schema: 'illustro.m8.selection-contour-presenter/1' as const,
    selectionKey: null,
    documentBounds: null,
    stageBounds: null,
    contourCount: 0,
    pending: false,
  });

  const publish = (): void => {
    for (const listener of listeners) listener(snapshotValue);
  };

  const reproject = (): void => {
    if (documentContours.length === 0) {
      svg.setAttribute('hidden', '');
      outline.setAttribute('d', '');
      ants.setAttribute('d', '');
      snapshotValue = Object.freeze({
        schema: 'illustro.m8.selection-contour-presenter/1' as const,
        selectionKey,
        documentBounds: null,
        stageBounds: null,
        contourCount: 0,
        pending,
      });
      publish();
      return;
    }
    const projected = projectContoursV1(documentContours, input.viewport.snapshot());
    const d = contoursToPathV1(projected);
    outline.setAttribute('d', d);
    ants.setAttribute('d', d);
    svg.removeAttribute('hidden');
    snapshotValue = Object.freeze({
      schema: 'illustro.m8.selection-contour-presenter/1' as const,
      selectionKey,
      documentBounds: contourBoundsV1(documentContours),
      stageBounds: contourBoundsV1(projected),
      contourCount: documentContours.length,
      pending,
    });
    publish();
  };

  const rebuild = async (): Promise<void> => {
    const currentGeneration = ++generation;
    const coverage = input.selectionCoverage.snapshot().coverage;
    const documentValue = input.paintSession.currentDocument();
    if (!coverage || !documentValue) {
      selectionKey = null;
      resolvedSelectionKey = null;
      documentContours = Object.freeze([]);
      pending = false;
      reproject();
      return;
    }
    const nextKey = selectionContourKeyV1(coverage);
    selectionKey = nextKey;
    if (nextKey === resolvedSelectionKey) {
      pending = false;
      reproject();
      return;
    }

    documentContours = Object.freeze([]);
    pending = true;
    reproject();
    try {
      const contours = await extractSelectionCoverageContoursV1({
        coverage,
        documentWidth: documentValue.canvas.width,
        documentHeight: documentValue.canvas.height,
        storage: input.paintPersistence,
      });
      if (generation !== currentGeneration) return;
      documentContours = contours;
      resolvedSelectionKey = nextKey;
    } catch (error) {
      if (generation !== currentGeneration) return;
      documentContours = Object.freeze([]);
      resolvedSelectionKey = null;
      input.context.announce(
        error instanceof Error ? error.message : '選択範囲の輪郭を表示できませんでした',
      );
    } finally {
      if (generation === currentGeneration) {
        pending = false;
        reproject();
      }
    }
  };

  const unsubscribeCoverage = input.selectionCoverage.subscribe(() => void rebuild());
  const unsubscribeViewport = input.viewport.subscribe(() => reproject());

  return Object.freeze({
    snapshot: () => snapshotValue,
    subscribe(listener: SelectionContourListenerV1): () => void {
      listeners.add(listener);
      listener(snapshotValue);
      return () => listeners.delete(listener);
    },
    refresh(): void {
      void rebuild();
    },
    dispose(): void {
      generation += 1;
      unsubscribeCoverage();
      unsubscribeViewport();
      listeners.clear();
      svg.remove();
    },
  });
}
