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
    'src/app/brush-hover-outline-controller.ts',
    """export interface BrushHoverOutlineControllerV1 {
""",
    """export interface BrushHoverDisplaySettingsSnapshotV1 {
  readonly schema: 'illustro.brush-hover-display-settings/1';
  readonly crosshairEnabled: boolean;
}

export class BrushHoverDisplaySettingsV1 {
  #crosshairEnabled = false;

  snapshot(): BrushHoverDisplaySettingsSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.brush-hover-display-settings/1' as const,
      crosshairEnabled: this.#crosshairEnabled,
    });
  }

  setCrosshairEnabled(enabled: boolean): BrushHoverDisplaySettingsSnapshotV1 {
    this.#crosshairEnabled = enabled;
    return this.snapshot();
  }

  toggleCrosshair(): BrushHoverDisplaySettingsSnapshotV1 {
    this.#crosshairEnabled = !this.#crosshairEnabled;
    return this.snapshot();
  }
}

export interface BrushHoverOutlineControllerV1 {
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """  updateHover(hover: PointerHoverSnapshotV1): void;
  refresh(): void;
  dispose(): void;
""",
    """  updateHover(hover: PointerHoverSnapshotV1): void;
  refresh(): void;
  crosshairEnabled(): boolean;
  setCrosshairEnabled(enabled: boolean): void;
  dispose(): void;
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """  const outline = input.root.querySelector<HTMLElement>('#brush-hover-outline');
  if (stage === null || outline === null) {
    throw new Error('brush hover outline requires canvas stage and overlay elements');
  }

  let currentHover: PointerHoverSnapshotV1 | null = null;
""",
    """  const outline = input.root.querySelector<HTMLElement>('#brush-hover-outline');
  const crosshairButton = input.root.querySelector<HTMLButtonElement>('#view-brush-hover-crosshair');
  if (stage === null || outline === null || crosshairButton === null) {
    throw new Error('brush hover outline requires canvas stage, overlay, and display controls');
  }

  const settings = new BrushHoverDisplaySettingsV1();
  let currentHover: PointerHoverSnapshotV1 | null = null;
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """  const hide = (): void => {
    outline.hidden = true;
    input.root.dataset.illustroBrushHoverOutline = 'hidden';
    input.root.dataset.illustroBrushHoverDiameterCssPx = '';
  };

  const refresh = (): void => {
""",
    """  const hide = (): void => {
    outline.hidden = true;
    input.root.dataset.illustroBrushHoverOutline = 'hidden';
    input.root.dataset.illustroBrushHoverDiameterCssPx = '';
  };

  const publishCrosshair = (): void => {
    const enabled = settings.snapshot().crosshairEnabled;
    outline.dataset.crosshair = String(enabled);
    crosshairButton.setAttribute('aria-pressed', String(enabled));
    crosshairButton.dataset.active = String(enabled);
    input.root.dataset.illustroBrushHoverCrosshair = enabled ? 'enabled' : 'disabled';
  };

  const refresh = (): void => {
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """  const onPointerLeave = (): void => {
    currentHover = null;
    hide();
  };
  input.surface.addEventListener('pointerleave', onPointerLeave);
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  hide();

  return Object.freeze({
""",
    """  const onPointerLeave = (): void => {
    currentHover = null;
    hide();
  };
  const onCrosshairToggle = (): void => {
    settings.toggleCrosshair();
    publishCrosshair();
    crosshairButton.closest('details')?.removeAttribute('open');
  };
  input.surface.addEventListener('pointerleave', onPointerLeave);
  crosshairButton.addEventListener('click', onCrosshairToggle);
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  publishCrosshair();
  hide();

  return Object.freeze({
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """    refresh,
    dispose(): void {
""",
    """    refresh,
    crosshairEnabled(): boolean {
      return settings.snapshot().crosshairEnabled;
    },
    setCrosshairEnabled(enabled: boolean): void {
      settings.setCrosshairEnabled(enabled);
      publishCrosshair();
    },
    dispose(): void {
""",
)
replace_once(
    'src/app/brush-hover-outline-controller.ts',
    """      input.surface.removeEventListener('pointerleave', onPointerLeave);
      unsubscribeViewport();
""",
    """      input.surface.removeEventListener('pointerleave', onPointerLeave);
      crosshairButton.removeEventListener('click', onCrosshairToggle);
      unsubscribeViewport();
""",
)

replace_once(
    'src/index.html',
    """              <button id="view-grid-settings" type="button">グリッド設定…</button>
              <button id="view-workspace" type="button">全画面ワークスペース</button>
""",
    """              <button id="view-grid-settings" type="button">グリッド設定…</button>
              <button id="view-brush-hover-crosshair" type="button" aria-pressed="false">ブラシ中心十字</button>
              <button id="view-workspace" type="button">全画面ワークスペース</button>
""",
)

replace_once(
    'public/app-shell.css',
    """.shell-brush-hover-outline[hidden] {
  display: none;
}

.shell-canvas[data-pixel-preview='true'] {
""",
    """.shell-brush-hover-outline[hidden] {
  display: none;
}

.shell-brush-hover-outline[data-crosshair='true']::before,
.shell-brush-hover-outline[data-crosshair='true']::after {
  position: absolute;
  top: 50%;
  left: 50%;
  content: '';
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 0 0 1px rgb(28 38 58 / 82%);
  transform: translate(-50%, -50%);
}

.shell-brush-hover-outline[data-crosshair='true']::before {
  width: 9px;
  height: 1px;
}

.shell-brush-hover-outline[data-crosshair='true']::after {
  width: 1px;
  height: 9px;
}

.shell-canvas[data-pixel-preview='true'] {
""",
)

replace_once(
    'tests/unit/brush-hover-outline.test.ts',
    """import { resolveBrushHoverOutlinePresentationV1 } from '../../src/app/brush-hover-outline-controller.js';
""",
    """import {
  BrushHoverDisplaySettingsV1,
  resolveBrushHoverOutlinePresentationV1,
} from '../../src/app/brush-hover-outline-controller.js';
""",
)
replace_once(
    'tests/unit/brush-hover-outline.test.ts',
    """describe('M6A hover brush outline presentation', () => {
""",
    """describe('M6A hover brush outline presentation', () => {
  it('keeps hover crosshair optional and disabled by default', () => {
    const settings = new BrushHoverDisplaySettingsV1();
    expect(settings.snapshot().crosshairEnabled).toBe(false);
    expect(settings.toggleCrosshair().crosshairEnabled).toBe(true);
    expect(settings.setCrosshairEnabled(false).crosshairEnabled).toBe(false);
  });

""",
)

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-067 progress is not complete',
    r'''
requireText(progress, 'M6A-067 hover crosshair option:完了', 'M6A-067 progress is not complete');
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  'class BrushHoverDisplaySettingsV1',
  'hover display settings state missing',
);
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  "outline.dataset.crosshair = String(enabled)",
  'crosshair setting is not connected to hover overlay',
);
requireText(
  read('src/index.html'),
  'id="view-brush-hover-crosshair"',
  'reachable hover crosshair display control missing',
);
requireText(
  read('public/app-shell.css'),
  ".shell-brush-hover-outline[data-crosshair='true']::before",
  'hover crosshair presentation styling missing',
);
requireText(
  read('tests/unit/brush-hover-outline.test.ts'),
  'keeps hover crosshair optional and disabled by default',
  'hover crosshair regression coverage missing',
);
''',
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-067 hover crosshair option:未完了
""",
    """M6A-067 hover crosshair option:完了
再開メモ: M6A-067はM6A-066のscreen-space hover overlayへ任意中心十字を追加した。これはBrush Presetの画材属性ではなく表示設定としてBrushHoverDisplaySettingsV1が保持し、既定OFF。表示メニューの「ブラシ中心十字」buttonで切替え、outlineのdata-crosshairだけを更新するためhover位置/径計算・Renderer・stroke/history/persistenceには影響しない。十字はCSS pseudo-elementsでscreen-space固定9px、白線+暗縁の高コントラスト表示とし、outline hidden時は同時に消える。次はM6A-068 global/default pressure response controlsから再開する。
""",
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A hover crosshair option boundary — 2026-09-04',
    r'''
## M6A hover crosshair option boundary — 2026-09-04

**AUTHORITATIVE for M6A-067.** The brush-hover center crosshair is an optional presentation setting layered onto the M6A-066 screen-space outline. It defaults OFF and is a global display preference for the current workspace, not a Brush Preset property and not stroke data. The View menu exposes the reachable toggle. Toggling it changes only hover-overlay presentation and must not alter brush geometry, rasterization, input arbitration, History, persistence/recovery, or export.

When enabled, the crosshair is centered on the existing hover outline and uses a small screen-space fixed-size mark so zoom does not make the precision cue unusably thick or large. It inherits the M6A-066 visibility boundary: no pen/mouse no-contact hover means no crosshair, and touch/contact/pointerleave/outside-document states remain hidden. The outline remains the nominal brush-size feedback; the crosshair is only a center-location aid.
''',
)
