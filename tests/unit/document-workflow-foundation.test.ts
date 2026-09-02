import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  DEFAULT_DOCUMENT_PRESETS_V1,
  documentPresetByIdV1,
} from '../../src/domain/document-presets.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class FakeRenderer {
  readonly configurations: Array<{
    width: number;
    height: number;
    workingSpace: string;
    precision: string;
  }> = [];
  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
  }): Promise<void> {
    this.configurations.push({ ...input });
  }
  async restoreBaselineStrokes(
    _strokes: readonly {
      readonly strokeId: string;
      readonly dabs: readonly BaselineBrushDabV1[];
    }[],
  ): Promise<void> {}
}

describe('M5A document creation and metadata foundation', () => {
  it('ships bounded document presets with canonical default color/precision metadata', () => {
    expect(DEFAULT_DOCUMENT_PRESETS_V1.length).toBeGreaterThanOrEqual(4);
    const ids = new Set<string>();
    for (const preset of DEFAULT_DOCUMENT_PRESETS_V1) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.width * preset.height).toBeLessThanOrEqual(2 ** 28);
      expect(preset.ppi).toBeGreaterThan(0);
      expect(preset.workingSpace).toBe('srgb');
      expect(preset.precision).toBe('rgba8-unorm');
    }
    expect(documentPresetByIdV1('a4-portrait-300')).toMatchObject({
      width: 2480,
      height: 3508,
      ppi: 300,
    });
  });

  it('creates custom Display-P3 RGBA16F documents and propagates mode to renderer configuration', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    const document = await session.createNewDocument({
      width: 4096,
      height: 3072,
      ppi: 144,
      background: { kind: 'solid', rgba: [0.25, 0.5, 0.75, 0.8] },
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
    });
    expect(document.canvas).toMatchObject({
      width: 4096,
      height: 3072,
      resolution: { ppi: 144 },
      background: { kind: 'solid', rgba: [0.25, 0.5, 0.75, 0.8] },
    });
    expect(document.color).toEqual({
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      alphaMode: 'straight',
      profile: {
        kind: 'builtin-rgb',
        space: 'display-p3',
        whitePoint: 'd65',
        transfer: 'srgb',
      },
    });
    expect(renderer.configurations.at(-1)).toEqual({
      width: 4096,
      height: 3072,
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      rasterLayers: [
        {
          layerId: document.layerTree.rootLayerIds[0],
          visible: true,
          opacity: 1,
        },
      ],
    });
  });

  it('edits PPI/background as one undoable document transaction', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    await session.createNewDocument({ width: 512, height: 512, ppi: 300 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();

    const transaction = history.commitDocumentSettings({
      ppi: 600,
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
    expect(transaction.commandId).toBe('document.settings.update');
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 600 },
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
    expect(history.snapshot()).toMatchObject({ length: 1, cursor: 1, canUndo: true });

    expect(await history.undo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 300 },
      background: { kind: 'transparent' },
    });
    expect(await history.redo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 600 },
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
  });
});
