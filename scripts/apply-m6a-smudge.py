from pathlib import Path

def read(path: str) -> str:
    return Path(path).read_text()

def write(path: str, text: str) -> None:
    Path(path).write_text(text)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# 1) Baseline brush operation identity.
path = 'src/gpu/baseline-brush.ts'
text = read(path)
text = replace_once(
    text,
    "export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase';",
    "export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge';",
    'baseline brush operation union',
)
write(path, text)

# 2) Canonical mode identity and operation mapping.
path = 'src/app/canonical-raster-brush.ts'
text = read(path)
text = replace_once(
    text,
    "export type CanonicalBrushModeV1 = 'raster' | 'eraser';",
    "export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge';",
    'canonical implemented mode union',
)
text = replace_once(
    text,
    "  'eraser',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
    "  'eraser',\n  'smudge',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
    'implemented mode list',
)
text = replace_once(
    text,
    "  return value === 'raster' || value === 'eraser';",
    "  return value === 'raster' || value === 'eraser' || value === 'smudge';",
    'implemented mode predicate',
)
text = replace_once(
    text,
    "  return mode === 'eraser' ? 'erase' : 'paint';",
    "  if (mode === 'eraser') return 'erase';\n  if (mode === 'smudge') return 'smudge';\n  return 'paint';",
    'canonical operation mapping',
)
write(path, text)

# 3) Canonical raster tile smudge implementation.
path = 'src/gpu/baseline-raster-tile-store.ts'
text = read(path)
text = replace_once(
    text,
    "  readonly affected: Map<string, TileCoordinateV1>;\n}",
    "  readonly affected: Map<string, TileCoordinateV1>;\n  lastSmudgeDab: BaselineBrushDabV1 | null;\n}",
    'active smudge state',
)

smudge_helpers = r'''type BaselineSmudgeSourceSnapshotV1 = ReadonlyMap<string, BaselineRasterTileImageV1>;

function sampleSmudgeSnapshotInteger(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  x: number,
  y: number,
): readonly [number, number, number, number] {
  if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) return [0, 0, 0, 0];
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = snapshot.get(tileKeyV1({ tx, ty }));
  if (tile === undefined) return [0, 0, 0, 0];
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) {
    return [0, 0, 0, 0];
  }
  return readPixel(tile, localY * tile.width + localX);
}

function sampleSmudgeSnapshot(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
): readonly [number, number, number, number] {
  const sampleX = documentX - 0.5;
  const sampleY = documentY - 0.5;
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const tx = sampleX - x0;
  const ty = sampleY - y0;
  const samples = [
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0, y0),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0 + 1, y0),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0, y0 + 1),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0 + 1, y0 + 1),
  ] as const;
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty] as const;
  let alpha = 0;
  let redPremultiplied = 0;
  let greenPremultiplied = 0;
  let bluePremultiplied = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? [0, 0, 0, 0];
    const weight = weights[index] ?? 0;
    alpha += sample[3] * weight;
    redPremultiplied += sample[0] * sample[3] * weight;
    greenPremultiplied += sample[1] * sample[3] * weight;
    bluePremultiplied += sample[2] * sample[3] * weight;
  }
  if (alpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    clamp01(alpha),
  ];
}

function mixPremultipliedRgba(
  destination: readonly [number, number, number, number],
  source: readonly [number, number, number, number],
  strength: number,
): readonly [number, number, number, number] {
  const amount = clamp01(strength);
  const destinationWeight = 1 - amount;
  const alpha = destination[3] * destinationWeight + source[3] * amount;
  const redPremultiplied =
    destination[0] * destination[3] * destinationWeight + source[0] * source[3] * amount;
  const greenPremultiplied =
    destination[1] * destination[3] * destinationWeight + source[1] * source[3] * amount;
  const bluePremultiplied =
    destination[2] * destination[3] * destinationWeight + source[2] * source[3] * amount;
  if (alpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    clamp01(alpha),
  ];
}

function rasterizeSmudgeDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  deltaX: number,
  deltaY: number,
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);
  let changed = false;

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    const localYSquared = localY * localY;
    if (localYSquared >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const distanceSquared = localX * localX + localYSquared;
      if (distanceSquared >= 1) continue;
      const strength =
        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
          ? opacity
          : clamp01(
              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
            );
      if (strength <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      const source = sampleSmudgeSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + 0.5 - deltaX,
        documentY + 0.5 - deltaY,
      );
      const mixed = mixPremultipliedRgba(destination, source, strength);
      if (
        Math.abs(mixed[0] - destination[0]) <= 1e-9 &&
        Math.abs(mixed[1] - destination[1]) <= 1e-9 &&
        Math.abs(mixed[2] - destination[2]) <= 1e-9 &&
        Math.abs(mixed[3] - destination[3]) <= 1e-9
      ) {
        continue;
      }
      writePixel(tile, pixel, mixed);
      changed = true;
    }
  }
  return changed;
}

'''
text = replace_once(
    text,
    "\nconst MASK_SOFTEN_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);",
    "\n" + smudge_helpers + "const MASK_SOFTEN_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);",
    'smudge helper insertion',
)
text = replace_once(
    text,
    "        before: new Map(),\n        affected: new Map(),\n      };",
    "        before: new Map(),\n        affected: new Map(),\n        lastSmudgeDab: null,\n      };",
    'active transaction initializer',
)
text = replace_once(
    text,
    "    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');\n\n    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {",
    "    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');\n    if (operation === 'smudge') {\n      this.#applySmudgeDabs(layerId, dabs);\n      return;\n    }\n\n    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {",
    'smudge dispatch',
)

