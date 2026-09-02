from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected one anchor in {path}, found {count}: {before[:140]!r}")
    p.write_text(text.replace(before, after, 1))


Path("src/app/layer-role-flags.ts").write_text(r'''import type { LayerId, Revision } from '../domain/identity.js';
import type { LayerBaseV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export type ArtworkLayerRoleFlagV1 = 'reference' | 'draft';

function updateLayerRoleFlagSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  flag: ArtworkLayerRoleFlagV1,
  enabled: boolean,
  revision: Revision,
  now: Date,
): PaintProjectSnapshotV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`layer role target is missing: ${layerId}`);
  if (layer.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary uses dedicated boundary semantics, not artwork role flags');
  }
  if (layer.locks.all) throw new Error('layer role update is blocked by the layer lock');
  if (layer.roleFlags[flag] === enabled) throw new Error('layer role update has no changes');
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    roleFlags: Object.freeze({ ...layer.roleFlags, [flag]: enabled }),
  }) as LayerBaseV1;
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({ ...snapshot.document.layerTree.layers, [layerId]: nextLayer }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export function setReferenceLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return updateLayerRoleFlagSnapshotV1(snapshot, layerId, 'reference', enabled, revision, now);
}

export function setDraftLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return updateLayerRoleFlagSnapshotV1(snapshot, layerId, 'draft', enabled, revision, now);
}
''')

replace_once(
    "src/app/layer-workflow-controller.ts",
    "import { applyLayerCleanupSnapshotV1, layerCleanupCandidatesV1 } from './layer-cleanup.js';",
    "import { applyLayerCleanupSnapshotV1, layerCleanupCandidatesV1 } from './layer-cleanup.js';\nimport { setDraftLayerSnapshotV1, setReferenceLayerSnapshotV1 } from './layer-role-flags.js';",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const alphaLockButton = required<HTMLButtonElement>('#layer-alpha-lock');\n  const opacityInput",
    "  const alphaLockButton = required<HTMLButtonElement>('#layer-alpha-lock');\n  const referenceButton = required<HTMLButtonElement>('#layer-reference');\n  const draftButton = required<HTMLButtonElement>('#layer-draft');\n  const opacityInput",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    alphaLockButton.disabled = disabled;\n    opacityInput.disabled = disabled;",
    "    alphaLockButton.disabled = disabled;\n    referenceButton.disabled = disabled || active?.layer.type === 'lineartBoundary' || active?.layer.locks.all;\n    draftButton.disabled = disabled || active?.layer.type === 'lineartBoundary' || active?.layer.locks.all;\n    opacityInput.disabled = disabled;",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "      alphaLockButton.dataset.active = active.layer.locks.alpha ? 'true' : 'false';\n    } else {",
    "      alphaLockButton.dataset.active = active.layer.locks.alpha ? 'true' : 'false';\n      referenceButton.setAttribute('aria-pressed', active.layer.roleFlags.reference ? 'true' : 'false');\n      draftButton.setAttribute('aria-pressed', active.layer.roleFlags.draft ? 'true' : 'false');\n      referenceButton.dataset.active = active.layer.roleFlags.reference ? 'true' : 'false';\n      draftButton.dataset.active = active.layer.roleFlags.draft ? 'true' : 'false';\n    } else {",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "      alphaLockButton.dataset.active = 'false';\n    }",
    "      alphaLockButton.dataset.active = 'false';\n      referenceButton.setAttribute('aria-pressed', 'false');\n      draftButton.setAttribute('aria-pressed', 'false');\n      referenceButton.dataset.active = 'false';\n      draftButton.dataset.active = 'false';\n    }",
)

controller_path = Path("src/app/layer-workflow-controller.ts")
controller = controller_path.read_text()
anchor = "\n\n  const onOpacity = (): void => {"
if controller.count(anchor) != 1:
    raise SystemExit("expected one onOpacity anchor")
handlers = r'''

  const onReferenceToggle = (): void => {
    const active = currentActive();
    if (active === null) return;
    const enabled = !active.layer.roleFlags.reference;
    commitMutation(
      enabled ? 'layer.reference.designate' : 'layer.reference.release',
      (before, revision) => setReferenceLayerSnapshotV1(before, active.id, enabled, revision),
      () => active.id,
    );
  };

  const onDraftToggle = (): void => {
    const active = currentActive();
    if (active === null) return;
    const enabled = !active.layer.roleFlags.draft;
    commitMutation(
      enabled ? 'layer.draft.enable' : 'layer.draft.disable',
      (before, revision) => setDraftLayerSnapshotV1(before, active.id, enabled, revision),
      () => active.id,
    );
  };
'''
controller_path.write_text(controller.replace(anchor, handlers + anchor, 1))

replace_once(
    "src/app/layer-workflow-controller.ts",
    "  alphaLockButton.addEventListener('click', onAlphaLock);\n  moveUpButton.addEventListener",
    "  alphaLockButton.addEventListener('click', onAlphaLock);\n  referenceButton.addEventListener('click', onReferenceToggle);\n  draftButton.addEventListener('click', onDraftToggle);\n  moveUpButton.addEventListener",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "      alphaLockButton.removeEventListener('click', onAlphaLock);\n      moveUpButton.removeEventListener",
    "      alphaLockButton.removeEventListener('click', onAlphaLock);\n      referenceButton.removeEventListener('click', onReferenceToggle);\n      draftButton.removeEventListener('click', onDraftToggle);\n      moveUpButton.removeEventListener",
)
replace_once(
    "src/index.html",
    '<button id="layer-alpha-lock" type="button" aria-label="透明ピクセルをロック" title="Alpha Lock" aria-pressed="false">α</button>',
    '<button id="layer-alpha-lock" type="button" aria-label="透明ピクセルをロック" title="Alpha Lock" aria-pressed="false">α</button>\n              <button id="layer-reference" type="button" aria-label="Reference Layer指定を切り替え" title="Reference Layer" aria-pressed="false">R</button>\n              <button id="layer-draft" type="button" aria-label="Draft Layer属性を切り替え" title="Draft / Sketch Layer" aria-pressed="false">D</button>',
)
