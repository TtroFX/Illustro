from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one anchor, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    file_path.write_text(text + addition, encoding='utf-8')


replace_once(
    'src/input/hover-state.ts',
    """  readonly pointerId: number | null;
  readonly surfaceX: number | null;
""",
    """  readonly pointerId: number | null;
  readonly clientX: number | null;
  readonly clientY: number | null;
  readonly surfaceX: number | null;
""",
)
replace_once(
    'src/input/hover-state.ts',
    """        pointerId: null,
        surfaceX: null,
""",
    """        pointerId: null,
        clientX: null,
        clientY: null,
        surfaceX: null,
""",
)
replace_once(
    'src/input/hover-state.ts',
    """      pointerId: sample.pointerId,
      surfaceX: sample.surfaceX,
""",
    """      pointerId: sample.pointerId,
      clientX: sample.clientX,
      clientY: sample.clientY,
      surfaceX: sample.surfaceX,
""",
)

Path('src/app/brush-hover-outline-controller.ts').write_text(r'''import type { PointerHoverSnapshotV1 } from '../input/hover-state.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export interface BrushHoverOutlinePresentationV1 {
  readonly visible: boolean;
  readonly xCssPx: number;
  readonly yCssPx: number;
  readonly diameterCssPx: number;
}

const HIDDEN_BRUSH_HOVER_OUTLINE_V1: BrushHoverOutlinePresentationV1 = Object.freeze({
  visible: false,
  xCssPx: 0,
  yCssPx: 0,
  diameterCssPx: 0,
});

export function resolveBrushHoverOutlinePresentationV1(input: {
  readonly hover: PointerHoverSnapshotV1;
  readonly stageLeft: number;
  readonly stageTop: number;
  readonly documentX: number;
  readonly documentY: number;
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly brushSizePx: number;
  readonly viewport: Pick<
    ViewportSnapshotV1,
    'documentWidth' | 'documentHeight' | 'baseWidth' | 'baseHeight' | 'zoom'
  >;
}): BrushHoverOutlinePresentationV1 {
  const { hover, viewport } = input;
  if (
    !hover.active ||
    hover.clientX === null ||
    hover.clientY === null ||
    !Number.isFinite(hover.clientX) ||
    !Number.isFinite(hover.clientY) ||
    !Number.isFinite(input.stageLeft) ||
    !Number.isFinite(input.stageTop) ||
    !Number.isFinite(input.documentX) ||
    !Number.isFinite(input.documentY) ||
    !Number.isFinite(input.documentWidth) ||
    !Number.isFinite(input.documentHeight) ||
    input.documentWidth <= 0 ||
    input.documentHeight <= 0 ||
    input.documentX < 0 ||
    input.documentY < 0 ||
    input.documentX > input.documentWidth ||
    input.documentY > input.documentHeight ||
    !Number.isFinite(input.brushSizePx) ||
    input.brushSizePx <= 0 ||
    !Number.isFinite(viewport.documentWidth) ||
    !Number.isFinite(viewport.documentHeight) ||
    viewport.documentWidth <= 0 ||
    viewport.documentHeight <= 0 ||
    !Number.isFinite(viewport.baseWidth) ||
    !Number.isFinite(viewport.baseHeight) ||
    viewport.baseWidth <= 0 ||
    viewport.baseHeight <= 0 ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0
  ) {
    return HIDDEN_BRUSH_HOVER_OUTLINE_V1;
  }

  const scaleX = viewport.baseWidth / viewport.documentWidth;
  const scaleY = viewport.baseHeight / viewport.documentHeight;
  const projectedScale = Math.min(scaleX, scaleY) * viewport.zoom;
  const diameterCssPx = input.brushSizePx * projectedScale;
  if (!Number.isFinite(diameterCssPx) || diameterCssPx <= 0) {
    return HIDDEN_BRUSH_HOVER_OUTLINE_V1;
  }

  return Object.freeze({
    visible: true,
    xCssPx: hover.clientX - input.stageLeft,
    yCssPx: hover.clientY - input.stageTop,
    diameterCssPx,
  });
}

export interface BrushHoverOutlineControllerV1 {
  readonly schema: 'illustro.brush-hover-outline-controller/1';
  updateHover(hover: PointerHoverSnapshotV1): void;
  refresh(): void;
  dispose(): void;
}

export function installBrushHoverOutlineControllerV1(input: {
  readonly root: HTMLElement;
  readonly surface: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly viewport: ViewportControllerV1;
}): BrushHoverOutlineControllerV1 {
  const stage = input.root.querySelector<HTMLElement>('.shell-canvas-stage');
  const outline = input.root.querySelector<HTMLElement>('#brush-hover-outline');
  if (stage === null || outline === null) {
    throw new Error('brush hover outline requires canvas stage and overlay elements');
  }

  let currentHover: PointerHoverSnapshotV1 | null = null;
  let disposed = false;

  const hide = (): void => {
    outline.hidden = true;
    input.root.dataset.illustroBrushHoverOutline = 'hidden';
    input.root.dataset.illustroBrushHoverDiameterCssPx = '';
  };

  const refresh = (): void => {
    if (disposed) return;
    const hover = currentHover;
    const documentValue = input.paintSession.currentDocument();
    if (
      hover === null ||
      !hover.active ||
      hover.clientX === null ||
      hover.clientY === null ||
      documentValue === null
    ) {
      hide();
      return;
    }

    const viewport = input.viewport.snapshot();
    if (
      viewport.documentWidth !== documentValue.canvas.width ||
      viewport.documentHeight !== documentValue.canvas.height
    ) {
      hide();
      return;
    }

    const documentPoint = input.viewport.mapPointerToDocument(
      { clientX: hover.clientX, clientY: hover.clientY },
      documentValue,
    );
    const stageRect = stage.getBoundingClientRect();
    const presentation = resolveBrushHoverOutlinePresentationV1({
      hover,
      stageLeft: stageRect.left,
      stageTop: stageRect.top,
      documentX: documentPoint.x,
      documentY: documentPoint.y,
      documentWidth: documentValue.canvas.width,
      documentHeight: documentValue.canvas.height,
      brushSizePx: input.paintSession.snapshot().brushParameters.sizePx,
      viewport,
    });
    if (!presentation.visible) {
      hide();
      return;
    }

    outline.style.left = `${presentation.xCssPx}px`;
    outline.style.top = `${presentation.yCssPx}px`;
    outline.style.width = `${presentation.diameterCssPx}px`;
    outline.style.height = `${presentation.diameterCssPx}px`;
    outline.hidden = false;
    input.root.dataset.illustroBrushHoverOutline = 'visible';
    input.root.dataset.illustroBrushHoverDiameterCssPx = String(presentation.diameterCssPx);
  };

  const onPointerLeave = (): void => {
    currentHover = null;
    hide();
  };
  input.surface.addEventListener('pointerleave', onPointerLeave);
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  hide();

  return Object.freeze({
    schema: 'illustro.brush-hover-outline-controller/1' as const,
    updateHover(hover: PointerHoverSnapshotV1): void {
      currentHover = hover.active ? hover : null;
      refresh();
    },
    refresh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      currentHover = null;
      input.surface.removeEventListener('pointerleave', onPointerLeave);
      unsubscribeViewport();
      hide();
    },
  });
}
''', encoding='utf-8')

