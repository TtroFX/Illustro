import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  applySelectionMorphologyV1,
  invertSelectionV1,
  type SelectionMorphologyOperationV1,
} from './selection-modifier-engine.js';
import { prepareSelectionCopyV1, selectionCopyEligibilityV1 } from './selection-copy-engine.js';
import type { SelectionTransferPayloadV1 } from './selection-cut-engine.js';
import type {
  RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
} from './selection-coverage-controller.js';
import type {
  SelectionContourBoundsV1,
  SelectionContourPresenterHandleV1,
} from './selection-contour-presenter.js';

export type M8SelectionLauncherCommandV1 =
  | 'transform'
  | 'cut'
  | 'copy'
  | 'clear'
  | 'invert'
  | 'feather'
  | 'expand'
  | 'shrink'
  | 'fill';

export const M8_SELECTION_LAUNCHER_MARGIN_V1 = 12;
export const M8_SELECTION_MORPHOLOGY_STEP_PX_V1 = 1;

export interface M8SelectionLauncherHandleV1 {
  readonly element: HTMLElement;
  clipboard(): SelectionTransferPayloadV1 | null;
  refresh(): void;
  dispose(): void;
}

interface LauncherSizeV1 {
  readonly width: number;
  readonly height: number;
}

export interface M8SelectionLauncherPositionV1 {
  readonly left: number;
  readonly top: number;
  readonly placement: 'above' | 'below';
}

function effectiveDefaultCoverageV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

export function hasNonEmptySelectionV1(coverage: RasterSelectionCoverageV1 | null): boolean {
  if (coverage === null) return false;
  return effectiveDefaultCoverageV1(coverage) === 1 || coverage.tiles.length > 0;
}

export function selectionSignatureV1(coverage: RasterSelectionCoverageV1): string {
  return [
    coverage.sourceRevision,
    coverage.defaultCoverage,
    coverage.inverted ? 1 : 0,
    ...coverage.tiles.map((tile) => `${tile.x}:${tile.y}:${tile.payloadRef}`),
  ].join('|');
}

export function placeSelectionLauncherV1(
  bounds: SelectionContourBoundsV1,
  workspace: LauncherSizeV1,
  launcher: LauncherSizeV1,
  margin = M8_SELECTION_LAUNCHER_MARGIN_V1,
): M8SelectionLauncherPositionV1 {
  const width = Math.min(launcher.width, Math.max(0, workspace.width - margin * 2));
  const height = launcher.height;
  const center = (bounds.minX + bounds.maxX) / 2;
  const left = Math.max(
    margin,
    Math.min(Math.max(margin, workspace.width - width - margin), center - width / 2),
  );
  const above = bounds.minY - height - margin;
  const below = bounds.maxY + margin;
  if (above >= margin) {
    return Object.freeze({ left, top: above, placement: 'above' as const });
  }
  return Object.freeze({
    left,
    top: Math.max(margin, Math.min(workspace.height - height - margin, below)),
    placement: 'below' as const,
  });
}

function createButtonV1(
  command: M8SelectionLauncherCommandV1,
  label: string,
  glyph: string,
  group: 'mask' | 'content',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.m8eCommand = command;
  button.dataset.commandGroup = group;
  button.dataset.productionState = 'unavailable';
  button.disabled = true;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
  return button;
}

