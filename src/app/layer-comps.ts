import { isUuid, parseLayerId, type LayerId, type Revision } from '../domain/identity.js';
import { BLEND_MODE_IDS, type BlendModeId, type LayerBaseV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export const LAYER_COMPS_EXTENSION_KEY_V1 = 'illustro.layerComps' as const;
export const LAYER_COMP_NAME_MAX_LENGTH_V1 = 120 as const;

export interface LayerCompLayerStateV1 {
  readonly schema: 'illustro.layer-comp-layer-state/1';
  readonly layerId: LayerId;
  readonly visible: boolean;
  readonly opacity: number;
  readonly blendMode: BlendModeId;
}

export interface LayerCompV1 {
  readonly schema: 'illustro.layer-comp/1';
  readonly compId: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly layerStates: readonly LayerCompLayerStateV1[];
}

export interface LayerCompStoreV1 {
  readonly schema: 'illustro.layer-comps/1';
  readonly comps: readonly LayerCompV1[];
}

const EMPTY_LAYER_COMP_STORE_V1: LayerCompStoreV1 = Object.freeze({
  schema: 'illustro.layer-comps/1' as const,
  comps: Object.freeze([]),
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError('Layer Comp updatedAt must be an ISO-like timestamp');
  }
  return value;
}

export function normalizeLayerCompNameV1(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Layer Comp name must be a string');
  const normalized = value.normalize('NFKC').trim();
  if (normalized.length === 0) throw new TypeError('Layer Comp name must not be empty');
  if (normalized.length > LAYER_COMP_NAME_MAX_LENGTH_V1) {
    throw new RangeError(
      `Layer Comp name must be at most ${LAYER_COMP_NAME_MAX_LENGTH_V1} characters`,
    );
  }
  return normalized;
}

function parseLayerCompLayerStateV1(value: unknown): LayerCompLayerStateV1 {
  if (!isRecord(value) || value.schema !== 'illustro.layer-comp-layer-state/1') {
    throw new TypeError('invalid Layer Comp layer state schema');
  }
  if (typeof value.visible !== 'boolean') throw new TypeError('invalid Layer Comp visibility');
  if (
    typeof value.opacity !== 'number' ||
    !Number.isFinite(value.opacity) ||
    value.opacity < 0 ||
    value.opacity > 1
  ) {
    throw new RangeError('invalid Layer Comp opacity');
  }
  if (
    typeof value.blendMode !== 'string' ||
    !BLEND_MODE_IDS.includes(value.blendMode as BlendModeId)
  ) {
    throw new TypeError('invalid Layer Comp blend mode');
  }
  return Object.freeze({
    schema: 'illustro.layer-comp-layer-state/1' as const,
    layerId: parseLayerId(value.layerId),
    visible: value.visible,
    opacity: value.opacity,
    blendMode: value.blendMode as BlendModeId,
  });
}

function parseLayerCompV1(value: unknown): LayerCompV1 {
  if (!isRecord(value) || value.schema !== 'illustro.layer-comp/1') {
    throw new TypeError('invalid Layer Comp schema');
  }
  if (!isUuid(value.compId)) throw new TypeError('Layer Comp compId must be a UUID');
  if (!Array.isArray(value.layerStates))
    throw new TypeError('Layer Comp layerStates must be an array');
  const layerStates = Object.freeze(value.layerStates.map(parseLayerCompLayerStateV1));
  const layerIds = new Set<string>();
  for (const state of layerStates) {
    if (layerIds.has(state.layerId)) throw new Error('Layer Comp contains duplicate layer state');
    layerIds.add(state.layerId);
  }
  return Object.freeze({
    schema: 'illustro.layer-comp/1' as const,
    compId: value.compId,
    name: normalizeLayerCompNameV1(value.name),
    updatedAt: parseTimestamp(value.updatedAt),
    layerStates,
  });
}

function parseLayerCompStoreV1(value: unknown): LayerCompStoreV1 {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.layer-comps/1' ||
    !Array.isArray(value.comps)
  ) {
    throw new TypeError('invalid Layer Comps extension');
  }
  const comps = Object.freeze(value.comps.map(parseLayerCompV1));
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const comp of comps) {
    if (ids.has(comp.compId)) throw new Error('duplicate Layer Comp ID');
    if (names.has(comp.name)) throw new Error('duplicate Layer Comp name');
    ids.add(comp.compId);
    names.add(comp.name);
  }
  return Object.freeze({ schema: 'illustro.layer-comps/1' as const, comps });
}