replace_once(
    'src/app/main.ts',
    """import { installBrushPresetControllerV1 } from './brush-preset-controller.js';
""",
    """import { installBrushPresetControllerV1 } from './brush-preset-controller.js';
import { installBrushHoverOutlineControllerV1 } from './brush-hover-outline-controller.js';
""",
)
replace_once(
    'src/app/main.ts',
    """const paintSession = new PaintSessionControllerV1(renderer, {
  mapPointerToDocument: (sample, documentValue) =>
    viewport.mapPointerToDocument(sample, documentValue),
});
const brushRasterButton = document.querySelector<HTMLButtonElement>('#brush-mode-raster');
""",
    """const paintSession = new PaintSessionControllerV1(renderer, {
  mapPointerToDocument: (sample, documentValue) =>
    viewport.mapPointerToDocument(sample, documentValue),
});
const brushHoverOutline = installBrushHoverOutlineControllerV1({
  root,
  surface: shell.canvas,
  paintSession,
  viewport,
});
const brushRasterButton = document.querySelector<HTMLButtonElement>('#brush-mode-raster');
""",
)
replace_once(
    'src/app/main.ts',
    """  onBrushModeChanged: publishBrushMode,
});
""",
    """  onBrushModeChanged: () => {
    publishBrushMode();
    brushHoverOutline.refresh();
  },
});
""",
)
replace_once(
    'src/app/main.ts',
    """  const hover = pointerHover.ingest(batch);
  const arbitration = pointerArbitration.route(batch);
""",
    """  const hover = pointerHover.ingest(batch);
  brushHoverOutline.updateHover(hover);
  const arbitration = pointerArbitration.route(batch);
""",
)
replace_once(
    'src/app/main.ts',
    """    pointerHover.clear();
    root.dataset.illustroPointerInput = 'disposed';
""",
    """    pointerHover.clear();
    brushHoverOutline.dispose();
    root.dataset.illustroPointerInput = 'disposed';
""",
)