export function installM8SelectionLauncherV1(input: {
  readonly root: HTMLElement;
  readonly context: M8SelectionContextLayerHandleV1;
  readonly contourPresenter: SelectionContourPresenterHandleV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly selectionCoverage: SelectionCoverageControllerV1;
}): M8SelectionLauncherHandleV1 {
  const { stage, overlay } = input.context;
  const launcher = document.createElement('div');
  launcher.className = 'm8e-selection-launcher';
  launcher.hidden = true;
  launcher.setAttribute('role', 'toolbar');
  launcher.setAttribute('aria-label', '選択範囲の操作');

  const contentGroup = document.createElement('div');
  contentGroup.className = 'm8e-selection-command-group';
  contentGroup.dataset.commandGroup = 'content';
  contentGroup.setAttribute('role', 'group');
  contentGroup.setAttribute('aria-label', '選択内容の操作');
  contentGroup.append(
    createButtonV1('transform', '選択内容を変形', '↗', 'content'),
    createButtonV1('cut', '選択内容を切り取り', '✂', 'content'),
    createButtonV1('copy', '選択内容をコピー', '⧉', 'content'),
    createButtonV1('fill', '選択範囲内を塗りつぶす', '▣', 'content'),
  );

  const maskGroup = document.createElement('div');
  maskGroup.className = 'm8e-selection-command-group';
  maskGroup.dataset.commandGroup = 'mask';
  maskGroup.setAttribute('role', 'group');
  maskGroup.setAttribute('aria-label', '選択範囲そのものの操作');
  maskGroup.append(
    createButtonV1('clear', '選択解除', '×', 'mask'),
    createButtonV1('invert', '選択範囲を反転', '◐', 'mask'),
  );

  const more = document.createElement('details');
  more.className = 'm8e-selection-more';
  const moreSummary = document.createElement('summary');
  moreSummary.setAttribute('aria-label', '選択範囲を調整');
  moreSummary.title = '選択範囲を調整';
  moreSummary.textContent = '•••';
  const morePanel = document.createElement('div');
  morePanel.className = 'm8e-selection-more-panel';
  morePanel.append(
    createButtonV1('feather', `境界をぼかす ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '◌', 'mask'),
    createButtonV1('expand', `選択範囲を拡張 ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '⊕', 'mask'),
    createButtonV1('shrink', `選択範囲を縮小 ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '⊖', 'mask'),
  );
  more.append(moreSummary, morePanel);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'm8e-selection-dismiss';
  dismiss.dataset.m8eDismiss = 'true';
  dismiss.setAttribute('aria-label', 'Selection Launcherを閉じる');
  dismiss.title = '閉じる';
  dismiss.textContent = '×';

  launcher.append(contentGroup, maskGroup, more, dismiss);
  overlay.append(launcher);

  let clipboard: SelectionTransferPayloadV1 | null = null;
  let dismissedSignature: string | null = null;
  let commandBusy = false;

  const coverageSnapshot = (): RasterSelectionCoverageV1 | null =>
    input.selectionCoverage.snapshot().coverage;

  const setAvailability = (
    command: M8SelectionLauncherCommandV1,
    available: boolean,
    state: 'available' | 'pending-dependency' = 'available',
  ): void => {
    const button = launcher.querySelector<HTMLButtonElement>(`[data-m8e-command="${command}"]`);
    if (!button) return;
    button.disabled = !available;
    button.dataset.productionState = available ? 'available' : state;
  };

  const refreshAvailability = (): void => {
    const coverage = coverageSnapshot();
    const hasSelection = hasNonEmptySelectionV1(coverage);
    for (const command of ['clear', 'invert', 'feather', 'expand', 'shrink'] as const) {
      setAvailability(command, hasSelection);
    }

    const snapshot = input.paintSession.projectSnapshot();
    const activeLayerId = input.paintSession.snapshot().activeLayerId;
    const copyEligibility =
      snapshot !== null && activeLayerId !== null
        ? selectionCopyEligibilityV1(snapshot, activeLayerId, coverage)
        : null;
    setAvailability('copy', copyEligibility?.eligible === true);

    // Selected-content adapters are intentionally unavailable until their existing M7
    // production commit paths are connected here. A visible button never fakes success.
    setAvailability('transform', false, 'pending-dependency');
    setAvailability('cut', false, 'pending-dependency');
    setAvailability('fill', false, 'pending-dependency');
  };

  const reposition = (): void => {
    const coverage = coverageSnapshot();
    const contour = input.contourPresenter.snapshot();
    const drawing = input.root.dataset.illustroPaintStroke;
    const signature = coverage ? selectionSignatureV1(coverage) : null;
    const visible =
      coverage !== null &&
      hasNonEmptySelectionV1(coverage) &&
      contour.stageBounds !== null &&
      contour.pending === false &&
      drawing !== 'active' &&
      drawing !== 'pending-commit' &&
      signature !== dismissedSignature;
    launcher.hidden = !visible;
    if (!visible || !contour.stageBounds) return;

    const stageRect = stage.getBoundingClientRect();
    const measured = launcher.getBoundingClientRect();
    const position = placeSelectionLauncherV1(
      contour.stageBounds,
      { width: stageRect.width, height: stageRect.height },
      { width: Math.max(measured.width, 292), height: Math.max(measured.height, 44) },
    );
    launcher.style.left = `${position.left}px`;
    launcher.style.top = `${position.top}px`;
    launcher.dataset.placement = position.placement;
    refreshAvailability();
  };

  const runMorphology = async (operation: SelectionMorphologyOperationV1): Promise<void> => {
    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return;
    await applySelectionMorphologyV1(
      input.selectionCoverage,
      operation,
      M8_SELECTION_MORPHOLOGY_STEP_PX_V1,
      {
        documentWidth: documentValue.canvas.width,
        documentHeight: documentValue.canvas.height,
        revision: documentValue.revision,
        storage: input.paintPersistence,
      },
    );
  };

  const runCommand = async (command: M8SelectionLauncherCommandV1): Promise<void> => {
    if (commandBusy) return;
    const coverage = coverageSnapshot();
    const documentValue = input.paintSession.currentDocument();
    if (!coverage || !documentValue) return;
    commandBusy = true;
    launcher.dataset.busy = 'true';
    try {
      if (command === 'clear') {
        input.selectionCoverage.clear();
        input.context.announce('選択を解除しました');
      } else if (command === 'invert') {
        invertSelectionV1(input.selectionCoverage, documentValue.revision);
        input.context.announce('選択範囲を反転しました');
      } else if (command === 'copy') {
        const snapshot = input.paintSession.projectSnapshot();
        const layerId = input.paintSession.snapshot().activeLayerId;
        if (!snapshot || !layerId) throw new Error('コピー対象のレイヤーがありません');
        clipboard = await prepareSelectionCopyV1(
          snapshot,
          layerId,
          coverage,
          input.paintPersistence,
        );
        input.root.dataset.illustroSelectionClipboard = 'ready';
        input.context.announce('選択内容をコピーしました');
      } else if (command === 'feather' || command === 'expand' || command === 'shrink') {
        await runMorphology(command === 'shrink' ? 'contract' : command);
        more.removeAttribute('open');
        input.context.announce('選択範囲を調整しました');
      }
    } catch (error) {
      input.context.announce(error instanceof Error ? error.message : '選択操作に失敗しました');
    } finally {
      commandBusy = false;
      launcher.dataset.busy = 'false';
      reposition();
    }
  };

  const onLauncherClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m8e-command], [data-m8e-dismiss]')
        : null;
    if (!button) return;
    if (button.dataset.m8eDismiss === 'true') {
      const coverage = coverageSnapshot();
      dismissedSignature = coverage ? selectionSignatureV1(coverage) : null;
      launcher.hidden = true;
      more.removeAttribute('open');
      input.context.announce('操作パネルを閉じました。選択範囲は維持されています');
      return;
    }
    const command = button.dataset.m8eCommand as M8SelectionLauncherCommandV1 | undefined;
    if (command && !button.disabled) void runCommand(command);
  };

  launcher.addEventListener('click', onLauncherClick);
  const unsubscribeCoverage = input.selectionCoverage.subscribe((snapshot) => {
    if (snapshot.coverage === null) dismissedSignature = null;
    else if (selectionSignatureV1(snapshot.coverage) !== dismissedSignature)
      dismissedSignature = null;
    reposition();
  });
  const unsubscribeContour = input.contourPresenter.subscribe(() => reposition());
  const rootObserver = new MutationObserver(() => reposition());
  rootObserver.observe(input.root, {
    attributes: true,
    attributeFilter: [
      'data-illustro-paint-stroke',
      'data-illustro-document-id',
      'data-illustro-active-layer-id',
    ],
  });
  const onResize = (): void => reposition();
  globalThis.addEventListener('resize', onResize);

  reposition();

  return Object.freeze({
    element: launcher,
    clipboard: () => clipboard,
    refresh: reposition,
    dispose(): void {
      launcher.removeEventListener('click', onLauncherClick);
      unsubscribeCoverage();
      unsubscribeContour();
      rootObserver.disconnect();
      globalThis.removeEventListener('resize', onResize);
      launcher.remove();
    },
  });
}
