from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one replacement in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))

Path('src/export').mkdir(parents=True, exist_ok=True)
Path('src/export/png-export.ts').write_text(r'''import type { CanvasBackgroundSpec } from '../domain/document.js';
import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import type { PaintProjectSnapshotV1 } from '../app/paint-session-controller.js';

export const PNG_MIME_TYPE = 'image/png' as const;
export const PNG_FLATTEN_TILE_SIZE_PX = 256 as const;
export const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10] as const);

export interface BaselinePaintFlattenTileV1 {
  readonly schema: 'illustro.baseline-paint-flatten-tile/1';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface PngRasterSurfaceV1 {
  putTile(tile: BaselinePaintFlattenTileV1): void;
  encode(): Promise<Blob>;
  dispose(): void;
}

export type PngRasterSurfaceFactoryV1 = (width: number, height: number) => PngRasterSurfaceV1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function validateDab(dab: BaselineBrushDabV1): void {
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
    throw new RangeError('invalid baseline dab for PNG flatten');
  }
}

function backgroundPremultiplied(background: CanvasBackgroundSpec): readonly [number, number, number, number] {
  if (background.kind === 'transparent') return Object.freeze([0, 0, 0, 0]);
  const [red, green, blue, alpha] = background.rgba;
  for (const component of background.rgba) {
    if (!Number.isFinite(component) || component < 0 || component > 1) {
      throw new RangeError('invalid canvas background color for PNG flatten');
    }
  }
  return Object.freeze([red * alpha, green * alpha, blue * alpha, alpha]);
}

function dabIntersectsTile(
  dab: BaselineBrushDabV1,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
): boolean {
  return (
    dab.x + dab.radius > tileX &&
    dab.y + dab.radius > tileY &&
    dab.x - dab.radius < tileX + tileWidth &&
    dab.y - dab.radius < tileY + tileHeight
  );
}

function rasterizeBlackDab(
  premultiplied: Float32Array<ArrayBuffer>,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
  dab: BaselineBrushDabV1,
): void {
  validateDab(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - dab.radius));
  const minY = Math.max(tileY, Math.floor(dab.y - dab.radius));
  const maxX = Math.min(tileX + tileWidth - 1, Math.ceil(dab.x + dab.radius) - 1);
  const maxY = Math.min(tileY + tileHeight - 1, Math.ceil(dab.y + dab.radius) - 1);
  if (maxX < minX || maxY < minY) return;

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / dab.radius;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / dab.radius;
      const radialDistance = Math.hypot(localX, localY);
      if (radialDistance >= 1) continue;
      const coverage = 1 - smoothstep(0.85, 1, radialDistance);
      const sourceAlpha = clamp01(dab.opacity * coverage);
      if (sourceAlpha <= 0) continue;
      const offset = ((documentY - tileY) * tileWidth + (documentX - tileX)) * 4;
      const destinationScale = 1 - sourceAlpha;
      premultiplied[offset] = (premultiplied[offset] ?? 0) * destinationScale;
      premultiplied[offset + 1] = (premultiplied[offset + 1] ?? 0) * destinationScale;
      premultiplied[offset + 2] = (premultiplied[offset + 2] ?? 0) * destinationScale;
      premultiplied[offset + 3] = sourceAlpha + (premultiplied[offset + 3] ?? 0) * destinationScale;
    }
  }
}

function encodeStraightRgba(premultiplied: Float32Array<ArrayBuffer>): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(premultiplied.length);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    const alpha = clamp01(premultiplied[offset + 3] ?? 0);
    const inverseAlpha = alpha > 0 ? 1 / alpha : 0;
    rgba[offset] = Math.round(clamp01((premultiplied[offset] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 1] = Math.round(clamp01((premultiplied[offset + 1] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 2] = Math.round(clamp01((premultiplied[offset + 2] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 3] = Math.round(alpha * 255);
  }
  return rgba;
}

export function flattenBaselinePaintTileV1(
  snapshot: PaintProjectSnapshotV1,
  input: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): BaselinePaintFlattenTileV1 {
  const documentWidth = snapshot.document.canvas.width;
  const documentHeight = snapshot.document.canvas.height;
  if (
    !Number.isSafeInteger(input.x) ||
    !Number.isSafeInteger(input.y) ||
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.x < 0 ||
    input.y < 0 ||
    input.width < 1 ||
    input.height < 1 ||
    input.x + input.width > documentWidth ||
    input.y + input.height > documentHeight
  ) {
    throw new RangeError('PNG flatten tile must lie inside the document');
  }
  const pixelCount = input.width * input.height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > Number.MAX_SAFE_INTEGER / 4) {
    throw new RangeError('PNG flatten tile is too large');
  }
  const premultiplied = new Float32Array(pixelCount * 4);
  const background = backgroundPremultiplied(snapshot.document.canvas.background);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    premultiplied[offset] = background[0];
    premultiplied[offset + 1] = background[1];
    premultiplied[offset + 2] = background[2];
    premultiplied[offset + 3] = background[3];
  }

  for (const completed of snapshot.committedStrokes) {
    for (const dab of completed.dabs) {
      if (dabIntersectsTile(dab, input.x, input.y, input.width, input.height)) {
        rasterizeBlackDab(
          premultiplied,
          input.x,
          input.y,
          input.width,
          input.height,
          dab,
        );
      }
    }
  }

  return Object.freeze({
    schema: 'illustro.baseline-paint-flatten-tile/1' as const,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rgba: encodeStraightRgba(premultiplied),
  });
}

export function* iterateBaselinePaintFlattenTilesV1(
  snapshot: PaintProjectSnapshotV1,
  tileSize = PNG_FLATTEN_TILE_SIZE_PX,
): Generator<BaselinePaintFlattenTileV1, void, void> {
  if (!Number.isSafeInteger(tileSize) || tileSize < 1) {
    throw new RangeError('PNG flatten tile size must be a positive safe integer');
  }
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      yield flattenBaselinePaintTileV1(snapshot, {
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      });
    }
  }
}

function createBrowserPngSurface(width: number, height: number): PngRasterSurfaceV1 {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable for PNG export');
    return {
      putTile(tile) {
        context.putImageData(new ImageData(tile.rgba, tile.width, tile.height), tile.x, tile.y);
      },
      encode() {
        return canvas.convertToBlob({ type: PNG_MIME_TYPE });
      },
      dispose() {},
    };
  }
  if (typeof document === 'undefined') throw new Error('PNG encoding surface is unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is unavailable for PNG export');
  return {
    putTile(tile) {
      context.putImageData(new ImageData(tile.rgba, tile.width, tile.height), tile.x, tile.y);
    },
    encode() {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob === null) reject(new Error('browser failed to encode PNG'));
          else resolve(blob);
        }, PNG_MIME_TYPE);
      });
    },
    dispose() {
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}

export async function assertPngBlobV1(blob: Blob): Promise<Blob> {
  if (blob.type !== PNG_MIME_TYPE) throw new Error(`PNG encoder returned unexpected MIME type: ${blob.type}`);
  if (blob.size < PNG_SIGNATURE.length) throw new Error('PNG encoder returned an empty/truncated blob');
  const header = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (PNG_SIGNATURE.some((byte, index) => header[index] !== byte)) {
    throw new Error('PNG encoder returned invalid PNG signature');
  }
  return blob;
}

export async function encodePaintSnapshotToPngV1(
  snapshot: PaintProjectSnapshotV1,
  surfaceFactory: PngRasterSurfaceFactoryV1 = createBrowserPngSurface,
): Promise<Blob> {
  const surface = surfaceFactory(snapshot.document.canvas.width, snapshot.document.canvas.height);
  try {
    for (const tile of iterateBaselinePaintFlattenTilesV1(snapshot)) surface.putTile(tile);
    return await assertPngBlobV1(await surface.encode());
  } finally {
    surface.dispose();
  }
}

export function normalizePngFilenameV1(filename: string): string {
  const trimmed = filename.trim();
  const safe = trimmed.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\.+$/g, '');
  const base = safe.length === 0 ? 'Illustro' : safe;
  return base.toLowerCase().endsWith('.png') ? base : `${base}.png`;
}

export function downloadPngBlobV1(blob: Blob, filename = 'Illustro.png'): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('browser download API is unavailable');
  }
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = normalizePngFilenameV1(filename);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
''')

