from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:180]!r}')
    target.write_text(text.replace(old, new, 1))


Path('src/app/layer-folder-pass-through.ts').write_text(r'''import type { LayerId, Revision } from '../domain/identity.js';
import type { FolderLayerV1, LayerBaseV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface FolderPassThroughEligibilityV1 {
  readonly schema: 'illustro.folder-pass-through-eligibility/1';
  readonly eligible: boolean;
  readonly enabled: boolean;
  readonly reason: string | null;
}

export type LayerCompositeStructureStepV1 =
  | Readonly<{ kind: 'layer'; layerId: LayerId }>
  | Readonly<{ kind: 'isolation-begin'; folderId: LayerId }>
  | Readonly<{ kind: 'isolation-end'; folderId: LayerId }>;

function requireLayer(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`layer is missing: ${layerId}`);
  return layer;
}

export function folderPassThroughEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): FolderPassThroughEligibilityV1 {
  const layer = requireLayer(snapshot, layerId);
  if (layer.type !== 'folder') {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: false,
      reason: 'Pass Through is available only for folders',
    });
  }
  const folder = layer as FolderLayerV1;
  if (folder.role !== 'normal') {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: folder.blendMode === 'pass-through',
      reason: 'Lineart Group Pass Through is managed by the Lineart Group contract',
    });
  }
  if (folder.locks.all) {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: folder.blendMode === 'pass-through',
      reason: 'folder is locked',
    });
  }
  return Object.freeze({
    schema: 'illustro.folder-pass-through-eligibility/1' as const,
    eligible: true,
    enabled: folder.blendMode === 'pass-through',
    reason: null,
  });
}

export function setFolderPassThroughSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = folderPassThroughEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'folder Pass Through is unavailable');
  if (eligibility.enabled === enabled) throw new Error('folder Pass Through has no changes');
  const folder = requireLayer(snapshot, layerId) as FolderLayerV1;
  const nextFolder = Object.freeze({
    ...folder,
    revision,
    blendMode: enabled ? ('pass-through' as const) : ('normal' as const),
  });
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({ ...snapshot.document.layerTree.layers, [layerId]: nextFolder }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export function buildLayerCompositeStructureV1(
  snapshot: PaintProjectSnapshotV1,
): readonly LayerCompositeStructureStepV1[] {
  const steps: LayerCompositeStructureStepV1[] = [];
  const visited = new Set<LayerId>();
  const visit = (layerId: LayerId): void => {
    if (visited.has(layerId)) throw new Error('layer tree cycle detected while building composite structure');
    visited.add(layerId);
    const layer = requireLayer(snapshot, layerId);
    if (!layer.visible || layer.type === 'lineartBoundary') {
      visited.delete(layerId);
      return;
    }
    if (layer.type !== 'folder') {
      steps.push(Object.freeze({ kind: 'layer' as const, layerId }));
      visited.delete(layerId);
      return;
    }
    const folder = layer as FolderLayerV1;
    const isolated = folder.blendMode !== 'pass-through';
    if (isolated) steps.push(Object.freeze({ kind: 'isolation-begin' as const, folderId: folder.id }));
    for (const childId of folder.childLayerIds) visit(childId);
    if (isolated) steps.push(Object.freeze({ kind: 'isolation-end' as const, folderId: folder.id }));
    visited.delete(layerId);
  };
  for (const rootId of snapshot.document.layerTree.rootLayerIds) visit(rootId);
  return Object.freeze(steps);
}
''')

