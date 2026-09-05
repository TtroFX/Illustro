import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source pattern not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source pattern is ambiguous`);
  }
  writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
}

function appendOnce(path, marker, addition) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(marker)) return;
  writeFileSync(path, `${source.trimEnd()}\n\n${addition.trim()}\n`);
}

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';\n`,
  `import type { RgbUnitColorV1 } from '../domain/color.js';\nimport type { DocumentV1 } from '../domain/document.js';\nimport type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';\n`,
  'launcher domain imports',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';\n`,
  `import type { PaintHistoryControllerV1 } from './paint-history-controller.js';\nimport type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';\n`,
  'launcher history import',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `import type { SelectionTransferPayloadV1 } from './selection-cut-engine.js';\n`,
  `import {\n  applyPreparedSelectionCutV1,\n  prepareSelectionCutV1,\n  selectionCutEligibilityV1,\n  type SelectionTransferPayloadV1,\n} from './selection-cut-engine.js';\nimport {\n  applyPreparedSelectionScopedFillV1,\n  prepareSelectionScopedFillV1,\n  selectionScopedFillEligibilityV1,\n} from './selection-fill-engine.js';\n`,
  'launcher cut fill imports',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `  readonly transformController: M8SelectionTransformControllerHandleV1;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly paintPersistence: PaintPersistenceControllerV1;\n  readonly selectionCoverage: SelectionCoverageControllerV1;\n`,
  `  readonly transformController: M8SelectionTransformControllerHandleV1;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly paintHistory: PaintHistoryControllerV1;\n  readonly paintPersistence: PaintPersistenceControllerV1;\n  readonly selectionCoverage: SelectionCoverageControllerV1;\n  readonly getFillColor: () => RgbUnitColorV1;\n  readonly schedule: (operation: () => Promise<unknown>) => void;\n  readonly onHistoryChanged: () => void;\n  readonly onDocumentChanged: (documentValue: DocumentV1) => void;\n`,
  'launcher production ports',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `    setAvailability('copy', copyEligibility?.eligible === true);\n    setAvailability('transform', input.transformController.available());\n\n    // Cut/Fill remain intentionally unavailable until their M7 production commit\n    // paths are connected here. A visible button never fakes success.\n    setAvailability('cut', false, 'pending-dependency');\n    setAvailability('fill', false, 'pending-dependency');\n`,
  `    const cutEligibility =\n      snapshot !== null && activeLayerId !== null\n        ? selectionCutEligibilityV1(snapshot, activeLayerId, coverage)\n        : null;\n    const fillEligibility =\n      snapshot !== null && activeLayerId !== null\n        ? selectionScopedFillEligibilityV1(snapshot, activeLayerId, coverage)\n        : null;\n    setAvailability('copy', copyEligibility?.eligible === true);\n    setAvailability('transform', input.transformController.available());\n    setAvailability('cut', cutEligibility?.eligible === true);\n    setAvailability('fill', fillEligibility?.eligible === true);\n`,
  'launcher cut fill availability',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `  const runCommand = async (command: M8SelectionLauncherCommandV1): Promise<void> => {\n`,
  `  const commitPreparedSnapshot = async (\n    commandId: string,\n    layerId: NonNullable<ReturnType<PaintSessionControllerV1['activeLayerId']>>,\n    transform: Parameters<PaintHistoryControllerV1['commitSnapshotTransform']>[1],\n  ): Promise<void> =>\n    new Promise<void>((resolve, reject) => {\n      input.schedule(async () => {\n        try {\n          const transaction = await input.paintHistory.commitSnapshotTransform(commandId, transform);\n          input.paintSession.setActiveLayer(layerId);\n          await input.paintPersistence.markDirty(transaction.transactionId);\n          input.root.dataset.illustroSelectionTransaction = transaction.transactionId;\n          const current = input.paintSession.currentDocument();\n          if (current !== null) input.onDocumentChanged(current);\n          input.onHistoryChanged();\n          resolve();\n        } catch (error) {\n          reject(error);\n        }\n      });\n    });\n\n  const runCommand = async (command: M8SelectionLauncherCommandV1): Promise<void> => {\n`,
  'launcher commit adapter',
);