smudge_methods = r'''  #applySmudgeDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {
    const active = this.#active;
    if (active === null || active.operation !== 'smudge') {
      throw new Error('smudge rasterization requires an active smudge transaction');
    }
    for (const dab of dabs) {
      const previous = active.lastSmudgeDab;
      active.lastSmudgeDab = dab;
      if (previous === null) continue;
      const deltaX = dab.x - previous.x;
      const deltaY = dab.y - previous.y;
      if (Math.hypot(deltaX, deltaY) <= 1e-9) continue;
      const snapshot = this.#snapshotSmudgeSourceTiles(layerId, dab, deltaX, deltaY);
      for (const plan of planBaselineBrushTilesV1(
        Object.freeze([dab]),
        this.#documentWidth,
        this.#documentHeight,
      )) {
        const key = tileStateKey(layerId, plan.coordinate);
        const current = this.#tiles.get(key);
        const working =
          current === undefined
            ? createTransparentTile(
                layerId,
                plan.coordinate,
                this.#documentWidth,
                this.#documentHeight,
                this.#pixelFormat,
              )
            : cloneTile(current);
        const bounds = tileBoundsForDocumentV1(
          this.#documentWidth,
          this.#documentHeight,
          plan.coordinate,
        );
        const changed = rasterizeSmudgeDab(
          working,
          bounds.x,
          bounds.y,
          dab,
          deltaX,
          deltaY,
          snapshot,
          this.#documentWidth,
          this.#documentHeight,
        );
        if (!changed) continue;
        if (!active.before.has(key)) {
          active.before.set(key, current === undefined ? null : cloneTile(current));
          active.affected.set(key, freezeCoordinate(plan.coordinate));
        }
        this.#tiles.set(key, working);
        this.#compositeCache.delete(tileKeyV1(plan.coordinate));
      }
    }
  }

  #snapshotSmudgeSourceTiles(
    layerId: string,
    dab: BaselineBrushDabV1,
    deltaX: number,
    deltaY: number,
  ): BaselineSmudgeSourceSnapshotV1 {
    const radiusX = baselineDabRadiusXV1(dab);
    const radiusY = baselineDabRadiusYV1(dab);
    const left = Math.max(0, Math.floor(dab.x - radiusX - deltaX) - 1);
    const top = Math.max(0, Math.floor(dab.y - radiusY - deltaY) - 1);
    const right = Math.min(this.#documentWidth - 1, Math.ceil(dab.x + radiusX - deltaX) + 1);
    const bottom = Math.min(this.#documentHeight - 1, Math.ceil(dab.y + radiusY - deltaY) + 1);
    const snapshot = new Map<string, BaselineRasterTileImageV1>();
    if (right < left || bottom < top) return snapshot;
    const minTx = Math.floor(left / CANONICAL_TILE_SIZE_PX);
    const minTy = Math.floor(top / CANONICAL_TILE_SIZE_PX);
    const maxTx = Math.floor(right / CANONICAL_TILE_SIZE_PX);
    const maxTy = Math.floor(bottom / CANONICAL_TILE_SIZE_PX);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        const coordinate = { tx, ty };
        const source = this.#tiles.get(tileStateKey(layerId, coordinate));
        if (source !== undefined) snapshot.set(tileKeyV1(coordinate), cloneTile(source));
      }
    }
    return snapshot;
  }

'''
text = replace_once(
    text,
    "\n  finalize(strokeId: string): readonly BaselineRasterTilePatchV1[] {",
    "\n" + smudge_methods + "  finalize(strokeId: string): readonly BaselineRasterTilePatchV1[] {",
    'smudge class methods insertion',
)
write(path, text)

