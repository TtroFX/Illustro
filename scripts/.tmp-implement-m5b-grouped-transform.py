from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one anchor in {path}; found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


Path("src/app/layer-group-transform.ts").write_text(r'''import { createNodeId, type LayerId, type Revision } from '../domain/identity.js';
import type { LayerBaseV1, TransformNodeV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface GroupedAffineLayerTransformInputV1 {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationDeg: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

export interface GroupedLayerTransformEligibilityV1 {
  readonly schema: 'illustro.grouped-layer-transform-eligibility/1';
  readonly eligible: boolean;
  readonly layerIds: readonly LayerId[];
  readonly reason: string | null;
}

function result(
  eligible: boolean,
  layerIds: readonly LayerId[],
  reason: string | null,
): GroupedLayerTransformEligibilityV1 {
  return Object.freeze({
    schema: 'illustro.grouped-layer-transform-eligibility/1' as const,
    eligible,
    layerIds: Object.freeze([...layerIds]),
    reason,
  });
}

function canonicalRootSelection(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
): readonly LayerId[] {
  const selected = new Set(layerIds);
  return Object.freeze(
    snapshot.document.layerTree.rootLayerIds.filter((layerId) => selected.has(layerId)),
  );
}

export function groupedLayerTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
): GroupedLayerTransformEligibilityV1 {
  const unique = new Set(layerIds);
  const ordered = canonicalRootSelection(snapshot, layerIds);
  if (unique.size !== ordered.length) {
    return result(false, ordered, 'grouped transform requires existing root layers only');
  }
  if (ordered.length < 2) {
    return result(false, ordered, 'grouped transform requires at least two selected layers');
  }
  for (const layerId of ordered) {
    const layer = snapshot.document.layerTree.layers[layerId];
    if (layer === undefined) return result(false, ordered, `layer is missing: ${layerId}`);
    if (layer.type === 'folder') {
      return result(false, ordered, 'folder transforms use the folder-level transform path');
    }
    if (layer.type === 'lineartBoundary') {
      return result(false, ordered, 'Lineart Boundary transform is owned by the Lineart Group');
    }
    if (layer.locks.all || layer.locks.position) {
      return result(false, ordered, `layer position is locked: ${layer.name}`);
    }
  }
  return result(true, ordered, null);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalizedInput(
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
    throw new RangeError('grouped transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('grouped transform has no changes');
  }
  return normalized;
}

function affineMatrix(
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

function transformedLayer(
  layer: LayerBaseV1,
  revision: Revision,
  groupTransformId: string,
  input: GroupedAffineLayerTransformInputV1,
): LayerBaseV1 {
  const matrix = affineMatrix(input);
  const node: TransformNodeV1 = Object.freeze({
    id: createNodeId(),
    revision,
    kind: 'affine',
    parameters: Object.freeze({
      schema: 'illustro.grouped-affine-transform/1',
      groupTransformId,
      translateX: input.translateX,
      translateY: input.translateY,
      scaleX: input.scaleX,
      scaleY: input.scaleY,
      rotationDeg: input.rotationDeg,
      pivotX: input.pivotX,
      pivotY: input.pivotY,
      matrix,
    }),
  });
  return Object.freeze({
    ...layer,
    revision,
    transformStack: Object.freeze([...layer.transformStack, node]),
    boundsHint: null,
  });
}

export function applyGroupedAffineLayerTransformSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
  input: GroupedAffineLayerTransformInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = groupedLayerTransformEligibilityV1(snapshot, layerIds);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'grouped transform is unavailable');
  }
  const normalized = normalizedInput(input);
  const groupTransformId = createNodeId();
  const layers: Record<string, LayerBaseV1> = { ...snapshot.document.layerTree.layers };
  for (const layerId of eligibility.layerIds) {
    const layer = layers[layerId];
    if (layer === undefined) throw new Error(`layer is missing: ${layerId}`);
    layers[layerId] = transformedLayer(layer, revision, groupTransformId, normalized);
  }
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze(layers),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}
''')