replaceOnce(
  'src/app/m8-selection-launcher.ts',
  `      } else if (command === 'copy') {\n        const snapshot = input.paintSession.projectSnapshot();\n        const layerId = input.paintSession.snapshot().activeLayerId;\n        if (!snapshot || !layerId) throw new Error('コピー対象のレイヤーがありません');\n        clipboard = await prepareSelectionCopyV1(\n          snapshot,\n          layerId,\n          coverage,\n          input.paintPersistence,\n        );\n        input.root.dataset.illustroSelectionClipboard = 'ready';\n        input.context.announce('選択内容をコピーしました');\n      } else if (command === 'feather' || command === 'expand' || command === 'shrink') {\n`,
  `      } else if (command === 'copy') {\n        const snapshot = input.paintSession.projectSnapshot();\n        const layerId = input.paintSession.activeLayerId();\n        if (!snapshot || !layerId) throw new Error('コピー対象のレイヤーがありません');\n        clipboard = await prepareSelectionCopyV1(\n          snapshot,\n          layerId,\n          coverage,\n          input.paintPersistence,\n        );\n        input.root.dataset.illustroSelectionClipboard = 'ready';\n        input.context.announce('選択内容をコピーしました');\n      } else if (command === 'cut') {\n        const snapshot = input.paintSession.projectSnapshot();\n        const layerId = input.paintSession.activeLayerId();\n        if (!snapshot || !layerId) throw new Error('切り取り対象のレイヤーがありません');\n        const prepared = await prepareSelectionCutV1(\n          snapshot,\n          layerId,\n          coverage,\n          input.paintPersistence,\n        );\n        await commitPreparedSnapshot('selection.cut', layerId, (before, revision) =>\n          applyPreparedSelectionCutV1(before, prepared, revision),\n        );\n        clipboard = prepared.transfer;\n        input.root.dataset.illustroSelectionClipboard = 'ready';\n        input.context.announce('選択内容を切り取りました');\n      } else if (command === 'fill') {\n        const snapshot = input.paintSession.projectSnapshot();\n        const layerId = input.paintSession.activeLayerId();\n        if (!snapshot || !layerId) throw new Error('塗りつぶし対象のレイヤーがありません');\n        const prepared = await prepareSelectionScopedFillV1(\n          snapshot,\n          layerId,\n          coverage,\n          { color: input.getFillColor(), opacity: 1 },\n          input.paintPersistence,\n        );\n        await commitPreparedSnapshot('selection.fill', layerId, (before, revision) =>\n          applyPreparedSelectionScopedFillV1(before, prepared, revision),\n        );\n        input.context.announce('選択範囲を現在色で塗りつぶしました');\n      } else if (command === 'feather' || command === 'expand' || command === 'shrink') {\n`,
  'launcher cut fill execution',
);

replaceOnce(
  'tests/unit/m8-selection-launcher.test.ts',
  `    expect(source).toContain(\"setAvailability('cut', false, 'pending-dependency')\");\n    expect(source).toContain(\"setAvailability('fill', false, 'pending-dependency')\");\n`,
  `    expect(source).toContain('selectionCutEligibilityV1');\n    expect(source).toContain('selectionScopedFillEligibilityV1');\n    expect(source).toContain(\"commitPreparedSnapshot('selection.cut'\");\n    expect(source).toContain(\"commitPreparedSnapshot('selection.fill'\");\n    expect(source).toContain('prepareSelectionCutV1');\n    expect(source).toContain('prepareSelectionScopedFillV1');\n    expect(source).toContain('paintPersistence.markDirty(transaction.transactionId)');\n`,
  'launcher test production cut fill',
);

replaceOnce(
  'src/app/main.ts',
  `import { installM8SelectionContextLayerV1 } from './m8-selection-context-layer.js';\n`,
  `import { installM8ContextualCanvasControllerV1 } from './m8-contextual-canvas-controller.js';\nimport { installM8SelectionContextLayerV1 } from './m8-selection-context-layer.js';\n`,
  'main contextual import',
);

replaceOnce(
  'src/app/main.ts',
  `const selectionContext = installM8SelectionContextLayerV1();\nconst selectionContour = installSelectionContourPresenterV1({\n`,
  `const selectionContext = installM8SelectionContextLayerV1();\nconst contextualCanvas = installM8ContextualCanvasControllerV1({ root, context: selectionContext });\nconst selectionContour = installSelectionContourPresenterV1({\n`,
  'main contextual install',
);

replaceOnce(
  'src/app/main.ts',
  `  transformController: selectionTransform,\n  paintSession,\n  paintPersistence,\n  selectionCoverage,\n});\n`,
  `  transformController: selectionTransform,\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  selectionCoverage,\n  getFillColor: () => colorWorkflow.snapshot().current,\n  schedule: enqueuePaintRender,\n  onHistoryChanged: publishPaintHistory,\n  onDocumentChanged: publishDocumentState,\n});\n`,
  'main launcher production ports',
);

replaceOnce(
  'src/app/main.ts',
  `void selectionGesture;\nvoid selectionTransform;\nvoid selectionLauncher;\n`,
  `void contextualCanvas;\nvoid selectionGesture;\nvoid selectionTransform;\nvoid selectionLauncher;\n`,
  'main contextual retained handle',
);

replaceOnce(
  'src/app/main.ts',
  `    selectionContour.dispose();\n    selectionContext.dispose();\n`,
  `    selectionContour.dispose();\n    contextualCanvas.dispose();\n    selectionContext.dispose();\n`,
  'main contextual disposal',
);