replace_once(
    'src/index.html',
    """            <div id="canvas-viewport-frame" class="shell-canvas-frame">
              <canvas id="render-surface" class="shell-canvas" width="1" height="1" aria-label="Illustration canvas"></canvas>
              <div id="canvas-grid-overlay" class="shell-grid-overlay" aria-hidden="true" hidden></div>
            </div>
          </div>
""",
    """            <div id="canvas-viewport-frame" class="shell-canvas-frame">
              <canvas id="render-surface" class="shell-canvas" width="1" height="1" aria-label="Illustration canvas"></canvas>
              <div id="canvas-grid-overlay" class="shell-grid-overlay" aria-hidden="true" hidden></div>
            </div>
            <div id="brush-hover-outline" class="shell-brush-hover-outline" aria-hidden="true" hidden></div>
          </div>
""",
)

replace_once(
    'public/app-shell.css',
    """.shell-grid-overlay[hidden] {
  display: none;
}

.shell-canvas[data-pixel-preview='true'] {
""",
    """.shell-grid-overlay[hidden] {
  display: none;
}

.shell-brush-hover-outline {
  position: absolute;
  z-index: 4;
  box-sizing: border-box;
  pointer-events: none;
  border: 1px solid rgb(255 255 255 / 94%);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(28 38 58 / 78%);
  transform: translate(-50%, -50%);
}

.shell-brush-hover-outline[hidden] {
  display: none;
}

.shell-canvas[data-pixel-preview='true'] {
""",
)

replace_once(
    'tests/unit/hover-state.test.ts',
    """      pointerId: 1,
      surfaceX: 30,
""",
    """      pointerId: 1,
      clientX: 40,
      clientY: 50,
      surfaceX: 30,
""",
)

