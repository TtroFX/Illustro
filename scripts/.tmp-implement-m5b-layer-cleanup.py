from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:180]!r}')
    target.write_text(text.replace(old, new, 1))


Path('src/app/layer-cleanup.ts').write_text(r'''import type { LayerId, Revision } from '../domain/identity.js';
import type { FolderLayerV1, LayerBaseV1, RasterLayerV1, VectorLayerV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export type LayerCleanupModeV1 = 'empty' | 'hidden';

function layer(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const value = snapshot.document.layerTree.layers[layerId];
  if (value === undefined) throw new Error(`layer is missing: ${layerId}`);
  return value;
}

function isProtectedLineartLayerV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  const visited = new Set<LayerId>();
  let current: LayerId | null = layerId;
  while (current !== null) {
    if (visited.has(current)) throw new Error('layer parent cycle detected during cleanup');
    visited.add(current);
    const currentLayer = layer(snapshot, current);
    if (currentLayer.type === 'lineartBoundary') return true;
    if (currentLayer.type === 'folder' && (currentLayer as FolderLayerV1).role === 'lineart-group') {
      return true;
    }
    current = currentLayer.parentId;
  }
  return false;
}

function collectSubtreeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): readonly LayerId[] {
  const result: LayerId[] = [];
  const visit = (currentId: LayerId): void => {
    const current = layer(snapshot, currentId);
    result.push(currentId);
    if (current.type !== 'folder') return;
    for (const childId of (current as FolderLayerV1).childLayerIds) visit(childId);
  };
  visit(layerId);
  return Object.freeze(result);
}

function subtreeContainsProtectedLineartV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): boolean {
  return collectSubtreeV1(snapshot, layerId).some((id) => isProtectedLineartLayerV1(snapshot, id));
}

function emptyLayerCandidateV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  committedLayerIds: ReadonlySet<LayerId>,
  memo: Map<LayerId, boolean>,
): boolean {
  const cached = memo.get(layerId);
  if (cached !== undefined) return cached;
  if (isProtectedLineartLayerV1(snapshot, layerId)) {
    memo.set(layerId, false);
    return false;
  }
  const current = layer(snapshot, layerId);
  let empty = false;
  if (current.type === 'raster') {
    empty = (current as RasterLayerV1).tiles.length === 0 && !committedLayerIds.has(layerId);
  } else if (current.type === 'vector') {
    empty = (current as VectorLayerV1).objects.length === 0;
  } else if (current.type === 'folder') {
    const folder = current as FolderLayerV1;
    empty =
      folder.role === 'normal' &&
      folder.childLayerIds.every((childId) =>
        emptyLayerCandidateV1(snapshot, childId, committedLayerIds, memo),
      );
  }
  memo.set(layerId, empty);
  return empty;
}

export function layerCleanupCandidatesV1(
  snapshot: PaintProjectSnapshotV1,
  mode: LayerCleanupModeV1,
): readonly LayerId[] {
  const selected = new Set<LayerId>();
  if (mode === 'empty') {
    const committedLayerIds = new Set(snapshot.committedStrokes.map((entry) => entry.stroke.layerId));
    const memo = new Map<LayerId, boolean>();
    for (const layerId of Object.values(snapshot.document.layerTree.layers).map((item) => item.id)) {
      if (emptyLayerCandidateV1(snapshot, layerId, committedLayerIds, memo)) selected.add(layerId);
    }
  } else {
    const visit = (layerId: LayerId): void => {
      if (isProtectedLineartLayerV1(snapshot, layerId)) return;
      const current = layer(snapshot, layerId);
      if (!current.visible && !subtreeContainsProtectedLineartV1(snapshot, layerId)) {
        for (const descendantId of collectSubtreeV1(snapshot, layerId)) selected.add(descendantId);
        return;
      }
      if (current.type === 'folder') {
        for (const childId of (current as FolderLayerV1).childLayerIds) visit(childId);
      }
    };
    for (const rootId of snapshot.document.layerTree.rootLayerIds) visit(rootId);
  }
  return Object.freeze([...selected]);
}

export function applyLayerCleanupSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  mode: LayerCleanupModeV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const removed = new Set(layerCleanupCandidatesV1(snapshot, mode));
  if (removed.size === 0) throw new Error(`${mode} layer cleanup has no changes`);

  const layers: Record<string, LayerBaseV1> = {};
  for (const [id, current] of Object.entries(snapshot.document.layerTree.layers)) {
    if (removed.has(current.id)) continue;
    let next: LayerBaseV1 = current;
    if (current.type === 'folder') {
      const folder = current as FolderLayerV1;
      const childLayerIds = folder.childLayerIds.filter((childId) => !removed.has(childId));
      if (childLayerIds.length !== folder.childLayerIds.length) {
        next = Object.freeze({ ...folder, revision, childLayerIds: Object.freeze(childLayerIds) });
      }
    }
    if (next.clipping !== null && removed.has(next.clipping.baseLayerId)) {
      next = Object.freeze({ ...next, revision, clipping: null });
    }
    layers[id] = next;
  }

  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze(
          snapshot.document.layerTree.rootLayerIds.filter((layerId) => !removed.has(layerId)),
        ),
        layers: Object.freeze(layers),
      }),
    }),
    committedStrokes: Object.freeze(
      snapshot.committedStrokes.filter((entry) => !removed.has(entry.stroke.layerId)),
    ),
  });
}
''')