appendOnce(
  'public/m8-selection-launcher.css',
  '.m8e-context-preview {',
  `
.m8e-context-preview {
  position: absolute;
  z-index: 2;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.m8e-context-preview[hidden] {
  display: none !important;
}

.m8e-context-preview-toolbar {
  position: absolute;
  z-index: 3;
  top: 14px;
  left: 50%;
  display: flex;
  min-height: 46px;
  max-width: calc(100% - 28px);
  align-items: center;
  gap: 12px;
  padding: 5px 7px 5px 12px;
  border: 1px solid rgb(224 225 234 / 96%);
  border-radius: 14px;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 10px 26px rgb(41 45 70 / 14%);
  backdrop-filter: blur(14px);
  pointer-events: auto;
  transform: translateX(-50%);
}

.m8e-context-preview-identity {
  display: grid;
  min-width: 130px;
  color: #343947;
  font: 650 12px/1.2 system-ui, sans-serif;
}

.m8e-context-preview-identity small {
  margin-top: 2px;
  color: #8c919d;
  font: 500 9px/1.2 system-ui, sans-serif;
  white-space: nowrap;
}

.m8e-context-preview-controls {
  display: flex;
  gap: 2px;
  padding-left: 7px;
  border-left: 1px solid #ececf1;
}

.m8e-context-preview-controls button {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: #f8f8fb;
  color: #8c919c;
  font: 700 15px/1 system-ui, sans-serif;
}

.m8e-context-preview-controls button::after {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c5a9b7;
  content: "";
}

.m8e-context-preview-note,
.m8e-lineart-preview-legend {
  position: absolute;
  z-index: 2;
  right: 14px;
  bottom: 14px;
  max-width: min(430px, calc(100% - 28px));
  padding: 7px 9px;
  border: 1px solid rgb(226 227 235 / 94%);
  border-radius: 10px;
  background: rgb(255 255 255 / 94%);
  color: #697080;
  box-shadow: 0 6px 18px rgb(44 48 70 / 10%);
  font: 550 10px/1.35 system-ui, sans-serif;
}

.m8e-ruler-preview-svg,
.m8e-lineart-preview-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.m8e-ruler-guide-line,
.m8e-ruler-guide-extension {
  fill: none;
  stroke: #dfaa24;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.m8e-ruler-guide-extension {
  opacity: .58;
  stroke-dasharray: 6 5;
}

.m8e-ruler-guide-node {
  fill: #fff;
  stroke: #d99a0d;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.m8e-ruler-guide-node[data-node-kind="center"] {
  fill: #fff4c6;
}

.m8e-lineart-edge {
  fill: none;
  stroke-width: 2.2;
  vector-effect: non-scaling-stroke;
}

.m8e-lineart-edge.is-automatic {
  stroke: #6e7fea;
}

.m8e-lineart-edge.is-manual {
  stroke: #d83b91;
  stroke-width: 2.8;
}

.m8e-lineart-edge.is-unresolved {
  stroke: #d59718;
  stroke-dasharray: 2 6;
}

.m8e-lineart-edge.is-rejected {
  stroke: #d35a60;
  stroke-dasharray: 8 5;
  opacity: .78;
}

.m8e-lineart-node {
  vector-effect: non-scaling-stroke;
}

.m8e-lineart-node.is-endpoint {
  fill: #fff;
  stroke: #6978dd;
  stroke-width: 2;
}

.m8e-lineart-node.is-junction {
  fill: #f1ecff;
  stroke: #7456c7;
  stroke-width: 3;
}

.m8e-lineart-node.is-unresolved {
  fill: #fff2bd;
  stroke: #c98d16;
  stroke-width: 2;
}

.m8e-lineart-node.is-rejected line {
  stroke: #cf4b54;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.m8e-lineart-preview-legend {
  display: flex;
  gap: 10px;
  align-items: center;
}

.m8e-lineart-preview-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.m8e-lineart-preview-legend i {
  display: inline-block;
  width: 15px;
  height: 2px;
  background: #6e7fea;
}

.m8e-lineart-preview-legend [data-state="manual"] i {
  height: 3px;
  background: #d83b91;
}

.m8e-lineart-preview-legend [data-state="unresolved"] i {
  height: 0;
  border-top: 2px dotted #d59718;
  background: transparent;
}

.m8e-lineart-preview-legend [data-state="rejected"] i {
  height: 0;
  border-top: 2px dashed #d35a60;
  background: transparent;
}

@media (max-width: 799px), (pointer: coarse) {
  .m8e-context-preview-toolbar {
    top: 8px;
    max-width: calc(100% - 16px);
    gap: 6px;
    padding-left: 8px;
  }

  .m8e-context-preview-identity {
    min-width: 0;
  }

  .m8e-context-preview-controls button {
    width: 40px;
    height: 40px;
  }

  .m8e-context-preview-note,
  .m8e-lineart-preview-legend {
    right: 8px;
    bottom: 8px;
    max-width: calc(100% - 16px);
  }
}
`,
);