Path('tests/unit/png-export.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import {
  PNG_SIGNATURE,
  encodePaintSnapshotToPngV1,
  flattenBaselinePaintTileV1,
  normalizePngFilenameV1,
  type PngRasterSurfaceV1,
} from '../../src/export/png-export.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
  PaintStrokeV1,
} from '../../src/app/paint-session-controller.js';

function snapshot(input: {
  readonly width?: number;
  readonly height?: number;
  readonly background?: Parameters<typeof createDocumentV1>[0]['background'];
  readonly dabs?: readonly BaselineBrushDabV1[];
} = {}): PaintProjectSnapshotV1 {
  const base = createDocumentV1({
    width: input.width ?? 32,
    height: input.height ?? 32,
    ...(input.background === undefined ? {} : { background: input.background }),
  });
  const layer = createRasterLayer({ name: 'Layer 1' });
  const document = Object.freeze({
    ...base,
    layerTree: Object.freeze({
      rootLayerIds: Object.freeze([layer.id]),
      layers: Object.freeze({ [layer.id]: layer }),
    }),
  });
  const dabs = input.dabs ?? [];
  const committedStrokes: CompletedPaintStrokeV1[] = [];
  if (dabs.length > 0) {
    const stroke: PaintStrokeV1 = Object.freeze({
      schema: 'illustro.paint-stroke/1',
      strokeId: crypto.randomUUID(),
      pointerId: 1,
      source: 'pen',
      layerId: layer.id,
      samples: Object.freeze([]),
    });
    committedStrokes.push(Object.freeze({ stroke, dabs: Object.freeze([...dabs]) }));
  }
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1',
    document,
    committedStrokes: Object.freeze(committedStrokes),
  });
}