# 4) Tile-changing modes use recomposite presentation rather than paint shader append.
path = 'src/gpu/baseline-paint-renderer.ts'
text = read(path)
if text.count("if (operation === 'erase') {") != 3:
    raise RuntimeError("unexpected baseline paint eraser branch count")
text = text.replace("if (operation === 'erase') {", "if (operation !== 'paint') {")
write(path, text)

path = 'src/app/renderer-controller.ts'
text = read(path)
text = replace_once(
    text,
    "      if (operation === 'erase') {",
    "      if (operation !== 'paint') {",
    'compatibility non-paint tile sync',
)
write(path, text)

# 5) Worker accepts persisted/runtime smudge operations.
path = 'src/workers/render.worker.ts'
text = read(path)
text = replace_once(
    text,
    "      candidate.operation !== 'erase'\n    ) {",
    "      candidate.operation !== 'erase' &&\n      candidate.operation !== 'smudge'\n    ) {",
    'worker restored smudge operation',
)
text = replace_once(
    text,
    "(value.operation === undefined || value.operation === 'paint' || value.operation === 'erase')",
    "(value.operation === undefined ||\n      value.operation === 'paint' ||\n      value.operation === 'erase' ||\n      value.operation === 'smudge')",
    'worker runtime smudge operation',
)
write(path, text)

# 6) Reachable tool-rail Smudge control.
path = 'src/index.html'
text = read(path)
text = replace_once(
    text,
    '            <button id="brush-mode-eraser" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="消しゴム" title="消しゴム">◇</button>\n',
    '            <button id="brush-mode-eraser" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="消しゴム" title="消しゴム">◇</button>\n'
    '            <button id="brush-mode-smudge" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="指先" title="指先 / Smudge">≈</button>\n',
    'smudge tool button',
)
write(path, text)

path = 'src/app/main.ts'
text = read(path)
text = replace_once(
    text,
    "const brushEraserButton = document.querySelector<HTMLButtonElement>('#brush-mode-eraser');\n",
    "const brushEraserButton = document.querySelector<HTMLButtonElement>('#brush-mode-eraser');\n"
    "const brushSmudgeButton = document.querySelector<HTMLButtonElement>('#brush-mode-smudge');\n",
    'smudge button query',
)
text = replace_once(
    text,
    "  brushEraserButton?.setAttribute('aria-pressed', String(mode === 'eraser'));\n}",
    "  brushEraserButton?.setAttribute('aria-pressed', String(mode === 'eraser'));\n"
    "  brushSmudgeButton?.setAttribute('aria-pressed', String(mode === 'smudge'));\n}",
    'smudge aria state',
)
text = replace_once(
    text,
    "brushEraserButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('eraser');\n  publishBrushMode();\n});\npublishBrushMode();",
    "brushEraserButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('eraser');\n  publishBrushMode();\n});\n"
    "brushSmudgeButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('smudge');\n  publishBrushMode();\n});\n"
    "publishBrushMode();",
    'smudge button event',
)
write(path, text)

