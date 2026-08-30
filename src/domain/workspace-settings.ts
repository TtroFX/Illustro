import {
  parseCommandId,
  type CommandBindingV1,
} from './command-registry.js';
import { parseInternalId, type InternalId } from './internal-id.js';
import { toJsonValue } from './serialization.js';

export const WORKSPACE_STATE_SCHEMA = 'illustro.workspace/1' as const;
export const USER_SETTINGS_SCHEMA = 'illustro.user-settings/1' as const;
export const QUICK_HOLE_SLOT_COUNT = 6;

export interface DetachedInspectorBlockV1 {
  readonly blockId: InternalId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorkspaceStateV1 {
  readonly schema: typeof WORKSPACE_STATE_SCHEMA;
  readonly layout: {
    readonly rightInspectorWidthPx: number;
    readonly toolRailThicknessPx: number;
    readonly dockedBlockOrder: readonly InternalId[];
    readonly detachedBlocks: readonly DetachedInspectorBlockV1[];
    readonly rightInspectorCollapsed: boolean;
  };
  readonly quickHole: {
    readonly slots: readonly CommandBindingV1[];
    readonly controllerScale: number;
    readonly ringRadiusPx: number;
    readonly buttonSizePx: number;
    readonly overlayOpacity: number;
  };
}

export interface UserSettingsV1 {
  readonly schema: typeof USER_SETTINGS_SCHEMA;
  readonly input: {
    readonly touchCanvasNavigation: boolean;
    readonly stylusButtonsEnabled: boolean;
  };
  readonly power: {
    readonly requestWakeLockWhileDrawing: boolean;
  };
  readonly workspaceDefaults: {
    readonly controllerScale: number;
    readonly overlayOpacity: number;
  };
}

export interface UserSettingsStoreV1 {
  getSnapshot(): UserSettingsV1;
  replace(next: UserSettingsV1): void;
  reset(): void;
  subscribe(listener: (settings: UserSettingsV1) => void): () => void;
}

function assertFiniteRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be a finite value in ${minimum}..${maximum}`);
  }
}

function normalizeBinding(binding: CommandBindingV1): CommandBindingV1 {
  const commandId = parseCommandId(binding.commandId);
  return Object.freeze(
    binding.args === undefined
      ? { commandId }
      : { commandId, args: toJsonValue(binding.args) },
  );
}

function normalizeDetachedBlock(block: DetachedInspectorBlockV1): DetachedInspectorBlockV1 {
  assertFiniteRange(block.width, 1, 16_384, 'detached block width');
  assertFiniteRange(block.height, 1, 16_384, 'detached block height');
  if (!Number.isFinite(block.x) || !Number.isFinite(block.y)) {
    throw new RangeError('detached block position must be finite');
  }
  return Object.freeze({
    blockId: parseInternalId(block.blockId, 'inspector block ID'),
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
  });
}

export function createDefaultQuickHoleBindings(): readonly CommandBindingV1[] {
  return Object.freeze([
    Object.freeze({ commandId: parseCommandId('history.undo') }),
    Object.freeze({ commandId: parseCommandId('history.redo') }),
    Object.freeze({ commandId: parseCommandId('tool.toggleBrushEraser') }),
    Object.freeze({ commandId: parseCommandId('tool.activate'), args: toJsonValue({ toolId: 'eyedropper' }) }),
    Object.freeze({ commandId: parseCommandId('tool.activate'), args: toJsonValue({ toolId: 'selection.lasso' }) }),
    Object.freeze({ commandId: parseCommandId('tool.activate'), args: toJsonValue({ toolId: 'fill' }) }),
  ]);
}

export function normalizeWorkspaceStateV1(input: WorkspaceStateV1): WorkspaceStateV1 {
  if (input.schema !== WORKSPACE_STATE_SCHEMA) throw new TypeError('unsupported workspace schema');
  assertFiniteRange(input.layout.rightInspectorWidthPx, 1, 4096, 'right inspector width');
  assertFiniteRange(input.layout.toolRailThicknessPx, 1, 1024, 'tool rail thickness');
  assertFiniteRange(input.quickHole.controllerScale, 0.25, 4, 'Quick Hole controller scale');
  assertFiniteRange(input.quickHole.ringRadiusPx, 1, 1024, 'Quick Hole ring radius');
  assertFiniteRange(input.quickHole.buttonSizePx, 1, 512, 'Quick Hole button size');
  assertFiniteRange(input.quickHole.overlayOpacity, 0.1, 1, 'Quick Hole overlay opacity');
  if (input.quickHole.slots.length !== QUICK_HOLE_SLOT_COUNT) {
    throw new RangeError(`Quick Hole must have exactly ${QUICK_HOLE_SLOT_COUNT} command slots`);
  }

  const dockedBlockOrder = input.layout.dockedBlockOrder.map((id) =>
    parseInternalId(id, 'inspector block ID'),
  );
  const detachedBlocks = input.layout.detachedBlocks.map(normalizeDetachedBlock);
  const detachedIds = new Set(detachedBlocks.map((block) => block.blockId));
  if (dockedBlockOrder.some((id) => detachedIds.has(id))) {
    throw new TypeError('an inspector block cannot be docked and detached simultaneously');
  }

  return Object.freeze({
    schema: WORKSPACE_STATE_SCHEMA,
    layout: Object.freeze({
      rightInspectorWidthPx: input.layout.rightInspectorWidthPx,
      toolRailThicknessPx: input.layout.toolRailThicknessPx,
      dockedBlockOrder: Object.freeze(dockedBlockOrder),
      detachedBlocks: Object.freeze(detachedBlocks),
      rightInspectorCollapsed: input.layout.rightInspectorCollapsed,
    }),
    quickHole: Object.freeze({
      slots: Object.freeze(input.quickHole.slots.map(normalizeBinding)),
      controllerScale: input.quickHole.controllerScale,
      ringRadiusPx: input.quickHole.ringRadiusPx,
      buttonSizePx: input.quickHole.buttonSizePx,
      overlayOpacity: input.quickHole.overlayOpacity,
    }),
  });
}

export function createDefaultWorkspaceStateV1(): WorkspaceStateV1 {
  return normalizeWorkspaceStateV1({
    schema: WORKSPACE_STATE_SCHEMA,
    layout: {
      rightInspectorWidthPx: 320,
      toolRailThicknessPx: 56,
      dockedBlockOrder: [
        parseInternalId('inspector.layers'),
        parseInternalId('inspector.color'),
        parseInternalId('inspector.brushPresets'),
        parseInternalId('inspector.brushSettings'),
        parseInternalId('inspector.navigator'),
      ],
      detachedBlocks: [],
      rightInspectorCollapsed: false,
    },
    quickHole: {
      slots: createDefaultQuickHoleBindings(),
      controllerScale: 1,
      ringRadiusPx: 68,
      buttonSizePx: 44,
      overlayOpacity: 0.92,
    },
  });
}

export function normalizeUserSettingsV1(input: UserSettingsV1): UserSettingsV1 {
  if (input.schema !== USER_SETTINGS_SCHEMA) throw new TypeError('unsupported user settings schema');
  assertFiniteRange(input.workspaceDefaults.controllerScale, 0.25, 4, 'default controller scale');
  assertFiniteRange(input.workspaceDefaults.overlayOpacity, 0.1, 1, 'default overlay opacity');
  return Object.freeze({
    schema: USER_SETTINGS_SCHEMA,
    input: Object.freeze({ ...input.input }),
    power: Object.freeze({ ...input.power }),
    workspaceDefaults: Object.freeze({ ...input.workspaceDefaults }),
  });
}

export function createDefaultUserSettingsV1(): UserSettingsV1 {
  return normalizeUserSettingsV1({
    schema: USER_SETTINGS_SCHEMA,
    input: {
      touchCanvasNavigation: true,
      stylusButtonsEnabled: true,
    },
    power: {
      requestWakeLockWhileDrawing: false,
    },
    workspaceDefaults: {
      controllerScale: 1,
      overlayOpacity: 0.92,
    },
  });
}

export function createUserSettingsStoreV1(
  initial: UserSettingsV1 = createDefaultUserSettingsV1(),
): UserSettingsStoreV1 {
  const baseline = normalizeUserSettingsV1(initial);
  let current = baseline;
  const listeners = new Set<(settings: UserSettingsV1) => void>();
  const publish = (next: UserSettingsV1): void => {
    current = normalizeUserSettingsV1(next);
    for (const listener of listeners) listener(current);
  };
  return {
    getSnapshot: () => current,
    replace: publish,
    reset: () => publish(baseline),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
