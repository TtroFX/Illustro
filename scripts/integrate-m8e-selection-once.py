from pathlib import Path

path = Path('src/app/main.ts')
text = path.read_text()
old_import = "import { SelectionCoverageControllerV1 } from './selection-coverage-controller.js';\nimport { installM8SelectionLauncherV1 } from './m8-selection-launcher.js';"
new_import = "import { SelectionCoverageControllerV1 } from './selection-coverage-controller.js';\nimport { installM8SelectionContextLayerV1 } from './m8-selection-context-layer.js';\nimport { installM8SelectionGestureControllerV1 } from './m8-selection-gesture-controller.js';\nimport { installSelectionContourPresenterV1 } from './selection-contour-presenter.js';\nimport { installM8SelectionLauncherV1 } from './m8-selection-launcher.js';"
if old_import not in text:
    if new_import not in text:
        raise SystemExit('M8E import anchor missing')
else:
    text = text.replace(old_import, new_import, 1)

old_install = """const selectionLauncher = installM8SelectionLauncherV1({
  root,
  paintSession,
  paintPersistence,
  selectionCoverage,
  viewport,
});
void selectionLauncher;"""
new_install = """const selectionContext = installM8SelectionContextLayerV1();
const selectionContour = installSelectionContourPresenterV1({
  context: selectionContext,
  paintSession,
  paintPersistence,
  selectionCoverage,
  viewport,
});
const selectionGesture = installM8SelectionGestureControllerV1({
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
void selectionLauncher;"""
if old_install not in text:
    if new_install not in text:
        raise SystemExit('M8E installation anchor missing')
else:
    text = text.replace(old_install, new_install, 1)
path.write_text(text)

gesture_path = Path('src/app/m8-selection-gesture-controller.ts')
gesture = gesture_path.read_text()
old_loop = """for (const button of modePanel.querySelectorAll<HTMLButtonElement>(
      '[data-m8e-selection-mode]',
    )) {"""
new_loop = """for (const button of Array.from(
      modePanel.querySelectorAll<HTMLButtonElement>('[data-m8e-selection-mode]'),
    )) {"""
if old_loop in gesture:
    gesture = gesture.replace(old_loop, new_loop, 1)
elif new_loop not in gesture:
    raise SystemExit('M8E selection mode loop anchor missing')
gesture_path.write_text(gesture)