function dab(x: number, y: number, opacity = 1): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1',
    x,
    y,
    radius: 8,
    opacity,
  });
}

function pixel(tile: ReturnType<typeof flattenBaselinePaintTileV1>, x: number, y: number) {
  const offset = (y * tile.width + x) * 4;
  return Array.from(tile.rgba.slice(offset, offset + 4));
}

describe('M4 canonical PNG flatten', () => {
  it('keeps a blank transparent document fully transparent', () => {
    const tile = flattenBaselinePaintTileV1(snapshot({ width: 4, height: 3 }), {
      x: 0,
      y: 0,
      width: 4,
      height: 3,
    });
    expect([...tile.rgba]).toEqual(new Array(4 * 3 * 4).fill(0));
  });

  it('matches the baseline shader hard center and smooth transparent edge semantics', () => {
    const tile = flattenBaselinePaintTileV1(snapshot({ dabs: [dab(16, 16)] }), {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
    expect(pixel(tile, 15, 15)).toEqual([0, 0, 0, 255]);
    expect(pixel(tile, 0, 0)).toEqual([0, 0, 0, 0]);
    const edgeAlpha = pixel(tile, 23, 15)[3];
    expect(edgeAlpha).toBeGreaterThan(0);
    expect(edgeAlpha).toBeLessThan(255);
  });

  it('source-over composites overlapping baseline dabs and solid backgrounds', () => {
    const overlap = flattenBaselinePaintTileV1(
      snapshot({ dabs: [dab(16, 16, 0.5), dab(16, 16, 0.5)] }),
      { x: 0, y: 0, width: 32, height: 32 },
    );
    expect(pixel(overlap, 15, 15)).toEqual([0, 0, 0, 191]);

    const solid = flattenBaselinePaintTileV1(
      snapshot({
        background: { kind: 'solid', rgba: [1, 1, 1, 1] },
        dabs: [dab(16, 16, 0.5)],
      }),
      { x: 0, y: 0, width: 32, height: 32 },
    );
    expect(pixel(solid, 15, 15)).toEqual([128, 128, 128, 255]);
  });

  it('streams flattened tiles into a PNG encoder and validates the PNG signature', async () => {
    const written: Array<{ x: number; y: number; width: number; height: number }> = [];
    let disposed = false;
    const fakePng = new Blob([new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 0])], {
      type: 'image/png',
    });
    const blob = await encodePaintSnapshotToPngV1(
      snapshot({ width: 300, height: 260, dabs: [dab(20, 20)] }),
      (width, height): PngRasterSurfaceV1 => {
        expect(width).toBe(300);
        expect(height).toBe(260);
        return {
          putTile(tile) {
            written.push({ x: tile.x, y: tile.y, width: tile.width, height: tile.height });
          },
          async encode() {
            return fakePng;
          },
          dispose() {
            disposed = true;
          },
        };
      },
    );
    expect(blob).toBe(fakePng);
    expect(written).toEqual([
      { x: 0, y: 0, width: 256, height: 256 },
      { x: 256, y: 0, width: 44, height: 256 },
      { x: 0, y: 256, width: 256, height: 4 },
      { x: 256, y: 256, width: 44, height: 4 },
    ]);
    expect(disposed).toBe(true);
  });

  it('normalizes exported filenames without path/control characters', () => {
    expect(normalizePngFilenameV1(' Illustration ')).toBe('Illustration.png');
    expect(normalizePngFilenameV1('../bad:name.png')).toBe('..-bad-name.png');
  });
});
''')

Path('scripts/verify-m4-vertical-slice.mjs').write_text(r'''import fs from 'node:fs';

