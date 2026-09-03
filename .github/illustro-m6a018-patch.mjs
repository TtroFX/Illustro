import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceExact(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one replacement, found ${count}`);
  write(path, source.replace(before, after));
}

function appendOnce(path, marker, block) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, `${source.trimEnd()}\n\n${block.trim()}\n`);
}

// 1) Canonical brush schema: retain procedural semantics and add one explicit sampled-image runtime kind.
replaceExact(
  'src/domain/brush-schema.ts',
  "export type BrushProceduralTipShapeV1 = 'round' | 'square';\n",
  "export type BrushProceduralTipShapeV1 = 'round' | 'square';\nexport type BrushTipShapeV1 = BrushProceduralTipShapeV1 | 'sampled-image';\nexport const BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1 = 'builtin.sampled-tip.ink-v1' as const;\n",
);
replaceExact(
  'src/domain/brush-schema.ts',
  `export function withBrushProceduralTipShapeV1(\n  preset: BrushPresetV1,\n  shape: BrushProceduralTipShapeV1,\n): BrushPresetV1 {\n  if (shape !== 'round' && shape !== 'square')\n    throw new TypeError('unsupported procedural tip shape');\n  return normalizeBrushPresetV1({\n    ...preset,\n    tip: { ...preset.tip, kind: shape === 'square' ? 'procedural-square' : 'procedural-round' },\n  });\n}\n`,
  `export function withBrushProceduralTipShapeV1(\n  preset: BrushPresetV1,\n  shape: BrushProceduralTipShapeV1,\n): BrushPresetV1 {\n  if (shape !== 'round' && shape !== 'square')\n    throw new TypeError('unsupported procedural tip shape');\n  return normalizeBrushPresetV1({\n    ...preset,\n    tip: { ...preset.tip, kind: shape === 'square' ? 'procedural-square' : 'procedural-round' },\n  });\n}\n\nexport function brushTipShapeV1(preset: BrushPresetV1): BrushTipShapeV1 {\n  if (preset.tip.kind === 'sampled-image') {\n    if (preset.tip.sampleId !== BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1) {\n      throw new TypeError('unsupported sampled brush tip resource');\n    }\n    return 'sampled-image';\n  }\n  return brushProceduralTipShapeV1(preset);\n}\n\nexport function withBrushTipShapeV1(\n  preset: BrushPresetV1,\n  shape: BrushTipShapeV1,\n): BrushPresetV1 {\n  if (shape !== 'sampled-image') return withBrushProceduralTipShapeV1(preset, shape);\n  return normalizeBrushPresetV1({\n    ...preset,\n    tip: {\n      ...preset.tip,\n      kind: 'sampled-image',\n      sampleId: BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1,\n    },\n  });\n}\n`,
);

// 2) Low-level dab builder: sample the single canonical alpha image into primitive round dabs.
replaceExact(
  'src/gpu/baseline-brush.ts',
  "export type BaselineBrushTipShapeV1 = 'round' | 'square';\n",
  "export type BaselineBrushTipShapeV1 = 'round' | 'square' | 'sampled-image';\n\nexport const BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 = 5 as const;\nexport const BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1 = Object.freeze([\n  0, 42, 86, 34, 0,\n  28, 134, 218, 112, 18,\n  72, 230, 255, 184, 38,\n  36, 152, 206, 96, 12,\n  0, 48, 104, 24, 0,\n] as const);\n",
);
replaceExact(
  'src/gpu/baseline-brush.ts',
  `function freezeDab(\n  x: number,\n  y: number,\n  radius: number,\n  flow: number,\n  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n  tipShape: BaselineBrushTipShapeV1,\n): BaselineBrushDabV1 {\n  return Object.freeze({\n    schema: 'illustro.baseline-brush-dab/1' as const,\n    x,\n    y,\n    radius,\n    opacity: flow * strokeOpacity,\n    flow,\n    strokeOpacity,\n    tipShape,\n    color,\n  });\n}\n`,
  `function freezeDab(\n  x: number,\n  y: number,\n  radius: number,\n  flow: number,\n  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,\n): BaselineBrushDabV1 {\n  return Object.freeze({\n    schema: 'illustro.baseline-brush-dab/1' as const,\n    x,\n    y,\n    radius,\n    opacity: flow * strokeOpacity,\n    flow,\n    strokeOpacity,\n    tipShape,\n    color,\n  });\n}\n\nfunction pushBaselineBrushStampV1(\n  target: BaselineBrushDabV1[],\n  x: number,\n  y: number,\n  radius: number,\n  flow: number,\n  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n  tipShape: BaselineBrushTipShapeV1,\n): void {\n  if (tipShape !== 'sampled-image') {\n    target.push(freezeDab(x, y, radius, flow, strokeOpacity, color, tipShape));\n    return;\n  }\n\n  const side = BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1;\n  const microRadius = (radius / side) * 1.1;\n  const centerIndex = Math.floor(side / 2) * side + Math.floor(side / 2);\n  const emit = (index: number): void => {\n    const alphaByte = BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1[index] ?? 0;\n    if (alphaByte <= 0) return;\n    const row = Math.floor(index / side);\n    const column = index % side;\n    const offsetX = ((column + 0.5) / side - 0.5) * radius * 2;\n    const offsetY = ((row + 0.5) / side - 0.5) * radius * 2;\n    target.push(\n      freezeDab(\n        x + offsetX,\n        y + offsetY,\n        microRadius,\n        flow * (alphaByte / 255),\n        strokeOpacity,\n        color,\n        'round',\n      ),\n    );\n  };\n\n  for (let index = 0; index < BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1.length; index += 1) {\n    if (index !== centerIndex) emit(index);\n  }\n  // Keep the center primitive last so existing finish detection remains tied to the logical stamp center.\n  emit(centerIndex);\n}\n`,
);
replaceExact(
  'src/gpu/baseline-brush.ts',
  `    if (this.#tipShape !== 'round' && this.#tipShape !== 'square') {\n      throw new TypeError('unsupported baseline brush tip shape');\n    }\n`,
  `    if (\n      this.#tipShape !== 'round' &&\n      this.#tipShape !== 'square' &&\n      this.#tipShape !== 'sampled-image'\n    ) {\n      throw new TypeError('unsupported baseline brush tip shape');\n    }\n`,
);
for (const [before, after] of [
  [
    `    this.#dabs.push(\n      freezeDab(\n        sample.documentX,\n        sample.documentY,\n        this.#radius,\n        this.#flow,\n        this.#strokeOpacity,\n        this.#color,\n        this.#tipShape,\n      ),\n    );\n`,
    `    pushBaselineBrushStampV1(\n      this.#dabs,\n      sample.documentX,\n      sample.documentY,\n      this.#radius,\n      this.#flow,\n      this.#strokeOpacity,\n      this.#color,\n      this.#tipShape,\n    );\n`,
  ],
  [
    `        this.#dabs.push(\n          freezeDab(\n            lastPoint.x,\n            lastPoint.y,\n            this.#radius,\n            this.#flow,\n            this.#strokeOpacity,\n            this.#color,\n            this.#tipShape,\n          ),\n        );\n`,
    `        pushBaselineBrushStampV1(\n          this.#dabs,\n          lastPoint.x,\n          lastPoint.y,\n          this.#radius,\n          this.#flow,\n          this.#strokeOpacity,\n          this.#color,\n          this.#tipShape,\n        );\n`,
  ],
  [
    `      this.#dabs.push(\n        freezeDab(\n          cursorX,\n          cursorY,\n          this.#radius,\n          this.#flow,\n          this.#strokeOpacity,\n          this.#color,\n          this.#tipShape,\n        ),\n      );\n`,
    `      pushBaselineBrushStampV1(\n        this.#dabs,\n        cursorX,\n        cursorY,\n        this.#radius,\n        this.#flow,\n        this.#strokeOpacity,\n        this.#color,\n        this.#tipShape,\n      );\n`,
  ],
]) {
  replaceExact('src/gpu/baseline-brush.ts', before, after);
}

// 3) Preset mutation and production controller wiring.
replaceExact(
  'src/app/brush-preset-library.ts',
  `  withBrushParameterValuesV1,\n  withBrushProceduralTipShapeV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,\n  type BrushProceduralTipShapeV1,\n`,
  `  withBrushParameterValuesV1,\n  withBrushProceduralTipShapeV1,\n  withBrushTipShapeV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,\n  type BrushProceduralTipShapeV1,\n  type BrushTipShapeV1,\n`,
);
replaceExact(
  'src/app/brush-preset-library.ts',
  `export function deleteBrushPresetV1(\n`,
  `export function updateBrushPresetTipShapeV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  shape: BrushTipShapeV1,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushTipShapeV1(item.preset, shape);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function deleteBrushPresetV1(\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `  brushParameterValuesV1,\n  brushProceduralTipShapeV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,\n`,
  `  brushParameterValuesV1,\n  brushTipShapeV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,\n  type BrushTipShapeV1,\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `  updateBrushPresetParametersV1,\n  updateBrushPresetProceduralTipV1,\n`,
  `  updateBrushPresetParametersV1,\n  updateBrushPresetTipShapeV1,\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `    input.paintSession.setBrushTipShape(brushProceduralTipShapeV1(item.preset));\n`,
  `    input.paintSession.setBrushTipShape(brushTipShapeV1(item.preset));\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `    input.root.dataset.illustroBrushTipShape = brushProceduralTipShapeV1(item.preset);\n`,
  `    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `    tipShape.value = brushProceduralTipShapeV1(selected.preset);\n`,
  `    tipShape.value = brushTipShapeV1(selected.preset);\n`,
);
replaceExact(
  'src/app/brush-preset-controller.ts',
  `  const onTipShape = (): void =>\n    mutate(() =>\n      updateBrushPresetProceduralTipV1(\n        state,\n        state.selectedPresetId,\n        tipShape.value === 'square' ? 'square' : 'round',\n      ),\n    );\n`,
  `  const onTipShape = (): void => {\n    const shape: BrushTipShapeV1 =\n      tipShape.value === 'sampled-image'\n        ? 'sampled-image'\n        : tipShape.value === 'square'\n          ? 'square'\n          : 'round';\n    mutate(() => updateBrushPresetTipShapeV1(state, state.selectedPresetId, shape));\n  };\n`,
);

// 4) Session runtime accepts sampled-image as a logical stamp mode. Persisted dabs stay primitive round/square.
replaceExact(
  'src/app/paint-session-controller.ts',
  `    if (shape !== 'round' && shape !== 'square')\n      throw new TypeError('unsupported runtime brush tip shape');\n`,
  `    if (shape !== 'round' && shape !== 'square' && shape !== 'sampled-image')\n      throw new TypeError('unsupported runtime brush tip shape');\n`,
);

// 5) Reuse the established brush-tip select; no new permanent panel/surface.
replaceExact(
  'src/index.html',
  `                <select id="brush-tip-shape" aria-label="自動生成ブラシ形状">\n                  <option value="round">円形</option>\n                  <option value="square">四角</option>\n                </select>\n                <span class="shell-brush-tip-kind">自動生成</span>\n`,
  `                <select id="brush-tip-shape" aria-label="ブラシ先端形状">\n                  <option value="round">円形</option>\n                  <option value="square">四角</option>\n                  <option value="sampled-image">サンプル画像</option>\n                </select>\n                <span class="shell-brush-tip-kind">先端</span>\n`,
);

// 6) Regression coverage for schema, mutation, deterministic expansion, and canonical raster output.
write(
  'tests/unit/sampled-image-brush-tip.test.ts',
  `import { describe, expect, it } from 'vitest';\nimport {\n  BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1,\n  brushTipShapeV1,\n  createBaselineBrushPresetV1,\n  withBrushTipShapeV1,\n} from '../../src/domain/brush-schema.js';\nimport {\n  createBrushPresetLibraryStateV1,\n  selectedBrushPresetItemV1,\n  updateBrushPresetTipShapeV1,\n} from '../../src/app/brush-preset-library.js';\nimport { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';\nimport {\n  BaselineRasterTileStoreV1,\n  readBaselineRasterTilePixelV1,\n} from '../../src/gpu/baseline-raster-tile-store.js';\n\ndescribe('M6A-018 sampled image brush tip', () => {\n  it('stores the single canonical sampled resource in illustro.brush/1 without changing schema', () => {\n    const baseline = createBaselineBrushPresetV1({\n      id: 'sampled.test',\n      name: 'Sampled Test',\n      category: 'Test',\n      behavior: 'paint',\n    });\n    const sampled = withBrushTipShapeV1(baseline, 'sampled-image');\n    expect(sampled.schema).toBe('illustro.brush/1');\n    expect(sampled.tip.kind).toBe('sampled-image');\n    expect(sampled.tip.sampleId).toBe(BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1);\n    expect(brushTipShapeV1(sampled)).toBe('sampled-image');\n  });\n\n  it('mutates an unlocked preset to the sampled tip through the canonical preset state', () => {\n    const state = createBrushPresetLibraryStateV1();\n    const next = updateBrushPresetTipShapeV1(state, state.selectedPresetId, 'sampled-image');\n    expect(brushTipShapeV1(selectedBrushPresetItemV1(next).preset)).toBe('sampled-image');\n    expect(selectedBrushPresetItemV1(next).modified).toBe(true);\n  });\n\n  it('expands one sampled logical stamp deterministically into alpha-weighted primitive dabs', () => {\n    const create = () => {\n      const builder = new BaselineBrushDabBuilderV1({\n        sizePx: 20,\n        opacity: 0.8,\n        flow: 0.75,\n        tipShape: 'sampled-image',\n      });\n      builder.begin({ documentX: 32, documentY: 32 });\n      return builder.finish();\n    };\n    const first = create();\n    const second = create();\n    expect(first).toEqual(second);\n    expect(first.length).toBeGreaterThan(8);\n    expect(first.every((dab) => dab.tipShape === 'round')).toBe(true);\n    expect(new Set(first.map((dab) => dab.opacity.toFixed(6))).size).toBeGreaterThan(3);\n    expect(first.at(-1)?.x).toBe(32);\n    expect(first.at(-1)?.y).toBe(32);\n  });\n\n  it('produces canonical raster coverage without a sampled-tip renderer branch', () => {\n    const builder = new BaselineBrushDabBuilderV1({ sizePx: 20, tipShape: 'sampled-image' });\n    const dabs = builder.begin({ documentX: 32, documentY: 32 });\n    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [\n      { layerId: 'layer', visible: true, opacity: 1 },\n    ]);\n    store.applyDabs('layer', 'sampled', dabs, 'paint');\n    store.finalize('sampled');\n    const tile = store.exportTiles()[0];\n    if (tile === undefined) throw new Error('missing sampled raster tile');\n    const center = 32 * tile.width + 32;\n    const untouched = 18 * tile.width + 18;\n    expect(readBaselineRasterTilePixelV1(tile, center)[3]).toBeGreaterThan(0);\n    expect(readBaselineRasterTilePixelV1(tile, untouched)[3]).toBe(0);\n  });\n});\n`,
);

// 7) Verification contract and canonical documentation/progress.
replaceExact(
  'scripts/verify-m6a-brush.mjs',
  `requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');\n`,
  `requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');\nrequireText(progress, 'M6A-018 sampled image tip:完了', 'M6A-018 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushTipShapeV1',\n  'sampled brush tip schema normalization missing',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1',\n  'sampled brush tip alpha image missing',\n);\nrequireText(\n  read('src/app/brush-preset-controller.ts'),\n  'updateBrushPresetTipShapeV1',\n  'sampled brush tip is not production-connected to the preset UI',\n);\nrequireText(\n  read('tests/unit/sampled-image-brush-tip.test.ts'),\n  'alpha-weighted primitive dabs',\n  'sampled image brush tip regression coverage missing',\n);\n`,
);
replaceExact(
  'IMPLEMENTATION_PROGRESS.md',
  'M6A-018 sampled image tip:未完了',
  'M6A-018 sampled image tip:完了',
);
appendOnce(
  'IMPLEMENTATION_PROGRESS.md',
  '再開メモ: M6A-018 sampled image tip',
  `再開メモ: M6A-018 sampled image tipは、単一のcanonical sampled alpha imageを論理brush tipとしてプリセットへ保存し、stroke開始時に既存BaselineBrushDabBuilderへ固定する構成で完了。sampled stampは5×5 alpha maskを既存rendererが理解するalpha-weighted round primitive dabsへ決定論的に展開するため、WebGPU/Main/Worker/Canvas2D/History/Persistenceにsampled専用renderer分岐やfull-stroke replayを追加しない。M6A-019 custom tip creation、M6A-020 multiple tip assets、M6A-071/072 resource loader/managerは未完了のまま分離する。次はM6A-019 custom tip creationから再開する。`,
);
appendOnce(
  'ILLUSTRO_DESIGN_MEMO.md',
  '#### M6A sampled-image-tip boundary — 2026-09-03',
  `#### M6A sampled-image-tip boundary — 2026-09-03\n\n- M6A-018 establishes one canonical sampled-image brush-tip path without pre-implementing the later resource manager. The initial sampled tip is identified in preset data as \`builtin.sampled-tip.ink-v1\` and uses a fixed 5×5 alpha image.\n- The alpha image is sampled at logical-stamp generation time into deterministic alpha-weighted round primitive dabs. Canonical Raster Tile, Worker/Main WebGPU presentation, Canvas2D compatibility, History, Persistence, and recovery therefore continue to consume the existing primitive-dab contract instead of gaining a competing sampled renderer path.\n- The logical sampled tip is captured at stroke start with the rest of the brush parameters. Existing strokes persist their resolved primitive dabs and cannot change if the selected preset changes later.\n- M6A-019 owns creation of custom sampled tips; M6A-020 owns multiple tip assets; M6A-071/072 own final sampled-resource loading and brush-tip resource management. M6A-018 must not expand into those responsibilities.`,
);

// Remove this one-shot patch source and workflow from the implementation commit.
fs.rmSync('.github/illustro-m6a018-patch.mjs', { force: true });
fs.rmSync('.github/workflows/illustro-m6a018-patch.yml', { force: true });
