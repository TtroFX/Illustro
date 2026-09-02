from pathlib import Path

def read(path: str) -> str:
    return Path(path).read_text()

def write(path: str, text: str) -> None:
    Path(path).write_text(text)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# 1. Brush operation and implemented canonical mode.
path = 'src/gpu/baseline-brush.ts'
text = read(path)
text = replace_once(
    text,
    "export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge';",
    "export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge' | 'blur';",
    'baseline blur operation',
)
write(path, text)

path = 'src/app/canonical-raster-brush.ts'
text = read(path)
text = replace_once(
    text,
    "export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge';",
    "export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge' | 'blur';",
    'canonical blur mode union',
)
text = replace_once(
    text,
    "  'smudge',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
    "  'smudge',\n  'blur',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
    'implemented blur list',
)
text = replace_once(
    text,
    "  return value === 'raster' || value === 'eraser' || value === 'smudge';",
    "  return value === 'raster' || value === 'eraser' || value === 'smudge' || value === 'blur';",
    'implemented blur predicate',
)
text = replace_once(
    text,
    "  if (mode === 'smudge') return 'smudge';\n  return 'paint';",
    "  if (mode === 'smudge') return 'smudge';\n  if (mode === 'blur') return 'blur';\n  return 'paint';",
    'blur operation mapping',
)
write(path, text)