# 7) Mode regression expectations.
path = 'tests/unit/canonical-raster-brush.test.ts'
text = read(path)
text = replace_once(
    text,
    "  it('exposes Raster and Eraser as implemented canonical brush modes', () => {",
    "  it('exposes Raster, Eraser and Smudge as implemented canonical brush modes', () => {",
    'canonical mode test title',
)
text = replace_once(
    text,
    "    expect(isImplementedCanonicalBrushModeV1('eraser')).toBe(true);\n"
    "    expect(requireImplementedCanonicalBrushModeV1('raster')).toBe('raster');",
    "    expect(isImplementedCanonicalBrushModeV1('eraser')).toBe(true);\n"
    "    expect(isImplementedCanonicalBrushModeV1('smudge')).toBe(true);\n"
    "    expect(requireImplementedCanonicalBrushModeV1('raster')).toBe('raster');",
    'canonical smudge predicate test',
)
text = replace_once(
    text,
    "    expect(requireImplementedCanonicalBrushModeV1('eraser')).toBe('eraser');\n",
    "    expect(requireImplementedCanonicalBrushModeV1('eraser')).toBe('eraser');\n"
    "    expect(requireImplementedCanonicalBrushModeV1('smudge')).toBe('smudge');\n",
    'canonical smudge require test',
)
write(path, text)

# 8) Focused Smudge tests.
Path('tests/unit/smudge-mode.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
  type BaselineRasterTileImageV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

function tileWithPixel(
  layerId: string,
  tx: number,
  ty: number,
  localX: number,
  localY: number,
  rgba: readonly [number, number, number, number],
): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(128 * 128 * 4);
  const offset = (localY * 128 + localX) * 4;
  bytes[offset] = rgba[0];
  bytes[offset + 1] = rgba[1];
  bytes[offset + 2] = rgba[2];
  bytes[offset + 3] = rgba[3];
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx, ty }),
    width: 128,
    height: 128,
    pixelFormat: 'rgba8-unorm' as const,
    bytes,
  });
}

const smudgeDabs = Object.freeze([
  Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 124.5,
    y: 64.5,
    radius: 8,
    opacity: 1,
  }),
  Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 132.5,
    y: 64.5,
    radius: 8,
    opacity: 1,
  }),
]);

