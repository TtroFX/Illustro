from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one anchor in {path}; found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


Path("src/app/layer-folder-transform.ts").write_text(r'''import { createNodeId, type LayerId, type Revision } from '../domain/identity.js';
import type { FolderLayerV1, TransformNodeV1 } from '../domain/layers.js';
import type { GroupedAffineLayerTransformInputV1 } from './layer-group-transform.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface FolderLayerTransformEligibilityV1 {
  readonly schema: 'illustro.folder-layer-transform-eligibility/1';
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

function result(
  layerId: LayerId,
  eligible: boolean,
  reason: string | null,
): FolderLayerTransformEligibilityV1 {
  return Object.freeze({
    schema: 'illustro.folder-layer-transform-eligibility/1' as const,
    eligible,
    layerId,
    reason,
  });
}

export function folderLayerTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): FolderLayerTransformEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return result(layerId, false, `layer is missing: ${layerId}`);
  if (layer.type !== 'folder') return result(layerId, false, 'folder-level transform requires a folder');
  if (layer.role !== 'normal') {
    return result(
      layerId,
      false,
      'Lineart Group transform requires the synchronized lineart transform path',
    );
  }
  if (layer.locks.all || layer.locks.position) {
    return result(layerId, false, `folder position is locked: ${layer.name}`);
  }
  return result(layerId, true, null);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalize(
  input: GroupedAffineLayerTransformInputV1,
): GroupedAffineLayerTransformInputV1 {
  const normalized = Object.freeze({
    translateX: finite(input.translateX, 'translateX'),
    translateY: finite(input.translateY, 'translateY'),
    scaleX: finite(input.scaleX, 'scaleX'),
    scaleY: finite(input.scaleY, 'scaleY'),
    rotationDeg: finite(input.rotationDeg, 'rotationDeg'),
    pivotX: finite(input.pivotX, 'pivotX'),
    pivotY: finite(input.pivotY, 'pivotY'),
  });
  if (normalized.scaleX <= 0 || normalized.scaleY <= 0) {
    throw new RangeError('folder transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('folder transform has no changes');
  }
  return normalized;
}

function matrix(
  input: GroupedAffineLayerTransformInputV1,
): readonly [number, number, number, number, number, number] {
  const radians = (input.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = cosine * input.scaleX;
  const b = sine * input.scaleX;
  const c = -sine * input.scaleY;
  const d = cosine * input.scaleY;
  const e = input.translateX + input.pivotX - a * input.pivotX - c * input.pivotY;
  const f = input.translateY + input.pivotY - b * input.pivotX - d * input.pivotY;
  return Object.freeze([a, b, c, d, e, f]);
}

export function applyFolderAffineTransformSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  input: GroupedAffineLayerTransformInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = folderLayerTransformEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'folder-level transform is unavailable');
  }
  const normalized = normalize(input);
  const layer = snapshot.document.layerTree.layers[layerId] as FolderLayerV1;
  const node: TransformNodeV1 = Object.freeze({
    id: createNodeId(),
    revision,
    kind: 'affine',
    parameters: Object.freeze({
      schema: 'illustro.folder-affine-transform/1',
      translateX: normalized.translateX,
      translateY: normalized.translateY,
      scaleX: normalized.scaleX,
      scaleY: normalized.scaleY,
      rotationDeg: normalized.rotationDeg,
      pivotX: normalized.pivotX,
      pivotY: normalized.pivotY,
      matrix: matrix(normalized),
    }),
  });
  const transformed: FolderLayerV1 = Object.freeze({
    ...layer,
    revision,
    transformStack: Object.freeze([...layer.transformStack, node]),
    boundsHint: null,
  });
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [layerId]: transformed,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}
''')