const requiredFiles = [
  'src/app/paint-session-controller.ts',
  'src/app/paint-history-controller.ts',
  'src/app/paint-persistence-controller.ts',
  'src/export/png-export.ts',
  'src/gpu/baseline-paint-renderer.ts',
  'src/workers/render.worker.ts',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`M4 production file missing: ${file}`);
}
const main = fs.readFileSync('src/app/main.ts', 'utf8');
for (const contract of [
  'paintHistory.commitCompletedStroke',
  'paintPersistence.markDirty',
  'paintPersistence.initialize',
  'encodePaintSnapshotToPngV1',
  'downloadPngBlobV1',
  'export-png',
]) {
  if (!main.includes(contract)) throw new Error(`M4 production wiring missing: ${contract}`);
}
const exportSource = fs.readFileSync('src/export/png-export.ts', 'utf8');
for (const contract of [
  'iterateBaselinePaintFlattenTilesV1',
  'smoothstep(0.85, 1, radialDistance)',
  'assertPngBlobV1',
  "type: PNG_MIME_TYPE",
]) {
  if (!exportSource.includes(contract)) throw new Error(`M4 PNG contract missing: ${contract}`);
}
const shader = fs.readFileSync('src/gpu/shaders/baseline-brush.wgsl', 'utf8');
if (!shader.includes('smoothstep(0.85, 1.0, radial_distance)')) {
  throw new Error('M4 baseline shader coverage contract changed without PNG flatten update');
}
console.log(JSON.stringify({ schema: 'illustro.verify-m4/1', status: 'pass', files: requiredFiles.length }));
''')

replace_once(
  'src/app/main.ts',
  "import { createPointerInputTransportV1 } from '../input/input-transport.js';",
  "import { createPointerInputTransportV1 } from '../input/input-transport.js';\nimport { downloadPngBlobV1, encodePaintSnapshotToPngV1 } from '../export/png-export.js';",
)

replace_once(
  'src/app/main.ts',
  "const buildIdentityOutput = document.querySelector<HTMLOutputElement>('#build-identity');",
  "const exportPngButton = document.querySelector<HTMLButtonElement>('#export-png');\nconst onExportPngClick = (): void => {\n  if (exportPngButton === null || exportPngButton.disabled) return;\n  exportPngButton.disabled = true;\n  root.dataset.illustroPngExport = 'exporting';\n  enqueuePaintRender(async () => {\n    try {\n      await paintPersistence.flushCheckpoint();\n      const snapshot = paintSession.projectSnapshot();\n      if (snapshot === null) throw new Error('PNG export requires an active document');\n      const blob = await encodePaintSnapshotToPngV1(snapshot);\n      downloadPngBlobV1(blob, 'Illustro.png');\n      root.dataset.illustroPngExport = 'complete';\n      incrementPerformanceCounter('export.png.complete');\n    } catch (error) {\n      root.dataset.illustroPngExport = 'error';\n      incrementPerformanceCounter('export.png.failure');\n      logger.error('export.png-failed', error);\n    } finally {\n      exportPngButton.disabled = false;\n    }\n  });\n};\nexportPngButton?.addEventListener('click', onExportPngClick);\nroot.dataset.illustroPngExport = exportPngButton === null ? 'unavailable' : 'ready';\n\nconst buildIdentityOutput = document.querySelector<HTMLOutputElement>('#build-identity');",
)

replace_once(
  'src/app/main.ts',
  "    root.dataset.illustroPaintStrokeSamples = '0';\n    publishPaintHistory();",
  "    root.dataset.illustroPaintStrokeSamples = '0';\n    if (exportPngButton !== null) exportPngButton.disabled = false;\n    publishPaintHistory();",
)

replace_once(
  'src/app/main.ts',
  "    window.removeEventListener('keydown', onPaintHistoryKeyDown);\n    document.removeEventListener('visibilitychange', onPaintVisibilityChange);",
  "    window.removeEventListener('keydown', onPaintHistoryKeyDown);\n    exportPngButton?.removeEventListener('click', onExportPngClick);\n    document.removeEventListener('visibilitychange', onPaintVisibilityChange);",
)

replace_once(
  'src/index.html',
  '<output id="build-identity" class="shell-build-identity" aria-label="Build identity">Build …</output>\n          <a class="shell-diagnostics-link" href="./diagnostics/">Diagnostics</a>',
  '<button id="export-png" class="shell-export-button" type="button" disabled>Export PNG</button>\n          <output id="build-identity" class="shell-build-identity" aria-label="Build identity">Build …</output>\n          <a class="shell-diagnostics-link" href="./diagnostics/">Diagnostics</a>',
)

replace_once(
  'public/app-shell.css',
  '.shell-build-identity,\n.shell-diagnostics-link {',
  '.shell-build-identity,\n.shell-diagnostics-link,\n.shell-export-button {',
)
replace_once(
  'public/app-shell.css',
  '.shell-diagnostics-link {\n  padding: 8px 10px;\n}\n\n.shell-diagnostics-link:focus-visible {',
  '.shell-diagnostics-link,\n.shell-export-button {\n  padding: 8px 10px;\n}\n\n.shell-export-button {\n  cursor: pointer;\n  font-family: inherit;\n}\n\n.shell-export-button:disabled {\n  cursor: default;\n  opacity: 0.5;\n}\n\n.shell-diagnostics-link:focus-visible,\n.shell-export-button:focus-visible {',
)

package = json.loads(Path('package.json').read_text())
package['scripts']['verify:m4'] = 'node scripts/verify-m4-vertical-slice.mjs'
Path('package.json').write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')