Path('tests/unit/brush-hover-outline.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { resolveBrushHoverOutlinePresentationV1 } from '../../src/app/brush-hover-outline-controller.js';
import type { PointerHoverSnapshotV1 } from '../../src/input/hover-state.js';

function hover(overrides: Partial<PointerHoverSnapshotV1> = {}): PointerHoverSnapshotV1 {
  return Object.freeze({
    schema: 'illustro.pointer-hover-state/1',
    active: true,
    source: 'pen',
    pointerId: 7,
    clientX: 260,
    clientY: 145,
    surfaceX: 250,
    surfaceY: 125,
    pressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    timestampMs: 20,
    ...overrides,
  });
}

const viewport = Object.freeze({
  documentWidth: 1000,
  documentHeight: 500,
  baseWidth: 500,
  baseHeight: 250,
  zoom: 2,
});

describe('M6A hover brush outline presentation', () => {
  it('projects nominal brush diameter through viewport zoom in screen space', () => {
    const presentation = resolveBrushHoverOutlinePresentationV1({
      hover: hover(),
      stageLeft: 10,
      stageTop: 20,
      documentX: 500,
      documentY: 250,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 64,
      viewport,
    });

    expect(presentation).toEqual({
      visible: true,
      xCssPx: 250,
      yCssPx: 125,
      diameterCssPx: 64,
    });
  });

  it('hides the outline when hover is inactive or mapped outside the document', () => {
    const base = {
      stageLeft: 10,
      stageTop: 20,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 64,
      viewport,
    } as const;
    expect(
      resolveBrushHoverOutlinePresentationV1({
        ...base,
        hover: hover({ active: false }),
        documentX: 500,
        documentY: 250,
      }).visible,
    ).toBe(false);
    expect(
      resolveBrushHoverOutlinePresentationV1({
        ...base,
        hover: hover(),
        documentX: 1001,
        documentY: 250,
      }).visible,
    ).toBe(false);
  });

  it('keeps pointer center independent from zoom while changing only projected diameter', () => {
    const input = {
      hover: hover(),
      stageLeft: 10,
      stageTop: 20,
      documentX: 500,
      documentY: 250,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 20,
    } as const;
    const atOne = resolveBrushHoverOutlinePresentationV1({
      ...input,
      viewport: { ...viewport, zoom: 1 },
    });
    const atFour = resolveBrushHoverOutlinePresentationV1({
      ...input,
      viewport: { ...viewport, zoom: 4 },
    });

    expect(atOne.xCssPx).toBe(atFour.xCssPx);
    expect(atOne.yCssPx).toBe(atFour.yCssPx);
    expect(atFour.diameterCssPx).toBe(atOne.diameterCssPx * 4);
  });
});
''', encoding='utf-8')

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-066 progress is not complete',
    r'''
requireText(progress, 'M6A-066 hover brush outline:完了', 'M6A-066 progress is not complete');
requireText(
  read('src/input/hover-state.ts'),
  'readonly clientX: number | null;',
  'hover state does not retain client coordinates for transformed viewport mapping',
);
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  'resolveBrushHoverOutlinePresentationV1',
  'hover brush outline presentation resolver missing',
);
requireText(
  read('src/app/main.ts'),
  'brushHoverOutline.updateHover(hover)',
  'production pointer hover is not connected to brush outline',
);
requireText(
  read('src/index.html'),
  'id="brush-hover-outline"',
  'brush hover outline overlay is not reachable in the canvas stage',
);
requireText(
  read('public/app-shell.css'),
  '.shell-brush-hover-outline',
  'brush hover outline styling missing',
);
requireText(
  read('tests/unit/brush-hover-outline.test.ts'),
  'projects nominal brush diameter through viewport zoom in screen space',
  'hover brush outline regression coverage missing',
);
''',
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-066 hover brush outline:未完了
""",
    """M6A-066 hover brush outline:完了
再開メモ: M6A-066は既存PointerHoverTrackerV1のpen/mouse非接触hoverをproductionのscreen-space brush outlineへ接続した。hover snapshotへclientX/clientYを保持し、Viewport Controllerの既存mapPointerToDocumentでpan/zoom/rotation/mirror後もdocument内判定を行う。円の中心はstage内の実pointer位置、直径は現在Brush Parametersのnominal sizePxをfit base scale×zoomでCSS pxへ投影する。hover pressure=0で径を潰さず、touch/contact/pointerleave/document外/no-documentでは非表示。overlayはpointer-events:noneかつRenderer/History/Persistence/Exportへ入らず、viewport変更とpreset/property変更でも即refreshする。M6A-067のcrosshairは未実装のまま分離。次はM6A-067 hover crosshair optionから再開する。
""",
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A hover brush outline boundary — 2026-09-04',
    r'''
## M6A hover brush outline boundary — 2026-09-04

**AUTHORITATIVE for M6A-066.** Brush hover outline is presentation-only UI and must reuse the canonical `PointerHoverTrackerV1` pen/mouse no-contact hover signal rather than creating a second input path. Touch never produces this hover cursor. Contact, cancellation, pointer leave, no open document, and a viewport-mapped point outside the document hide it immediately. The hover snapshot retains client coordinates so the existing Viewport Controller remains the single source for pan/zoom/rotation/mirror mapping.

The M6A-066 outline is a circular nominal-size indicator. Its center is the actual hover position in canvas-stage CSS pixels and its diameter is the current Brush Parameters `sizePx` projected through the current fitted document scale and viewport zoom. Hover pressure is zero and does not collapse nominal diameter. The outline lives in screen space so its border thickness remains visually stable while zoom changes; viewport updates and brush preset/property updates refresh the geometry even when the pointer is stationary.

The overlay has `pointer-events:none` and is not part of the Renderer, Raster Tile state, History, persistence, recovery, or export. M6A-067 owns the optional center crosshair and is intentionally not folded into this item. Detailed sampled-tip/square silhouettes are not required by M6A-066; the canonical nominal circular diameter is the common brush-size feedback boundary.
''',
)
