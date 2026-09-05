import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import { tileBoundsForDocumentV1, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type {
  PaintDecodedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type {
  PreparedRasterMergeTileV1,
  RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import { prepareLayerRasterizeV1 } from './layer-rasterize.js';
import type { RasterSelectionCoverageV1 } from './selection-coverage-controller.js';

export interface SelectionScopedFillEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface SelectionScopedFillInputV1 {
  readonly color: RgbUnitColorV1;
  readonly opacity?: number;
}

export interface PreparedSelectionScopedFillV1 {
  readonly schema: 'illustro.prepared-selection-scoped-fill/1';
  readonly layerId: LayerId;
  readonly color: RgbUnitColorV1;
  readonly opacity: number;
  readonly alphaLocked: boolean;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

interface DecodedCoverageTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array<ArrayBuffer>;
}

function unavailable(layerId: LayerId, reason: string): SelectionScopedFillEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

function hasUnbakedLayerStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

function effectiveDefaultCoverageV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

export function selectionScopedFillEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
): SelectionScopedFillEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined)
    return unavailable(layerId, 'selection-scoped fill target layer is missing');
  if (layer.type !== 'raster') {
    return unavailable(layerId, 'selection-scoped fill currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'selection-scoped fill is blocked by the layer pixel lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped fill on a transformed layer requires canonical transform baking',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped fill on an effected layer requires effect rendering',
    );
  }
  if (coverage === null) {
    return unavailable(layerId, 'selection-scoped fill requires an active selection');
  }
  if (coverage.transformStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped fill requires transformed selection coverage to be baked',
    );
  }
  if (coverage.effectStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped fill requires effected selection coverage to be baked',
    );
  }
  if (effectiveDefaultCoverageV1(coverage) === 0 && coverage.tiles.length === 0) {
    return unavailable(layerId, 'selection-scoped fill requires non-empty selection coverage');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

function assertOpacityV1(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('selection-scoped fill opacity must be a finite value in 0..1');
  }
  return value;
}

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function bytesPerPixelV1(format: PaintRasterTilePixelFormatV1): 4 | 8 {
  return format === 'rgba8-unorm' ? 4 : 8;
}

function validateSourceTileV1(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error(
      'selection-scoped fill source tile does not match the document raster contract',
    );
  }
  if (tile.bytes.byteLength !== width * height * bytesPerPixelV1(format)) {
    throw new Error('selection-scoped fill source tile byte length is invalid');
  }
}

function validateCoverageTileV1(
  tile: PaintDecodedRasterTileV1,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  if (tile.pixelFormat !== 'rgba8-unorm' || tile.width !== width || tile.height !== height) {
    throw new Error('selection-scoped fill coverage tile does not match canonical RGBA8 coverage');
  }
  if (tile.bytes.byteLength !== width * height * 4) {
    throw new Error('selection-scoped fill coverage tile byte length is invalid');
  }
  const values = new Uint8Array(width * height);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const offset = pixel * 4;
    const red = tile.bytes[offset] ?? 0;
    const green = tile.bytes[offset + 1] ?? 0;
    const blue = tile.bytes[offset + 2] ?? 0;
    const alpha = tile.bytes[offset + 3] ?? 0;
    if (red !== green || red !== blue || alpha !== 255) {
      throw new Error('selection-scoped fill coverage tile violates canonical grayscale encoding');
    }
    values[pixel] = red;
  }
  return values;
}

async function decodeCoverageTilesV1(
  snapshot: PaintProjectSnapshotV1,
  coverage: RasterSelectionCoverageV1,
  persistence: RasterMergePersistencePortV1,
): Promise<ReadonlyMap<string, DecodedCoverageTileV1>> {
  const decoded = new Map<string, DecodedCoverageTileV1>();
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  for (const reference of coverage.tiles) {
    const key = tileKeyV1(reference.x, reference.y);
    if (decoded.has(key)) {
      throw new Error(`duplicate selection-scoped fill coverage tile: ${key}`);
    }
    const bounds = tileBoundsForDocumentV1(width, height, {
      tx: reference.x,
      ty: reference.y,
    });
    const payload = await persistence.readRasterTile(reference.payloadRef);
    let values = validateCoverageTileV1(payload, bounds.validWidth, bounds.validHeight);
    if (coverage.inverted) {
      const inverted = new Uint8Array(values.length);
      for (let pixel = 0; pixel < values.length; pixel += 1) {
        inverted[pixel] = 255 - (values[pixel] ?? 0);
      }
      values = inverted;
    }
    decoded.set(
      key,
      Object.freeze({
        x: reference.x,
        y: reference.y,
        width: bounds.validWidth,
        height: bounds.validHeight,
        values,
      }),
    );
  }
  return decoded;
}

