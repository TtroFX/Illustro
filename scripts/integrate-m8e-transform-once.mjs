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

replaceOnce(
  'src/app/main.ts',
  "import { installM8SelectionLauncherV1 } from './m8-selection-launcher.js';\n",
  "import { installM8SelectionLauncherV1 } from './m8-selection-launcher.js';\nimport { installM8SelectionTransformControllerV1 } from './m8-selection-transform-controller.js';\n",
  'main transform import',
);

replaceOnce(
  'src/app/main.ts',
  `const selectionGesture = installM8SelectionGestureControllerV1({
  root,
  context: selectionContext,
  paintSession,
  paintPersistence,
  selectionCoverage,
  viewport,
});
const selectionLauncher = installM8SelectionLauncherV1({
  root,
  context: selectionContext,
  contourPresenter: selectionContour,
  paintSession,
  paintPersistence,
  selectionCoverage,
});
void selectionGesture;
void selectionLauncher;
`,
  `const selectionGesture = installM8SelectionGestureControllerV1({
  root,
  context: selectionContext,
  paintSession,
  paintPersistence,
  selectionCoverage,
  viewport,
});
const selectionTransform = installM8SelectionTransformControllerV1({
  root,
  context: selectionContext,
  contourPresenter: selectionContour,
  paintSession,
  paintHistory,
  paintPersistence,
  selectionCoverage,
  viewport,
  deactivateSelectionTool: () => selectionGesture.setActiveTool(null),
  schedule: enqueuePaintRender,
  onHistoryChanged: publishPaintHistory,
  onDocumentChanged: publishDocumentState,
});
const selectionLauncher = installM8SelectionLauncherV1({
  root,
  context: selectionContext,
  contourPresenter: selectionContour,
  transformController: selectionTransform,
  paintSession,
  paintPersistence,
  selectionCoverage,
});
void selectionGesture;
void selectionTransform;
void selectionLauncher;
`,
  'main selection transform wiring',
);

replaceOnce(
  'src/app/main.ts',
  `    localLibrarySurface?.dispose();
    layerComps.dispose();
`,
  `    localLibrarySurface?.dispose();
    selectionLauncher.dispose();
    selectionTransform.dispose();
    selectionGesture.dispose();
    selectionContour.dispose();
    selectionContext.dispose();
    layerComps.dispose();
`,
  'main selection lifecycle disposal',
);

replaceOnce(
  'tests/unit/m8-selection-launcher.test.ts',
  `    expect(source).toContain("setAvailability('transform', false, 'pending-dependency')");
`,
  `    expect(source).toContain("setAvailability('transform', input.transformController.available())");
    expect(source).toContain('input.transformController.begin()');
`,
  'launcher transform expectation',
);

replaceOnce(
  'tests/unit/m8-selection-transform-controller.test.ts',
  `    expect(source).not.toContain('pointermove') || expect(source).not.toContain('prepareSelectionAffineTransformV1(event');
`,
  `    const moveStart = source.indexOf('const onPointerMove');
    const moveEnd = source.indexOf('const finishDrag', moveStart);
    expect(moveStart).toBeGreaterThanOrEqual(0);
    expect(moveEnd).toBeGreaterThan(moveStart);
    expect(source.slice(moveStart, moveEnd)).not.toContain('prepareSelectionAffineTransformV1');
`,
  'transform preview non-rasterizing expectation',
);