Path('tests/unit/layer-cleanup.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyLayerCleanupSnapshotV1,
  layerCleanupCandidatesV1,
} from '../../src/app/layer-cleanup.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createFolderLayer,
  createRasterLayer,
  createRasterTileReference,
  createVectorLayer,
} from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly emptyRaster: ReturnType<typeof createRasterLayer>;
  readonly paintedRaster: ReturnType<typeof createRasterLayer>;
  readonly hiddenRaster: ReturnType<typeof createRasterLayer>;
  readonly emptyVector: ReturnType<typeof createVectorLayer>;
  readonly emptyFolder: ReturnType<typeof createFolderLayer>;
  readonly lineartGroup: ReturnType<typeof createFolderLayer>;
} {
  const emptyRaster = createRasterLayer({ name: 'Empty Raster' });
  const paintedRaster = createRasterLayer({
    name: 'Painted',
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: 'tile-painted' })],
  });
  const hiddenRaster = createRasterLayer({
    name: 'Hidden',
    visible: false,
    tiles: [createRasterTileReference({ x: 1, y: 0, payloadRef: 'tile-hidden' })],
  });
  const emptyVector = createVectorLayer({ name: 'Empty Vector' });
  const emptyFolder = createFolderLayer({ name: 'Empty Folder' });
  const lineartGroup = createFolderLayer({ name: 'Lineart', visible: false, role: 'lineart-group' });
  const document = createDocumentV1({ width: 512, height: 512 });
  const layers = Object.freeze({
    [emptyRaster.id]: emptyRaster,
    [paintedRaster.id]: paintedRaster,
    [hiddenRaster.id]: hiddenRaster,
    [emptyVector.id]: emptyVector,
    [emptyFolder.id]: emptyFolder,
    [lineartGroup.id]: lineartGroup,
  });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([
            emptyRaster.id,
            paintedRaster.id,
            hiddenRaster.id,
            emptyVector.id,
            emptyFolder.id,
            lineartGroup.id,
          ]),
          layers,
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    emptyRaster,
    paintedRaster,
    hiddenRaster,
    emptyVector,
    emptyFolder,
    lineartGroup,
  };
}