# 2. Canonical bounded blur on Raster Tiles.
path = 'src/gpu/baseline-raster-tile-store.ts'
text = read(path)
blur_helpers = r'''
const BLUR_BRUSH_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);
const BLUR_BRUSH_WEIGHT_TOTAL = 256;

function blurBrushRadiusV1(dab: BaselineBrushDabV1): number {
  return Math.max(0.75, Math.min(baselineDabRadiusXV1(dab), baselineDabRadiusYV1(dab)) * 0.25);
}

function sampleBlurSnapshot(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
  radius: number,
): readonly [number, number, number, number] {
  const step = radius / 2;
  let alpha = 0;
  let redPremultiplied = 0;
  let greenPremultiplied = 0;
  let bluePremultiplied = 0;
  for (let yi = 0; yi < BLUR_BRUSH_WEIGHTS.length; yi += 1) {
    const wy = BLUR_BRUSH_WEIGHTS[yi] ?? 0;
    for (let xi = 0; xi < BLUR_BRUSH_WEIGHTS.length; xi += 1) {
      const wx = BLUR_BRUSH_WEIGHTS[xi] ?? 0;
      const weight = wx * wy;
      const sample = sampleSmudgeSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + (xi - 2) * step,
        documentY + (yi - 2) * step,
      );
      alpha += sample[3] * weight;
      redPremultiplied += sample[0] * sample[3] * weight;
      greenPremultiplied += sample[1] * sample[3] * weight;
      bluePremultiplied += sample[2] * sample[3] * weight;
    }
  }
  const normalizedAlpha = clamp01(alpha / BLUR_BRUSH_WEIGHT_TOTAL);
  if (normalizedAlpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    normalizedAlpha,
  ];
}

function rasterizeBlurDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const blurRadius = blurBrushRadiusV1(dab);
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
      const blurred = sampleBlurSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + 0.5,
        documentY + 0.5,
        blurRadius,
      );
      const mixed = mixPremultipliedRgba(destination, blurred, strength);
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
    blur_helpers + "\nconst MASK_SOFTEN_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);",
    'blur helpers',
)
text = replace_once(
    text,
    "    if (operation === 'smudge') {\n      this.#applySmudgeDabs(layerId, dabs);\n      return;\n    }\n\n    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {",
    "    if (operation === 'smudge') {\n      this.#applySmudgeDabs(layerId, dabs);\n      return;\n    }\n"
    "    if (operation === 'blur') {\n      this.#applyBlurDabs(layerId, dabs);\n      return;\n    }\n\n"
    "    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {",
    'blur dispatch',
)
blur_methods = r'''  #applyBlurDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {
    const active = this.#active;
    if (active === null || active.operation !== 'blur') {
      throw new Error('blur rasterization requires an active blur transaction');
    }
    for (const dab of dabs) {
      const blurRadius = blurBrushRadiusV1(dab);
      const snapshot = this.#snapshotBlurSourceTiles(layerId, dab, blurRadius);
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
        const changed = rasterizeBlurDab(
          working,
          bounds.x,
          bounds.y,
          dab,
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

  #snapshotBlurSourceTiles(
    layerId: string,
    dab: BaselineBrushDabV1,
    blurRadius: number,
  ): BaselineSmudgeSourceSnapshotV1 {
    const radiusX = baselineDabRadiusXV1(dab);
    const radiusY = baselineDabRadiusYV1(dab);
    const left = Math.max(0, Math.floor(dab.x - radiusX - blurRadius) - 1);
    const top = Math.max(0, Math.floor(dab.y - radiusY - blurRadius) - 1);
    const right = Math.min(
      this.#documentWidth - 1,
      Math.ceil(dab.x + radiusX + blurRadius) + 1,
    );
    const bottom = Math.min(
      this.#documentHeight - 1,
      Math.ceil(dab.y + radiusY + blurRadius) + 1,
    );
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
    "\n" + blur_methods + "  finalize(strokeId: string): readonly BaselineRasterTilePatchV1[] {",
    'blur class methods',
)
write(path, text)

# 3. Worker protocol supports blur. Non-paint renderer paths are already generic from Smudge.
path = 'src/workers/render.worker.ts'
text = read(path)
text = replace_once(
    text,
    "      candidate.operation !== 'smudge'\n    ) {",
    "      candidate.operation !== 'smudge' &&\n      candidate.operation !== 'blur'\n    ) {",
    'worker restored blur operation',
)
text = replace_once(
    text,
    "      value.operation === 'smudge')",
    "      value.operation === 'smudge' ||\n      value.operation === 'blur')",
    'worker runtime blur operation',
)
write(path, text)

# 4. Reachable Blur tool control and state wiring.
path = 'src/index.html'
text = read(path)
text = replace_once(
    text,
    '            <button id="brush-mode-smudge" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="指先" title="指先 / Smudge">≈</button>\n',
    '            <button id="brush-mode-smudge" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="指先" title="指先 / Smudge">≈</button>\n'
    '            <button id="brush-mode-blur" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="ぼかし" title="ぼかし / Blur">◌</button>\n',
    'blur tool button',
)
write(path, text)

path = 'src/app/main.ts'
text = read(path)
text = replace_once(
    text,
    "const brushSmudgeButton = document.querySelector<HTMLButtonElement>('#brush-mode-smudge');\n",
    "const brushSmudgeButton = document.querySelector<HTMLButtonElement>('#brush-mode-smudge');\n"
    "const brushBlurButton = document.querySelector<HTMLButtonElement>('#brush-mode-blur');\n",
    'blur button query',
)
text = replace_once(
    text,
    "  brushSmudgeButton?.setAttribute('aria-pressed', String(mode === 'smudge'));\n}",
    "  brushSmudgeButton?.setAttribute('aria-pressed', String(mode === 'smudge'));\n"
    "  brushBlurButton?.setAttribute('aria-pressed', String(mode === 'blur'));\n}",
    'blur aria state',
)
text = replace_once(
    text,
    "brushSmudgeButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('smudge');\n  publishBrushMode();\n});\npublishBrushMode();",
    "brushSmudgeButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('smudge');\n  publishBrushMode();\n});\n"
    "brushBlurButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('blur');\n  publishBrushMode();\n});\n"
    "publishBrushMode();",
    'blur button handler',
)
write(path, text)

# 5. Canonical mode test update.
path = 'tests/unit/canonical-raster-brush.test.ts'
text = read(path)
text = replace_once(
    text,
    "  it('exposes Raster, Eraser and Smudge as implemented canonical brush modes', () => {",
    "  it('exposes Raster, Eraser, Smudge and Blur as implemented canonical brush modes', () => {",
    'mode test title',
)
text = replace_once(
    text,
    "    expect(isImplementedCanonicalBrushModeV1('smudge')).toBe(true);\n",
    "    expect(isImplementedCanonicalBrushModeV1('smudge')).toBe(true);\n"
    "    expect(isImplementedCanonicalBrushModeV1('blur')).toBe(true);\n",
    'blur mode predicate test',
)
text = replace_once(
    text,
    "    expect(requireImplementedCanonicalBrushModeV1('smudge')).toBe('smudge');\n",
    "    expect(requireImplementedCanonicalBrushModeV1('smudge')).toBe('smudge');\n"
    "    expect(requireImplementedCanonicalBrushModeV1('blur')).toBe('blur');\n",
    'blur mode require test',
)
write(path, text)

# 6. Focused Blur behavior tests.
Path('tests/unit/blur-brush-mode.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
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

function requireTile(
  tiles: readonly BaselineRasterTileImageV1[],
  tx: number,
  ty: number,
): BaselineRasterTileImageV1 {
  const tile = tiles.find((candidate) => candidate.coordinate.tx === tx && candidate.coordinate.ty === ty);
  if (tile === undefined) throw new Error(`missing tile ${tx}:${ty}`);
  return tile;
}

function blurDab(x: number, y: number) {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: 8,
    opacity: 1,
  });
}