replace_once(
    "src/app/layer-workflow-controller.ts",
    "} from './layer-creation.js';\nimport {\n  applyGroupedAffineLayerTransformSnapshotV1,",
    "} from './layer-creation.js';\nimport {\n  applyFolderAffineTransformSnapshotV1,\n  folderLayerTransformEligibilityV1,\n} from './layer-folder-transform.js';\nimport {\n  applyGroupedAffineLayerTransformSnapshotV1,",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    const groupedTransformEligibility =\n      projectSnapshot === null\n        ? null\n        : groupedLayerTransformEligibilityV1(projectSnapshot, groupedTransformLayerIds);\n    groupedTransformButton.disabled =\n      groupedTransformEligibility?.eligible !== true ||\n      options.paintSession.activeStrokeId() !== null;\n    groupedTransformButton.title =\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';",
    "    const groupedTransformEligibility =\n      projectSnapshot === null\n        ? null\n        : groupedLayerTransformEligibilityV1(projectSnapshot, groupedTransformLayerIds);\n    const folderTransformEligibility =\n      active === null || projectSnapshot === null || groupedTransformLayerIds.length !== 1\n        ? null\n        : folderLayerTransformEligibilityV1(projectSnapshot, active.id);\n    const transformEligible =\n      groupedTransformEligibility?.eligible === true || folderTransformEligibility?.eligible === true;\n    groupedTransformButton.disabled =\n      !transformEligible || options.paintSession.activeStrokeId() !== null;\n    groupedTransformButton.title =\n      folderTransformEligibility?.eligible === true\n        ? 'フォルダをまとめて変形'\n        : groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const onGroupedTransform = (): void => {\n    const current = options.paintSession.projectSnapshot();\n    if (current === null) return;\n    const layerIds = options.paintSession\n      .selectedLayerIds()\n      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));\n    const eligibility = groupedLayerTransformEligibilityV1(current, layerIds);\n    if (!eligibility.eligible) {\n      publishError(new Error(eligibility.reason ?? 'grouped transform is unavailable'));\n      return;\n    }",
    "  let layerTransformTarget:\n    | { readonly kind: 'grouped'; readonly layerIds: readonly LayerId[] }\n    | { readonly kind: 'folder'; readonly layerId: LayerId }\n    | null = null;\n\n  const onGroupedTransform = (): void => {\n    const current = options.paintSession.projectSnapshot();\n    if (current === null) return;\n    const layerIds = options.paintSession\n      .selectedLayerIds()\n      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));\n    const groupedEligibility = groupedLayerTransformEligibilityV1(current, layerIds);\n    const activeLayerId = options.paintSession.activeLayerId();\n    const folderEligibility =\n      activeLayerId !== null && layerIds.length === 1\n        ? folderLayerTransformEligibilityV1(current, activeLayerId)\n        : null;\n    if (groupedEligibility.eligible) {\n      layerTransformTarget = Object.freeze({ kind: 'grouped' as const, layerIds });\n    } else if (folderEligibility?.eligible === true && activeLayerId !== null) {\n      layerTransformTarget = Object.freeze({ kind: 'folder' as const, layerId: activeLayerId });\n    } else {\n      publishError(\n        new Error(\n          folderEligibility?.reason ?? groupedEligibility.reason ?? 'layer transform is unavailable',\n        ),\n      );\n      return;\n    }",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const onGroupedTransformCancel = (): void => {\n    groupedTransformDialog.close();\n    clearError();\n  };",
    "  const onGroupedTransformCancel = (): void => {\n    layerTransformTarget = null;\n    groupedTransformDialog.close();\n    clearError();\n  };",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    const layerIds = options.paintSession\n      .selectedLayerIds()\n      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));\n    try {",
    "    const target = layerTransformTarget;\n    if (target === null) {\n      publishError(new Error('layer transform target is unavailable'));\n      return;\n    }\n    try {",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "          const transaction = await options.paintHistory.commitSnapshotTransform(\n            'layer.transform.grouped',\n            (before, revision) =>\n              applyGroupedAffineLayerTransformSnapshotV1(before, layerIds, input, revision),\n          );\n          await options.paintPersistence.markDirty(transaction.transactionId);",
    "          const transaction = await options.paintHistory.commitSnapshotTransform(\n            target.kind === 'folder' ? 'layer.transform.folder' : 'layer.transform.grouped',\n            (before, revision) =>\n              target.kind === 'folder'\n                ? applyFolderAffineTransformSnapshotV1(before, target.layerId, input, revision)\n                : applyGroupedAffineLayerTransformSnapshotV1(\n                    before,\n                    target.layerIds,\n                    input,\n                    revision,\n                  ),\n          );\n          await options.paintPersistence.markDirty(transaction.transactionId);",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "          groupedTransformDialog.close();\n          clearError();",
    "          layerTransformTarget = null;\n          groupedTransformDialog.close();\n          clearError();",
)

replace_once(
    "src/index.html",
    '              <button id="layer-group-transform" type="button" aria-label="選択中の複数レイヤーをまとめて変形" title="複数レイヤー変形">⤢</button>',
    '              <button id="layer-group-transform" type="button" aria-label="選択レイヤーを非破壊変形" title="レイヤー変形">⤢</button>',
)
replace_once(
    "src/index.html",
    '<header><h2 id="layer-group-transform-title">複数レイヤー変形</h2></header>\n        <p class="document-dialog-help">選択中の複数レイヤーへ同じ非破壊Affine変形を適用します。</p>',
    '<header><h2 id="layer-group-transform-title">レイヤー変形</h2></header>\n        <p class="document-dialog-help">複数選択レイヤー、または選択フォルダへ非破壊Affine変形を適用します。</p>',
)