export function readLayerCompStoreV1(snapshot: PaintProjectSnapshotV1): LayerCompStoreV1 {
  const value = snapshot.document.extensions[LAYER_COMPS_EXTENSION_KEY_V1];
  return value === undefined ? EMPTY_LAYER_COMP_STORE_V1 : parseLayerCompStoreV1(value);
}

export function listLayerCompsV1(snapshot: PaintProjectSnapshotV1): readonly LayerCompV1[] {
  return readLayerCompStoreV1(snapshot).comps;
}

export function findLayerCompV1(
  snapshot: PaintProjectSnapshotV1,
  compId: string,
): LayerCompV1 | null {
  if (!isUuid(compId)) return null;
  return readLayerCompStoreV1(snapshot).comps.find((comp) => comp.compId === compId) ?? null;
}

export function captureLayerCompStatesV1(
  snapshot: PaintProjectSnapshotV1,
): readonly LayerCompLayerStateV1[] {
  return Object.freeze(
    Object.values(snapshot.document.layerTree.layers)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((layer) =>
        Object.freeze({
          schema: 'illustro.layer-comp-layer-state/1' as const,
          layerId: layer.id,
          visible: layer.visible,
          opacity: layer.opacity,
          blendMode: layer.blendMode,
        }),
      ),
  );
}

export function saveLayerCompSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  nameValue: string,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const name = normalizeLayerCompNameV1(nameValue);
  const store = readLayerCompStoreV1(snapshot);
  const existingIndex = store.comps.findIndex((comp) => comp.name === name);
  const existing = existingIndex < 0 ? null : (store.comps[existingIndex] ?? null);
  const comp: LayerCompV1 = Object.freeze({
    schema: 'illustro.layer-comp/1' as const,
    compId: existing?.compId ?? crypto.randomUUID(),
    name,
    updatedAt: now.toISOString(),
    layerStates: captureLayerCompStatesV1(snapshot),
  });
  const comps = [...store.comps];
  if (existingIndex < 0) comps.push(comp);
  else comps[existingIndex] = comp;
  const nextStore: LayerCompStoreV1 = Object.freeze({
    schema: 'illustro.layer-comps/1' as const,
    comps: Object.freeze(comps),
  });
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      extensions: Object.freeze({
        ...snapshot.document.extensions,
        [LAYER_COMPS_EXTENSION_KEY_V1]: nextStore,
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export function layerCompHasChangesV1(snapshot: PaintProjectSnapshotV1, compId: string): boolean {
  const comp = findLayerCompV1(snapshot, compId);
  if (comp === null) return false;
  for (const state of comp.layerStates) {
    const layer = snapshot.document.layerTree.layers[state.layerId];
    if (layer === undefined) continue;
    if (
      layer.visible !== state.visible ||
      layer.opacity !== state.opacity ||
      layer.blendMode !== state.blendMode
    ) {
      return true;
    }
  }
  return false;
}

export function applyLayerCompSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  compId: string,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const comp = findLayerCompV1(snapshot, compId);
  if (comp === null) throw new Error('Layer Comp not found');
  if (!layerCompHasChangesV1(snapshot, compId)) throw new Error('Layer Comp has no changes');
  const states = new Map(comp.layerStates.map((state) => [state.layerId, state] as const));
  const layers: Record<string, LayerBaseV1> = { ...snapshot.document.layerTree.layers };
  for (const [layerId, layer] of Object.entries(snapshot.document.layerTree.layers)) {
    const state = states.get(layerId as LayerId);
    if (state === undefined) continue;
    if (
      layer.visible === state.visible &&
      layer.opacity === state.opacity &&
      layer.blendMode === state.blendMode
    ) {
      continue;
    }
    layers[layerId] = Object.freeze({
      ...layer,
      revision,
      visible: state.visible,
      opacity: state.opacity,
      blendMode: state.blendMode,
    });
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