describe('M6A-004 Blur brush mode', () => {
  it('retains Blur identity while using the incremental canonical geometry kernel', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'blur' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'blur',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('applies a bounded premultiplied blur without introducing dark RGB fringes', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 64, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'blur-center', [blurDab(64.5, 64.5)], 'blur');
    const patches = store.finalize('blur-center');
    const tile = requireTile(store.exportTiles(), 0, 0);
    const center = readBaselineRasterTilePixelV1(tile, 64 * 128 + 64);
    const neighbor = readBaselineRasterTilePixelV1(tile, 64 * 128 + 65);

    expect(center[3]).toBeGreaterThan(0);
    expect(center[3]).toBeLessThan(1);
    expect(center[0]).toBe(1);
    expect(center[1]).toBe(0);
    expect(center[2]).toBe(0);
    expect(neighbor[3]).toBeGreaterThan(0);
    expect(neighbor[0]).toBe(1);
    expect(patches).toHaveLength(1);
  });

  it('samples across canonical tile boundaries but never from lower layers', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1 },
    ]);
    store.restore([
      tileWithPixel('bottom', 0, 0, 127, 64, [0, 255, 0, 255]),
      tileWithPixel('top', 0, 0, 127, 64, [255, 0, 0, 255]),
    ]);
    store.applyDabs('top', 'blur-boundary', [blurDab(128.5, 64.5)], 'blur');
    store.finalize('blur-boundary');
    const destination = requireTile(store.exportTiles().filter((tile) => tile.layerId === 'top'), 1, 0);
    const pixel = readBaselineRasterTilePixelV1(destination, 64 * 128);

    expect(pixel[3]).toBeGreaterThan(0);
    expect(pixel[0]).toBe(1);
    expect(pixel[1]).toBe(0);
    expect(pixel[2]).toBe(0);
  });

  it('produces reversible canonical tile patches for Undo/Redo', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 64, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'blur-undo', [blurDab(64.5, 64.5)], 'blur');
    const patches = store.finalize('blur-undo');
    store.applyPatches(patches, 'before');
    let tile = requireTile(store.exportTiles(), 0, 0);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 64)).toEqual([1, 0, 0, 1]);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 65)).toEqual([0, 0, 0, 0]);

    store.applyPatches(patches, 'after');
    tile = requireTile(store.exportTiles(), 0, 0);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 65)[3]).toBeGreaterThan(0);
  });
});
''')

# 7. M6A verifier advances only the Blur mode milestone.
path = 'scripts/verify-m6a-brush.mjs'
text = read(path)
text = replace_once(
    text,
    "\"export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge';\",\n  'Raster/Eraser/Smudge mode identity missing',",
    "\"export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge' | 'blur';\",\n  'Raster/Eraser/Smudge/Blur mode identity missing',",
    'verifier blur mode union',
)
text = replace_once(
    text,
    "requireText(\n  progress,\n  'M6A-004 Blur brush mode:未完了',\n  'future Blur mode status was incorrectly advanced',\n);",
    "requireText(progress, 'M6A-004 Blur brush mode:完了', 'M6A-004 progress is not complete');\n"
    "requireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  'rasterizeBlurDab',\n  'canonical Blur rasterization missing',\n);\n"
    "requireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  'BLUR_BRUSH_WEIGHTS',\n  'bounded Blur kernel missing',\n);\n"
    "requireText(\n  read('src/workers/render.worker.ts'),\n  \"value.operation === 'blur'\",\n  'worker Blur protocol missing',\n);\n"
    "requireText(read('src/index.html'), 'id=\"brush-mode-blur\"', 'reachable Blur control missing');\n"
    "requireText(\n  read('tests/unit/blur-brush-mode.test.ts'),\n  'premultiplied blur',\n  'Blur regression coverage missing',\n);\n"
    "requireText(\n  progress,\n  'M6A-005 preset create:未完了',\n  'future brush preset status was incorrectly advanced',\n);",
    'verifier blur completion',
)
write(path, text)

# 8. Progress and canonical design record.
path = 'IMPLEMENTATION_PROGRESS.md'
text = read(path)
text = replace_once(
    text,
    "M6A-004 Blur brush mode:未完了\nM6A-005 preset create:未完了",
    "M6A-004 Blur brush mode:完了\n"
    "再開メモ: M6A-004 Blur brush modeはactive Raster Layerのcanonical pixelだけを対象に、各dab開始時のimmutable source tile snapshotへ5×5 binomial Gaussian近似を適用し、premultiplied RGBAで局所blurした結果をbrush coverage/opacityで戻す。kernel workはradiusに対して固定上限で、source samplingはTile境界を跨ぎ、実際に変化したdestination TileだけをHistory patch化する。Worker/Main/Canvas2D fallbackは既存non-paint再composite経路を共有。次はM6A-005 preset createから再開する。\n"
    "M6A-005 preset create:未完了",
    'progress blur completion',
)
write(path, text)

path = 'ILLUSTRO_DESIGN_MEMO.md'
text = read(path)
section = r'''\n\n### 2026-09-02 — M6A Blur brush canonical boundary\n\n- M6A-004 Blur brush is a **local active-Raster-Layer blur tool**, not a merged-canvas filter and not a non-destructive Filter Stack operation. It edits canonical pixels on the active Raster Layer only.\n- Every Blur dab reads from an immutable pre-dab source-tile snapshot, so traversal order inside one dab cannot feed freshly blurred output back into later samples. Sequential dabs may intentionally build on the result of earlier dabs in the same stroke.\n- The canonical CPU/fallback kernel uses a bounded **5×5 binomial Gaussian approximation**. The effective sampling radius scales from the brush footprint, but the per-output-pixel sample count remains fixed rather than growing with brush size. A future WebGPU compute implementation may replace this kernel only if visible semantics stay within verified tolerance.\n- Blur convolution and interpolation are performed in **premultiplied RGBA** before conversion back to straight stored RGBA. This prevents transparent-edge RGB contamination and dark fringe artifacts.\n- Source reads may cross canonical tile boundaries; only destination tiles whose stored pixels actually change are emitted as Raster Tile patches. Undo/Redo, persistence and recovery therefore continue to use the normal canonical Tile History path.\n- Like Smudge and Eraser, Blur presentation is canonical-tile-first: Worker/Main WebGPU and Canvas2D compatibility paths recomposite only affected tiles rather than attempting to approximate this destructive pixel operation with the additive brush surface shader.\n'''
if '### 2026-09-02 — M6A Blur brush canonical boundary' in text:
    raise RuntimeError('design memo Blur section already exists')
text += section
write(path, text)