async function sourceTilesV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  if (hasUnbakedLayerStrokeV1(snapshot, layer.id)) {
    return (await prepareLayerRasterizeV1(snapshot, layer.id, persistence)).tiles;
  }
  return Object.freeze(
    layer.tiles.map((tile) => Object.freeze({ x: tile.x, y: tile.y, payloadRef: tile.payloadRef })),
  );
}

function halfToFloatV1(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function floatToHalfV1(value: number): number {
  const float = new Float32Array([value]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  const sourceExponent = (bits >>> 23) & 0xff;
  let fraction = bits & 0x7fffff;
  if (sourceExponent === 0xff) return sign | (fraction === 0 ? 0x7c00 : 0x7e00);
  let exponent = sourceExponent - 127 + 15;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    fraction = (fraction | 0x800000) >>> (1 - exponent);
    return sign | ((fraction + 0x1000) >>> 13);
  }
  if (exponent >= 31) return sign | 0x7c00;
  fraction += 0x1000;
  if ((fraction & 0x800000) !== 0) {
    fraction = 0;
    exponent += 1;
    if (exponent >= 31) return sign | 0x7c00;
  }
  return sign | (exponent << 10) | (fraction >>> 13);
}

function clamp01V1(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function coverageAtV1(coverage: Uint8Array | null, pixel: number, defaultCoverage: 0 | 1): number {
  return coverage?.[pixel] ?? (defaultCoverage === 1 ? 255 : 0);
}

export function applySelectionScopedRasterFillBytesV1(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  colorValue: RgbUnitColorV1,
  opacityValue: number,
  coverage: Uint8Array | null,
  defaultCoverage: 0 | 1,
  width: number,
  height: number,
  alphaLocked = false,
): Readonly<{ bytes: Uint8Array<ArrayBuffer>; changed: boolean }> {
  const color = freezeRgbUnitColorV1(colorValue);
  const opacity = assertOpacityV1(opacityValue);
  const bytesPerPixel = bytesPerPixelV1(format);
  if (bytes.byteLength !== width * height * bytesPerPixel) {
    throw new RangeError('selection-scoped fill source byte length does not match dimensions');
  }
  if (coverage !== null && coverage.length !== width * height) {
    throw new RangeError('selection-scoped fill coverage length does not match dimensions');
  }
  const output = new Uint8Array(bytes);
  if (opacity === 0) return Object.freeze({ bytes: output, changed: false });
  let changed = false;

  if (format === 'rgba8-unorm') {
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const selectionByte = coverageAtV1(coverage, pixel, defaultCoverage);
      if (selectionByte === 0) continue;
      const offset = pixel * 4;
      const sourceAlphaByte = bytes[offset + 3] ?? 0;
      const sourceAlpha = sourceAlphaByte / 255;
      const paintAlpha = (selectionByte / 255) * opacity;
      if (alphaLocked) {
        if (sourceAlphaByte === 0) continue;
        for (let channel = 0; channel < 3; channel += 1) {
          const sourceByte = bytes[offset + channel] ?? 0;
          const source = sourceByte / 255;
          const result = Math.round(
            clamp01V1(source + ((color[channel] ?? 0) - source) * paintAlpha) * 255,
          );
          if (result !== sourceByte) changed = true;
          output[offset + channel] = result;
        }
        continue;
      }

      const targetAlpha = paintAlpha + sourceAlpha * (1 - paintAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        const sourceByte = bytes[offset + channel] ?? 0;
        const source = sourceByte / 255;
        const target =
          targetAlpha === 0
            ? 0
            : ((color[channel] ?? 0) * paintAlpha + source * sourceAlpha * (1 - paintAlpha)) /
              targetAlpha;
        const result = Math.round(clamp01V1(target) * 255);
        if (result !== sourceByte) changed = true;
        output[offset + channel] = result;
      }
      const targetAlphaByte = Math.round(clamp01V1(targetAlpha) * 255);
      if (targetAlphaByte !== sourceAlphaByte) changed = true;
      output[offset + 3] = targetAlphaByte;
    }
    return Object.freeze({ bytes: output, changed });
  }

  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const targetView = new DataView(output.buffer, output.byteOffset, output.byteLength);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const selectionByte = coverageAtV1(coverage, pixel, defaultCoverage);
    if (selectionByte === 0) continue;
    const offset = pixel * 8;
    const rawSourceAlpha = halfToFloatV1(sourceView.getUint16(offset + 6, true));
    if (!Number.isFinite(rawSourceAlpha)) {
      throw new Error('selection-scoped fill requires finite RGBA16F alpha values');
    }
    const sourceAlpha = clamp01V1(rawSourceAlpha);
    const paintAlpha = (selectionByte / 255) * opacity;
    if (alphaLocked && sourceAlpha <= 0) continue;
    const targetAlpha = alphaLocked ? sourceAlpha : paintAlpha + sourceAlpha * (1 - paintAlpha);

    for (let channel = 0; channel < 3; channel += 1) {
      const channelOffset = offset + channel * 2;
      const sourceBits = sourceView.getUint16(channelOffset, true);
      const source = halfToFloatV1(sourceBits);
      if (!Number.isFinite(source)) {
        throw new Error('selection-scoped fill requires finite RGBA16F color values');
      }
      const target = alphaLocked
        ? source + ((color[channel] ?? 0) - source) * paintAlpha
        : targetAlpha === 0
          ? 0
          : ((color[channel] ?? 0) * paintAlpha + source * sourceAlpha * (1 - paintAlpha)) /
            targetAlpha;
      const targetBits = floatToHalfV1(target);
      if (targetBits !== sourceBits) changed = true;
      targetView.setUint16(channelOffset, targetBits, true);
    }
    if (!alphaLocked) {
      const sourceAlphaBits = sourceView.getUint16(offset + 6, true);
      const targetAlphaBits = floatToHalfV1(targetAlpha);
      if (targetAlphaBits !== sourceAlphaBits) changed = true;
      targetView.setUint16(offset + 6, targetAlphaBits, true);
    }
  }
  return Object.freeze({ bytes: output, changed });
}