Path('tests/unit/layer-folder-pass-through.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  buildLayerCompositeStructureV1,
  folderPassThroughEligibilityV1,
  setFolderPassThroughSnapshotV1,
} from '../../src/app/layer-folder-pass-through.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(passThrough = false): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly folder: ReturnType<typeof createFolderLayer>;
  readonly child: ReturnType<typeof createRasterLayer>;
} {
  const initialFolder = createFolderLayer({ name: 'Folder', blendMode: passThrough ? 'pass-through' : 'normal' });
  const child = createRasterLayer({ name: 'Child', parentId: initialFolder.id });
  const folder = Object.freeze({ ...initialFolder, childLayerIds: Object.freeze([child.id]) });
  const document = createDocumentV1({ width: 300, height: 200 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([folder.id]),
          layers: Object.freeze({ [folder.id]: folder, [child.id]: child }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    folder,
    child,
  };
}

describe('M5B Folder Pass Through', () => {
  it('toggles a normal folder as one canonical snapshot mutation', () => {
    const { snapshot, folder } = fixture();
    expect(folderPassThroughEligibilityV1(snapshot, folder.id)).toMatchObject({
      eligible: true,
      enabled: false,
    });
    const enabled = setFolderPassThroughSnapshotV1(
      snapshot,
      folder.id,
      true,
      parseRevision(1),
      new Date(0),
    );
    expect(enabled.document.layerTree.layers[folder.id]?.blendMode).toBe('pass-through');
    expect(enabled.document.revision).toBe(1);
    expect(enabled.document.modifiedAt).toBe(new Date(0).toISOString());
    expect(() =>
      setFolderPassThroughSnapshotV1(enabled, folder.id, true, parseRevision(2)),
    ).toThrow(/no changes/);
  });

  it('removes the folder isolation boundary from the compositor structure when Pass Through is enabled', () => {
    const isolated = fixture(false);
    expect(buildLayerCompositeStructureV1(isolated.snapshot)).toEqual([
      { kind: 'isolation-begin', folderId: isolated.folder.id },
      { kind: 'layer', layerId: isolated.child.id },
      { kind: 'isolation-end', folderId: isolated.folder.id },
    ]);
    const passThrough = fixture(true);
    expect(buildLayerCompositeStructureV1(passThrough.snapshot)).toEqual([
      { kind: 'layer', layerId: passThrough.child.id },
    ]);
  });

  it('keeps Lineart Group Pass Through owned by its specialized contract', () => {
    const { snapshot, folder } = fixture();
    const lineart = createFolderLayer({ id: folder.id, name: 'Lineart', role: 'lineart-group' });
    const specialized = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({ ...snapshot.document.layerTree.layers, [folder.id]: lineart }),
        }),
      }),
    });
    expect(folderPassThroughEligibilityV1(specialized, folder.id)).toMatchObject({
      eligible: false,
      enabled: true,
    });
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import {\n  applyFolderAffineTransformSnapshotV1,",
    "import {\n  buildLayerCompositeStructureV1,\n  folderPassThroughEligibilityV1,\n  setFolderPassThroughSnapshotV1,\n} from './layer-folder-pass-through.js';\nimport {\n  applyFolderAffineTransformSnapshotV1,",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const groupedTransformButton = required<HTMLButtonElement>('#layer-group-transform');",
    "  const groupedTransformButton = required<HTMLButtonElement>('#layer-group-transform');\n  const folderPassThroughButton = required<HTMLButtonElement>('#layer-folder-pass-through');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    groupedTransformButton.title =\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';\n    deleteButton.disabled",
    "    groupedTransformButton.title =\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';\n    const passThroughEligibility =\n      active === null || projectSnapshot === null\n        ? null\n        : folderPassThroughEligibilityV1(projectSnapshot, active.id);\n    folderPassThroughButton.disabled =\n      passThroughEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    folderPassThroughButton.setAttribute(\n      'aria-pressed',\n      passThroughEligibility?.enabled === true ? 'true' : 'false',\n    );\n    folderPassThroughButton.dataset.active =\n      passThroughEligibility?.enabled === true ? 'true' : 'false';\n    folderPassThroughButton.title = passThroughEligibility?.reason ?? 'フォルダ Pass Through';\n    if (projectSnapshot !== null) {\n      root.dataset.illustroCompositeStructureSteps = String(\n        buildLayerCompositeStructureV1(projectSnapshot).length,\n      );\n    }\n    deleteButton.disabled",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const numericTransformValue = (input: HTMLInputElement, label: string): number => {",
    "  const onFolderPassThrough = (): void => {\n    const current = options.paintSession.projectSnapshot();\n    const layerId = options.paintSession.activeLayerId();\n    if (current === null || layerId === null) return;\n    const eligibility = folderPassThroughEligibilityV1(current, layerId);\n    if (!eligibility.eligible) {\n      publishError(new Error(eligibility.reason ?? 'folder Pass Through is unavailable'));\n      return;\n    }\n    commitMutation(\n      'layer.folder.pass-through',\n      (before, revision) =>\n        setFolderPassThroughSnapshotV1(before, layerId, !eligibility.enabled, revision),\n      () => layerId,\n    );\n  };\n\n  const numericTransformValue = (input: HTMLInputElement, label: string): number => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  groupedTransformButton.addEventListener('click', onGroupedTransform);",
    "  groupedTransformButton.addEventListener('click', onGroupedTransform);\n  folderPassThroughButton.addEventListener('click', onFolderPassThrough);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      groupedTransformButton.removeEventListener('click', onGroupedTransform);",
    "      groupedTransformButton.removeEventListener('click', onGroupedTransform);\n      folderPassThroughButton.removeEventListener('click', onFolderPassThrough);",
)

replace_once(
    'src/index.html',
    '              <button id="layer-group-transform" type="button" aria-label="選択レイヤーを非破壊変形" title="レイヤー変形">⤢</button>',
    '              <button id="layer-group-transform" type="button" aria-label="選択レイヤーを非破壊変形" title="レイヤー変形">⤢</button>\n              <button id="layer-folder-pass-through" type="button" aria-label="フォルダ Pass Through" title="フォルダ Pass Through" aria-pressed="false">⇥</button>',
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', ['id=\"layer-cleanup-empty\"', 'id=\"layer-cleanup-hidden\"']);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', ['id=\"layer-cleanup-empty\"', 'id=\"layer-cleanup-hidden\"']);\nrequireText('src/app/layer-folder-pass-through.ts', [\n  'folderPassThroughEligibilityV1',\n  'setFolderPassThroughSnapshotV1',\n  'buildLayerCompositeStructureV1',\n  \"kind: 'isolation-begin'\",\n  \"blendMode !== 'pass-through'\",\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#layer-folder-pass-through'\",\n  \"'layer.folder.pass-through'\",\n  'folderPassThroughEligibilityV1',\n  'buildLayerCompositeStructureV1',\n]);\nrequireText('src/index.html', ['id=\"layer-folder-pass-through\"']);\nconsole.log('M5B layer system verification passed');",
)

replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-033 Folder Pass Through:未完了', 'M5B-033 Folder Pass Through:完了')