Path("tests/unit/layer-folder-transform.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyFolderAffineTransformSnapshotV1,
  folderLayerTransformEligibilityV1,
} from '../../src/app/layer-folder-transform.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(role: 'normal' | 'lineart-group' = 'normal'): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly folder: ReturnType<typeof createFolderLayer>;
  readonly child: ReturnType<typeof createRasterLayer>;
} {
  const folder = createFolderLayer({ name: 'Folder', role });
  const child = createRasterLayer({ name: 'Child', parentId: folder.id });
  const folderWithChild = Object.freeze({ ...folder, childLayerIds: Object.freeze([child.id]) });
  const document = createDocumentV1({ width: 320, height: 240 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([folder.id]),
          layers: Object.freeze({ [folder.id]: folderWithChild, [child.id]: child }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    folder: folderWithChild,
    child,
  };
}

describe('M5B folder-level transform', () => {
  it('appends a non-destructive affine node to the folder while leaving child content canonical', () => {
    const { snapshot, folder, child } = fixture();
    const transformed = applyFolderAffineTransformSnapshotV1(
      snapshot,
      folder.id,
      {
        translateX: 20,
        translateY: 10,
        scaleX: 1.25,
        scaleY: 0.75,
        rotationDeg: 30,
        pivotX: 160,
        pivotY: 120,
      },
      parseRevision(1),
      new Date(0),
    );
    const folderAfter = transformed.document.layerTree.layers[folder.id];
    const node = folderAfter?.transformStack.at(-1);
    expect(folderAfter?.type).toBe('folder');
    expect(node?.kind).toBe('affine');
    expect(node?.parameters).toMatchObject({
      schema: 'illustro.folder-affine-transform/1',
      translateX: 20,
      translateY: 10,
      scaleX: 1.25,
      scaleY: 0.75,
      rotationDeg: 30,
      pivotX: 160,
      pivotY: 120,
    });
    expect(node?.parameters.matrix).toHaveLength(6);
    expect(transformed.document.layerTree.layers[child.id]).toEqual(child);
    expect(transformed.document.revision).toBe(1);
  });

  it('honors folder position/all locks', () => {
    const { snapshot, folder } = fixture();
    const lockedFolder = Object.freeze({
      ...folder,
      locks: Object.freeze({ ...folder.locks, position: true }),
    });
    const locked = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({ ...snapshot.document.layerTree.layers, [folder.id]: lockedFolder }),
        }),
      }),
    });
    expect(folderLayerTransformEligibilityV1(locked, folder.id)).toMatchObject({
      eligible: false,
      reason: 'folder position is locked: Folder',
    });
  });

  it('reserves Lineart Group transforms for the synchronized lineart path', () => {
    const { snapshot, folder } = fixture('lineart-group');
    expect(folderLayerTransformEligibilityV1(snapshot, folder.id)).toMatchObject({
      eligible: false,
      reason: 'Lineart Group transform requires the synchronized lineart transform path',
    });
  });

  it('rejects identity transforms', () => {
    const { snapshot, folder } = fixture();
    expect(() =>
      applyFolderAffineTransformSnapshotV1(
        snapshot,
        folder.id,
        {
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
          rotationDeg: 0,
          pivotX: 0,
          pivotY: 0,
        },
        parseRevision(1),
      ),
    ).toThrow('has no changes');
  });
});
''')

replace_once(
    "scripts/verify-m5b-layer-foundation.mjs",
    "console.log('M5B layer system verification passed');",
    r'''requireText('src/app/layer-folder-transform.ts', [
  'folderLayerTransformEligibilityV1',
  'applyFolderAffineTransformSnapshotV1',
  "'illustro.folder-affine-transform/1'",
  "kind: 'affine'",
  'transformStack',
  'Lineart Group transform requires the synchronized lineart transform path',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'layer.transform.folder'",
  'folderLayerTransformEligibilityV1',
  'applyFolderAffineTransformSnapshotV1',
]);
console.log('M5B layer system verification passed');''',
)
replace_once(
    "IMPLEMENTATION_PROGRESS.md",
    "M5B-028 folder-level transform:未完了",
    "M5B-028 folder-level transform:完了",
)