describe('M6A-003 Smudge/Finger mode', () => {
  it('retains smudge identity while using the incremental canonical geometry kernel', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'smudge' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    const delta = stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(delta).toHaveLength(2);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'smudge',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('pulls active-layer pixels across a tile boundary from an immutable pre-dab snapshot', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 124, 64, [255, 0, 0, 255])]);

    store.applyDabs('layer', 'smudge-stroke', smudgeDabs, 'smudge');
    const patches = store.finalize('smudge-stroke');
    const destination = store
      .exportTiles()
      .find((tile) => tile.coordinate.tx === 1 && tile.coordinate.ty === 0);

    expect(destination).toBeDefined();
    expect(readBaselineRasterTilePixelV1(destination!, 64 * 128 + 4)).toEqual([1, 0, 0, 1]);
    expect(patches.some((patch) => patch.coordinate.tx === 1)).toBe(true);
  });

  it('samples only the active raster layer rather than merged lower-layer color', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('bottom', 0, 0, 124, 64, [255, 0, 0, 255])]);

    store.applyDabs('top', 'top-smudge', smudgeDabs, 'smudge');
    expect(store.finalize('top-smudge')).toEqual([]);
    expect(store.exportTiles()).toHaveLength(1);
  });

  it('produces reversible canonical tile patches for normal Undo/Redo', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 124, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'smudge-undo', smudgeDabs, 'smudge');
    const patches = store.finalize('smudge-undo');

    store.applyPatches(patches, 'before');
    const tiles = store.exportTiles();
    expect(tiles).toHaveLength(1);
    expect(tiles[0]?.coordinate.tx).toBe(0);
    expect(readBaselineRasterTilePixelV1(tiles[0]!, 64 * 128 + 124)).toEqual([1, 0, 0, 1]);

    store.applyPatches(patches, 'after');
    const destination = store.exportTiles().find((tile) => tile.coordinate.tx === 1);
    expect(destination).toBeDefined();
    expect(readBaselineRasterTilePixelV1(destination!, 64 * 128 + 4)).toEqual([1, 0, 0, 1]);
  });
});
''')

# 9) M6A verifier.
path = 'scripts/verify-m6a-brush.mjs'
text = read(path)
text = replace_once(
    text,
    "\"export type CanonicalBrushModeV1 = 'raster' | 'eraser';\",\n  'Raster/Eraser mode identity missing',",
    "\"export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge';\",\n  'Raster/Eraser/Smudge mode identity missing',",
    'verifier mode union',
)
text = replace_once(
    text,
    "  'M6A-003 Smudge/Finger mode:未完了',\n  'future mode status was incorrectly advanced',",
    "  'M6A-003 Smudge/Finger mode:完了',\n  'M6A-003 progress is not complete',",
    'verifier smudge progress',
)
insert = r'''requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'rasterizeSmudgeDab',
  'canonical Smudge rasterization missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'sampleSmudgeSnapshot',
  'Smudge snapshot sampling missing',
);
requireText(
  read('src/app/renderer-controller.ts'),
  "operation !== 'paint'",
  'tile-changing brush modes do not use canonical recomposite presentation',
);
requireText(
  read('src/workers/render.worker.ts'),
  "value.operation === 'smudge'",
  'worker Smudge protocol missing',
);
requireText(read('src/index.html'), 'id="brush-mode-smudge"', 'reachable Smudge control missing');
requireText(
  read('tests/unit/smudge-mode.test.ts'),
  'immutable pre-dab snapshot',
  'Smudge snapshot regression coverage missing',
);
requireText(
  progress,
  'M6A-004 Blur brush mode:未完了',
  'future Blur mode status was incorrectly advanced',
);
'''
text = replace_once(
    text,
    "requireText(read('src/index.html'), 'id=\"brush-mode-eraser\"', 'reachable Eraser control missing');\n",
    "requireText(read('src/index.html'), 'id=\"brush-mode-eraser\"', 'reachable Eraser control missing');\n" + insert,
    'verifier smudge assertions',
)
write(path, text)

# 10) Canonical progress and restart note.
path = 'IMPLEMENTATION_PROGRESS.md'
text = read(path)
text = replace_once(
    text,
    "M6A-003 Smudge/Finger mode:未完了\nM6A-004 Blur brush mode:未完了",
    "M6A-003 Smudge/Finger mode:完了\n"
    "再開メモ: M6A-003 Smudge/Finger modeはactive Raster Layer内だけを対象に、連続dabの移動差で直前位置側のpixelを現在位置へ引くdisplacement型として実装。各dabは変更前source tile snapshotを使い、premultiplied RGBAでbilinear sampleしてalpha縁の色にじみと同一dab内feedbackを避ける。Tile境界を跨いでsamplingでき、変更Tileだけcanonical patch化してWorker/Main/Canvas2D fallbackを再compositeする。wet/pickup型の混色はM6A-063として別途未完了。次はM6A-004 Blur brush modeから再開する。\n"
    "M6A-004 Blur brush mode:未完了",
    'progress smudge completion',
)
write(path, text)

# 11) Canonical design memo.
path = 'ILLUSTRO_DESIGN_MEMO.md'
text = read(path)
section = r'''\n\n### 2026-09-02 — M6A Smudge/Finger canonical boundary\n\n- M6A-003 Smudge/Finger is an **active-Raster-Layer pixel displacement tool**. It samples and moves only canonical pixels from the active Raster Layer; it does not sample the merged composite or lower layers.\n- Consecutive canonical brush dabs define the displacement vector. The first dab establishes the starting position without mutating pixels; later dabs pull source pixels from the previous-position side into the current dab footprint.\n- Each dab samples from an immutable pre-dab source-tile snapshot. Sampling is bilinear in **premultiplied RGBA**, then mixed back by the canonical brush coverage/opacity. This prevents within-dab traversal-order feedback and avoids RGB fringe artifacts around partially transparent pixels.\n- Source sampling may cross canonical tile boundaries. Only destination tiles whose stored pixels actually change become Raster Tile patches, so normal Tile History Undo/Redo, persistence and recovery remain the canonical state path.\n- Smudge cannot use the ordinary additive brush surface shader. Worker/Main WebGPU and Canvas2D compatibility presentation therefore converge by recompositing only the affected canonical tiles, the same retained-tile principle used by other destructive pixel-edit operations.\n- This basic displacement Smudge is intentionally separate from M6A-063 wet/smudge-style pickup and ordinary raster color-mixing behavior. M6A-003 does not claim wet-paint pickup, reservoir, dilution or pigment simulation semantics.\n'''
if '### 2026-09-02 — M6A Smudge/Finger canonical boundary' in text:
    raise RuntimeError('design memo Smudge section already exists')
text += section
write(path, text)