describe('M5B bulk layer cleanup', () => {
  it('finds empty raster/vector/normal-folder layers without removing generated or protected semantics', () => {
    const { snapshot, emptyRaster, paintedRaster, emptyVector, emptyFolder, lineartGroup } = fixture();
    const candidates = layerCleanupCandidatesV1(snapshot, 'empty');
    expect(candidates).toContain(emptyRaster.id);
    expect(candidates).toContain(emptyVector.id);
    expect(candidates).toContain(emptyFolder.id);
    expect(candidates).not.toContain(paintedRaster.id);
    expect(candidates).not.toContain(lineartGroup.id);
  });

  it('removes hidden ordinary layer subtrees but protects Lineart Group state', () => {
    const { snapshot, hiddenRaster, lineartGroup } = fixture();
    const candidates = layerCleanupCandidatesV1(snapshot, 'hidden');
    expect(candidates).toContain(hiddenRaster.id);
    expect(candidates).not.toContain(lineartGroup.id);
    const cleaned = applyLayerCleanupSnapshotV1(snapshot, 'hidden', parseRevision(1), new Date(0));
    expect(cleaned.document.layerTree.layers[hiddenRaster.id]).toBeUndefined();
    expect(cleaned.document.layerTree.layers[lineartGroup.id]).toBeDefined();
    expect(cleaned.document.revision).toBe(1);
    expect(cleaned.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('removes empty candidates atomically and rejects a no-op cleanup', () => {
    const { snapshot, emptyRaster, paintedRaster } = fixture();
    const cleaned = applyLayerCleanupSnapshotV1(snapshot, 'empty', parseRevision(1));
    expect(cleaned.document.layerTree.layers[emptyRaster.id]).toBeUndefined();
    expect(cleaned.document.layerTree.layers[paintedRaster.id]).toBeDefined();
    expect(() => applyLayerCleanupSnapshotV1(cleaned, 'empty', parseRevision(2))).toThrow(
      /has no changes/,
    );
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import {\n  CREATABLE_LAYER_KINDS_V1,",
    "import { applyLayerCleanupSnapshotV1, layerCleanupCandidatesV1 } from './layer-cleanup.js';\nimport {\n  CREATABLE_LAYER_KINDS_V1,",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const maskButton = required<HTMLButtonElement>('#layer-add-mask');",
    "  const maskButton = required<HTMLButtonElement>('#layer-add-mask');\n  const cleanupEmptyButton = required<HTMLButtonElement>('#layer-cleanup-empty');\n  const cleanupHiddenButton = required<HTMLButtonElement>('#layer-cleanup-hidden');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    const projectSnapshot = options.paintSession.projectSnapshot();\n    const mergeEligibility =",
    "    const projectSnapshot = options.paintSession.projectSnapshot();\n    const activeStroke = options.paintSession.activeStrokeId() !== null;\n    const emptyCleanupCount =\n      projectSnapshot === null ? 0 : layerCleanupCandidatesV1(projectSnapshot, 'empty').length;\n    const hiddenCleanupCount =\n      projectSnapshot === null ? 0 : layerCleanupCandidatesV1(projectSnapshot, 'hidden').length;\n    cleanupEmptyButton.disabled = emptyCleanupCount === 0 || activeStroke;\n    cleanupHiddenButton.disabled = hiddenCleanupCount === 0 || activeStroke;\n    cleanupEmptyButton.title = `空レイヤーを削除 (${emptyCleanupCount})`;\n    cleanupHiddenButton.title = `非表示レイヤーを削除 (${hiddenCleanupCount})`;\n    const mergeEligibility =",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onMask = (): void => {",
    "  const onCleanupEmpty = (): void => {\n    closeMenu(cleanupEmptyButton);\n    commitMutation('layer.cleanup.empty', (before, revision) =>\n      applyLayerCleanupSnapshotV1(before, 'empty', revision),\n    );\n  };\n\n  const onCleanupHidden = (): void => {\n    closeMenu(cleanupHiddenButton);\n    commitMutation('layer.cleanup.hidden', (before, revision) =>\n      applyLayerCleanupSnapshotV1(before, 'hidden', revision),\n    );\n  };\n\n  const onMask = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  maskButton.addEventListener('click', onMask);",
    "  maskButton.addEventListener('click', onMask);\n  cleanupEmptyButton.addEventListener('click', onCleanupEmpty);\n  cleanupHiddenButton.addEventListener('click', onCleanupHidden);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      maskButton.removeEventListener('click', onMask);",
    "      maskButton.removeEventListener('click', onMask);\n      cleanupEmptyButton.removeEventListener('click', onCleanupEmpty);\n      cleanupHiddenButton.removeEventListener('click', onCleanupHidden);",
)

replace_once(
    'src/index.html',
    '              <button id="layer-add-linked-object" type="button">リンクオブジェクトを追加</button>',
    '              <button id="layer-add-linked-object" type="button">リンクオブジェクトを追加</button>\n              <button id="layer-cleanup-empty" type="button">空レイヤーを削除</button>\n              <button id="layer-cleanup-hidden" type="button">非表示レイヤーを削除</button>',
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', ['id=\"layer-filter\"', 'value=\"state:hidden\"', 'value=\"type:raster\"']);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', ['id=\"layer-filter\"', 'value=\"state:hidden\"', 'value=\"type:raster\"']);\nrequireText('src/app/layer-cleanup.ts', [\n  'layerCleanupCandidatesV1',\n  'applyLayerCleanupSnapshotV1',\n  \"LayerCleanupModeV1 = 'empty' | 'hidden'\",\n  'lineart-group',\n  'committedStrokes.filter',\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#layer-cleanup-empty'\",\n  \"'#layer-cleanup-hidden'\",\n  \"'layer.cleanup.empty'\",\n  \"'layer.cleanup.hidden'\",\n  'applyLayerCleanupSnapshotV1',\n]);\nrequireText('src/index.html', ['id=\"layer-cleanup-empty\"', 'id=\"layer-cleanup-hidden\"']);\nconsole.log('M5B layer system verification passed');",
)

replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-031 empty-layer cleanup:未完了', 'M5B-031 empty-layer cleanup:完了')
replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-032 hidden-layer cleanup:未完了', 'M5B-032 hidden-layer cleanup:完了')
