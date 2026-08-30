import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultUserSettingsV1,
  createDefaultWorkspaceStateV1,
  createUserSettingsStoreV1,
  normalizeWorkspaceStateV1,
  QUICK_HOLE_SLOT_COUNT,
} from '../../src/domain/workspace-settings.js';

describe('workspace state schema', () => {
  it('persists inspector geometry, dock state, and six canonical Quick Hole bindings', () => {
    const workspace = createDefaultWorkspaceStateV1();
    expect(workspace.schema).toBe('illustro.workspace/1');
    expect(workspace.layout.dockedBlockOrder).toContain('inspector.layers');
    expect(workspace.quickHole.slots).toHaveLength(QUICK_HOLE_SLOT_COUNT);
    expect(workspace.quickHole.slots.map((slot) => slot.commandId)).toEqual([
      'history.undo',
      'history.redo',
      'tool.toggleBrushEraser',
      'tool.activate',
      'tool.activate',
      'tool.activate',
    ]);
  });

  it('rejects impossible dock duplication and unusable geometry', () => {
    const baseline = createDefaultWorkspaceStateV1();
    expect(() =>
      normalizeWorkspaceStateV1({
        ...baseline,
        layout: {
          ...baseline.layout,
          detachedBlocks: [
            {
              blockId: baseline.layout.dockedBlockOrder[0]!,
              x: 0,
              y: 0,
              width: 200,
              height: 200,
            },
          ],
        },
      }),
    ).toThrow(TypeError);
  });
});

describe('user settings schema', () => {
  it('provides resettable user preferences outside document state', () => {
    const baseline = createDefaultUserSettingsV1();
    const store = createUserSettingsStoreV1(baseline);
    const listener = vi.fn();
    store.subscribe(listener);

    store.replace({
      ...baseline,
      power: { requestWakeLockWhileDrawing: true },
    });
    expect(store.getSnapshot().power.requestWakeLockWhileDrawing).toBe(true);

    store.reset();
    expect(store.getSnapshot()).toEqual(baseline);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