function modificationCoordinatesV1(
  width: number,
  height: number,
  defaultCoverage: 0 | 1,
  coverageTiles: ReadonlyMap<string, DecodedCoverageTileV1>,
): ReadonlyMap<string, Readonly<{ x: number; y: number }>> {
  const coordinates = new Map<string, Readonly<{ x: number; y: number }>>();
  if (defaultCoverage === 1) {
    const grid = tileGridForDocumentV1(width, height);
    for (let y = 0; y < grid.rows; y += 1) {
      for (let x = 0; x < grid.columns; x += 1) {
        coordinates.set(tileKeyV1(x, y), Object.freeze({ x, y }));
      }
    }
    return coordinates;
  }
  for (const coverage of coverageTiles.values()) {
    if (coverage.values.some((value) => value !== 0)) {
      coordinates.set(
        tileKeyV1(coverage.x, coverage.y),
        Object.freeze({ x: coverage.x, y: coverage.y }),
      );
    }
  }
  return coordinates;
}

export async function prepareSelectionScopedFillV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  input: SelectionScopedFillInputV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionScopedFillV1> {
  const eligibility = selectionScopedFillEligibilityV1(snapshot, layerId, coverage);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'selection-scoped fill is unavailable');
  }
  if (coverage === null) throw new Error('selection-scoped fill selection disappeared');
  const source = snapshot.document.layerTree.layers[layerId];
  if (source?.type !== 'raster') throw new Error('selection-scoped fill source changed');
  const color = freezeRgbUnitColorV1(input.color);
  const opacity = assertOpacityV1(input.opacity ?? 1);
  if (opacity === 0) throw new Error('selection-scoped fill opacity is zero');

  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const pixelFormat = snapshot.document.color.precision;
  const defaultCoverage = effectiveDefaultCoverageV1(coverage);
  const coverageTiles = await decodeCoverageTilesV1(snapshot, coverage, persistence);
  const sourceTiles = await sourceTilesV1(snapshot, source as RasterLayerV1, persistence);
  const sources = new Map<string, PreparedRasterMergeTileV1>();
  for (const reference of sourceTiles) {
    const key = tileKeyV1(reference.x, reference.y);
    if (sources.has(key)) throw new Error(`duplicate selection-scoped fill source tile: ${key}`);
    sources.set(key, reference);
  }
  const modificationCoordinates = modificationCoordinatesV1(
    width,
    height,
    defaultCoverage,
    coverageTiles,
  );
  if (modificationCoordinates.size === 0) {
    throw new Error('selection-scoped fill requires non-empty resolved selection coverage');
  }

  const allCoordinates = new Map<string, Readonly<{ x: number; y: number }>>();
  for (const reference of sources.values()) {
    allCoordinates.set(
      tileKeyV1(reference.x, reference.y),
      Object.freeze({ x: reference.x, y: reference.y }),
    );
  }
  for (const [key, coordinate] of modificationCoordinates) allCoordinates.set(key, coordinate);

  const tiles: PreparedRasterMergeTileV1[] = [];
  let changedTileCount = 0;
  const coordinates = [...allCoordinates.values()].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );
  for (const coordinate of coordinates) {
    const key = tileKeyV1(coordinate.x, coordinate.y);
    const sourceReference = sources.get(key);
    if (!modificationCoordinates.has(key)) {
      if (sourceReference !== undefined) tiles.push(sourceReference);
      continue;
    }
    const bounds = tileBoundsForDocumentV1(width, height, {
      tx: coordinate.x,
      ty: coordinate.y,
    });
    let sourceBytes: Uint8Array<ArrayBuffer>;
    if (sourceReference === undefined) {
      sourceBytes = new Uint8Array(
        bounds.validWidth * bounds.validHeight * bytesPerPixelV1(pixelFormat),
      );
    } else {
      const decoded = await persistence.readRasterTile(sourceReference.payloadRef);
      validateSourceTileV1(decoded, pixelFormat, bounds.validWidth, bounds.validHeight);
      sourceBytes = new Uint8Array(decoded.bytes);
    }
    const selectionTile = coverageTiles.get(key);
    if (
      selectionTile !== undefined &&
      (selectionTile.width !== bounds.validWidth || selectionTile.height !== bounds.validHeight)
    ) {
      throw new Error('selection-scoped fill coverage tile dimensions changed during prepare');
    }
    const filled = applySelectionScopedRasterFillBytesV1(
      sourceBytes,
      pixelFormat,
      color,
      opacity,
      selectionTile?.values ?? null,
      defaultCoverage,
      bounds.validWidth,
      bounds.validHeight,
      source.locks.alpha,
    );
    if (!filled.changed) {
      if (sourceReference !== undefined) tiles.push(sourceReference);
      continue;
    }
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat,
      bytes: filled.bytes,
    });
    changedTileCount += 1;
    tiles.push(
      Object.freeze({ x: coordinate.x, y: coordinate.y, payloadRef: persisted.payloadRef }),
    );
  }

  if (changedTileCount === 0) {
    throw new Error('selection-scoped fill does not change raster content');
  }
  return Object.freeze({
    schema: 'illustro.prepared-selection-scoped-fill/1' as const,
    layerId,
    color,
    opacity,
    alphaLocked: source.locks.alpha,
    sourceRevision: source.revision,
    documentRevision: snapshot.document.revision,
    selectionSourceRevision: coverage.sourceRevision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedSelectionScopedFillV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionScopedFillV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection-scoped fill document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('selection-scoped fill source changed before commit');
  }
  if (source.locks.all || source.locks.pixels) {
    throw new Error('selection-scoped fill became blocked by the layer pixel lock');
  }
  if (source.locks.alpha !== prepared.alphaLocked) {
    throw new Error('selection-scoped fill alpha-lock state changed before commit');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error(
      'selection-scoped fill source gained an unbaked transform/effect before commit',
    );
  }

  const filled = Object.freeze({
    ...source,
    revision,
    boundsHint: null,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({
            x: tile.x,
            y: tile.y,
            revision,
            payloadRef: tile.payloadRef,
          }),
      ),
    ),
  }) as RasterLayerV1;
  const committedStrokes = snapshot.committedStrokes.map((entry) =>
    entry.stroke.layerId === prepared.layerId
      ? Object.freeze({ ...entry, bakedToRasterLayer: true })
      : entry,
  );
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.layerId]: filled,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