replace_once(
    "src/app/layer-workflow-controller.ts",
    "} from './layer-creation.js';\nimport {",
    "} from './layer-creation.js';\nimport {\n  applyGroupedAffineLayerTransformSnapshotV1,\n  groupedLayerTransformEligibilityV1,\n} from './layer-group-transform.js';\nimport {",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const verticalFlipButton = required<HTMLButtonElement>('#layer-flip-vertical');\n  const deleteButton",
    "  const verticalFlipButton = required<HTMLButtonElement>('#layer-flip-vertical');\n  const groupedTransformButton = required<HTMLButtonElement>('#layer-group-transform');\n  const groupedTransformDialog = required<HTMLDialogElement>('#layer-group-transform-dialog');\n  const groupedTransformForm = required<HTMLFormElement>('#layer-group-transform-form');\n  const groupedTransformCancel = required<HTMLButtonElement>('#layer-group-transform-cancel');\n  const groupedTransformX = required<HTMLInputElement>('#layer-group-transform-x');\n  const groupedTransformY = required<HTMLInputElement>('#layer-group-transform-y');\n  const groupedTransformScaleX = required<HTMLInputElement>('#layer-group-transform-scale-x');\n  const groupedTransformScaleY = required<HTMLInputElement>('#layer-group-transform-scale-y');\n  const groupedTransformRotation = required<HTMLInputElement>('#layer-group-transform-rotation');\n  const groupedTransformPivotX = required<HTMLInputElement>('#layer-group-transform-pivot-x');\n  const groupedTransformPivotY = required<HTMLInputElement>('#layer-group-transform-pivot-y');\n  const groupedTransformStatus = required<HTMLOutputElement>('#layer-group-transform-status');\n  const deleteButton",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    root.dataset.illustroLayerError = message;\n    status.value = message;",
    "    root.dataset.illustroLayerError = message;\n    status.value = message;\n    groupedTransformStatus.value = message;",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    root.dataset.illustroLayerError = '';\n    status.value = '';",
    "    root.dataset.illustroLayerError = '';\n    status.value = '';\n    groupedTransformStatus.value = '';",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    verticalFlipButton.title = flipEligibility?.reason ?? 'レイヤーを上下反転';\n    deleteButton.disabled",
    "    verticalFlipButton.title = flipEligibility?.reason ?? 'レイヤーを上下反転';\n    const groupedTransformLayerIds = options.paintSession\n      .selectedLayerIds()\n      .filter((id) => documentValue.layerTree.rootLayerIds.includes(id));\n    const groupedTransformEligibility =\n      projectSnapshot === null\n        ? null\n        : groupedLayerTransformEligibilityV1(projectSnapshot, groupedTransformLayerIds);\n    groupedTransformButton.disabled =\n      groupedTransformEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    groupedTransformButton.title =\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';\n    deleteButton.disabled",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const onDelete = (): void => {",
    r'''  const numericTransformValue = (input: HTMLInputElement, label: string): number => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
    return value;
  };

  const onGroupedTransform = (): void => {
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    const layerIds = options.paintSession
      .selectedLayerIds()
      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));
    const eligibility = groupedLayerTransformEligibilityV1(current, layerIds);
    if (!eligibility.eligible) {
      publishError(new Error(eligibility.reason ?? 'grouped transform is unavailable'));
      return;
    }
    groupedTransformX.value = '0';
    groupedTransformY.value = '0';
    groupedTransformScaleX.value = '100';
    groupedTransformScaleY.value = '100';
    groupedTransformRotation.value = '0';
    groupedTransformPivotX.value = String(current.document.canvas.width / 2);
    groupedTransformPivotY.value = String(current.document.canvas.height / 2);
    clearError();
    groupedTransformDialog.showModal();
  };

  const onGroupedTransformCancel = (): void => {
    groupedTransformDialog.close();
    clearError();
  };

  const onGroupedTransformSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    const layerIds = options.paintSession
      .selectedLayerIds()
      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));
    try {
      const input = Object.freeze({
        translateX: numericTransformValue(groupedTransformX, 'translateX'),
        translateY: numericTransformValue(groupedTransformY, 'translateY'),
        scaleX: numericTransformValue(groupedTransformScaleX, 'scaleX') / 100,
        scaleY: numericTransformValue(groupedTransformScaleY, 'scaleY') / 100,
        rotationDeg: numericTransformValue(groupedTransformRotation, 'rotationDeg'),
        pivotX: numericTransformValue(groupedTransformPivotX, 'pivotX'),
        pivotY: numericTransformValue(groupedTransformPivotY, 'pivotY'),
      });
      options.schedule(async () => {
        try {
          if (options.paintSession.activeStrokeId() !== null) {
            throw new Error('grouped transform is unavailable while a stroke is active');
          }
          const transaction = await options.paintHistory.commitSnapshotTransform(
            'layer.transform.grouped',
            (before, revision) =>
              applyGroupedAffineLayerTransformSnapshotV1(before, layerIds, input, revision),
          );
          await options.paintPersistence.markDirty(transaction.transactionId);
          root.dataset.illustroLayerTransaction = transaction.transactionId;
          groupedTransformDialog.close();
          clearError();
          refresh();
          options.onHistoryChanged();
        } catch (error) {
          publishError(error);
        }
      });
    } catch (error) {
      publishError(error);
    }
  };

  const onDelete = (): void => {''',
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  verticalFlipButton.addEventListener('click', onVerticalFlip);\n  deleteButton.addEventListener",
    "  verticalFlipButton.addEventListener('click', onVerticalFlip);\n  groupedTransformButton.addEventListener('click', onGroupedTransform);\n  groupedTransformForm.addEventListener('submit', onGroupedTransformSubmit);\n  groupedTransformCancel.addEventListener('click', onGroupedTransformCancel);\n  deleteButton.addEventListener",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "      verticalFlipButton.removeEventListener('click', onVerticalFlip);\n      deleteButton.removeEventListener",
    "      verticalFlipButton.removeEventListener('click', onVerticalFlip);\n      groupedTransformButton.removeEventListener('click', onGroupedTransform);\n      groupedTransformForm.removeEventListener('submit', onGroupedTransformSubmit);\n      groupedTransformCancel.removeEventListener('click', onGroupedTransformCancel);\n      deleteButton.removeEventListener",
)

replace_once(
    "src/index.html",
    '              <button id="layer-flip-vertical" type="button" aria-label="選択レイヤーを上下反転" title="上下反転">⇅</button>\n              <button id="layer-rename"',
    '              <button id="layer-flip-vertical" type="button" aria-label="選択レイヤーを上下反転" title="上下反転">⇅</button>\n              <button id="layer-group-transform" type="button" aria-label="選択中の複数レイヤーをまとめて変形" title="複数レイヤー変形">⤢</button>\n              <button id="layer-rename"',
)
replace_once(
    "src/index.html",
    '    <dialog id="document-dialog" class="document-dialog" aria-labelledby="document-dialog-title">',
    r'''    <dialog id="layer-group-transform-dialog" class="document-dialog" aria-labelledby="layer-group-transform-title">
      <form id="layer-group-transform-form" method="dialog" class="document-dialog-form">
        <header><h2 id="layer-group-transform-title">複数レイヤー変形</h2></header>
        <p class="document-dialog-help">選択中の複数レイヤーへ同じ非破壊Affine変形を適用します。</p>
        <div class="document-dialog-grid">
          <label>移動 X (px)<input id="layer-group-transform-x" type="number" step="0.1" value="0" /></label>
          <label>移動 Y (px)<input id="layer-group-transform-y" type="number" step="0.1" value="0" /></label>
          <label>回転 (°)<input id="layer-group-transform-rotation" type="number" step="0.1" value="0" /></label>
          <label>拡大率 X (%)<input id="layer-group-transform-scale-x" type="number" min="0.01" step="0.1" value="100" /></label>
          <label>拡大率 Y (%)<input id="layer-group-transform-scale-y" type="number" min="0.01" step="0.1" value="100" /></label>
          <span></span>
          <label>基準点 X<input id="layer-group-transform-pivot-x" type="number" step="0.1" value="0" /></label>
          <label>基準点 Y<input id="layer-group-transform-pivot-y" type="number" step="0.1" value="0" /></label>
        </div>
        <output id="layer-group-transform-status" class="document-dialog-status" aria-live="polite"></output>
        <footer>
          <button id="layer-group-transform-cancel" type="button" class="document-dialog-secondary">キャンセル</button>
          <button type="submit" class="document-dialog-primary">適用</button>
        </footer>
      </form>
    </dialog>
    <dialog id="document-dialog" class="document-dialog" aria-labelledby="document-dialog-title">''',
)

Path("tests/unit/layer-group-transform.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyGroupedAffineLayerTransformSnapshotV1,
  groupedLayerTransformEligibilityV1,
} from '../../src/app/layer-group-transform.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly first: ReturnType<typeof createRasterLayer>;
  readonly second: ReturnType<typeof createRasterLayer>;
  readonly third: ReturnType<typeof createRasterLayer>;
} {
  const first = createRasterLayer({ name: 'First' });
  const second = createRasterLayer({ name: 'Second' });
  const third = createRasterLayer({ name: 'Third' });
  const document = createDocumentV1({ width: 400, height: 300 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([first.id, second.id, third.id]),
          layers: Object.freeze({
            [first.id]: first,
            [second.id]: second,
            [third.id]: third,
          }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    first,
    second,
    third,
  };
}

describe('M5B grouped transform', () => {
  it('adds one shared grouped affine transform transaction to each selected layer', () => {
    const { snapshot, first, second, third } = fixture();
    const transformed = applyGroupedAffineLayerTransformSnapshotV1(
      snapshot,
      [second.id, first.id],
      {
        translateX: 12,
        translateY: -4,
        scaleX: 2,
        scaleY: 0.5,
        rotationDeg: 90,
        pivotX: 200,
        pivotY: 150,
      },
      parseRevision(1),
      new Date(0),
    );
    const firstNode = transformed.document.layerTree.layers[first.id]?.transformStack.at(-1);
    const secondNode = transformed.document.layerTree.layers[second.id]?.transformStack.at(-1);
    expect(firstNode?.kind).toBe('affine');
    expect(secondNode?.kind).toBe('affine');
    expect(firstNode?.id).not.toBe(secondNode?.id);
    expect(firstNode?.parameters.groupTransformId).toBe(secondNode?.parameters.groupTransformId);
    expect(firstNode?.parameters).toMatchObject({
      schema: 'illustro.grouped-affine-transform/1',
      translateX: 12,
      translateY: -4,
      scaleX: 2,
      scaleY: 0.5,
      rotationDeg: 90,
      pivotX: 200,
      pivotY: 150,
    });
    expect(firstNode?.parameters.matrix).toHaveLength(6);
    expect(transformed.document.layerTree.layers[third.id]?.transformStack).toHaveLength(0);
    expect(transformed.document.revision).toBe(1);
    expect(transformed.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('requires at least two transformable unlocked root layers', () => {
    const { snapshot, first, second } = fixture();
    expect(groupedLayerTransformEligibilityV1(snapshot, [first.id]).eligible).toBe(false);
    const lockedSecond = Object.freeze({
      ...second,
      locks: Object.freeze({ ...second.locks, position: true }),
    });
    const lockedSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({
            ...snapshot.document.layerTree.layers,
            [second.id]: lockedSecond,
          }),
        }),
      }),
    });
    expect(groupedLayerTransformEligibilityV1(lockedSnapshot, [first.id, second.id])).toMatchObject({
      eligible: false,
      reason: 'layer position is locked: Second',
    });
  });

  it('reserves folder transforms for the dedicated folder-level path', () => {
    const { snapshot, first } = fixture();
    const folder = createFolderLayer({ name: 'Folder' });
    const withFolder = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([...snapshot.document.layerTree.rootLayerIds, folder.id]),
          layers: Object.freeze({ ...snapshot.document.layerTree.layers, [folder.id]: folder }),
        }),
      }),
    });
    expect(groupedLayerTransformEligibilityV1(withFolder, [first.id, folder.id])).toMatchObject({
      eligible: false,
      reason: 'folder transforms use the folder-level transform path',
    });
  });

  it('rejects an identity transform instead of creating empty history work', () => {
    const { snapshot, first, second } = fixture();
    expect(() =>
      applyGroupedAffineLayerTransformSnapshotV1(
        snapshot,
        [first.id, second.id],
        {
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
          rotationDeg: 0,
          pivotX: 200,
          pivotY: 150,
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
    r'''requireText('src/app/layer-group-transform.ts', [
  'groupedLayerTransformEligibilityV1',
  'applyGroupedAffineLayerTransformSnapshotV1',
  "'illustro.grouped-affine-transform/1'",
  "kind: 'affine'",
  'transformStack',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'layer.transform.grouped'",
  'groupedLayerTransformEligibilityV1',
  'applyGroupedAffineLayerTransformSnapshotV1',
  'layer-group-transform-dialog',
]);
requireText('src/index.html', [
  'id="layer-group-transform"',
  'id="layer-group-transform-dialog"',
  'id="layer-group-transform-x"',
  'id="layer-group-transform-y"',
  'id="layer-group-transform-scale-x"',
  'id="layer-group-transform-scale-y"',
  'id="layer-group-transform-rotation"',
  'id="layer-group-transform-pivot-x"',
  'id="layer-group-transform-pivot-y"',
]);
console.log('M5B layer system verification passed');''',
)
replace_once(
    "IMPLEMENTATION_PROGRESS.md",
    "M5B-027 grouped transform:未完了",
    "M5B-027 grouped transform:完了",
)
