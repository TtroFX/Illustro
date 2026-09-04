import type { PointerInputBatchV1, PointerInputSampleV1 } from './pointer-input.js';

export const PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1 = 2;
export const DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1 = 'tool.eyedropper.temporary' as const;

export type CommandBindingArgumentV1 = string | number | boolean | null;

export interface CommandBindingV1 {
  readonly commandId: string;
  readonly args?: Readonly<Record<string, CommandBindingArgumentV1>>;
}

export type StylusButtonSlotV1 = 'barrel-primary';
export type StylusButtonPhaseV1 = 'pressed' | 'released';

export interface StylusButtonTransitionV1 {
  readonly schema: 'illustro.stylus-button-transition/1';
  readonly pointerId: number;
  readonly slot: StylusButtonSlotV1;
  readonly phase: StylusButtonPhaseV1;
}

export interface StylusButtonRouterSnapshotV1 {
  readonly schema: 'illustro.stylus-button-router/1';
  readonly primaryBarrelHeldPointers: number;
}

function normalizeCommandIdV1(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('command binding id must be a string');
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 160) {
    throw new RangeError('command binding id must contain 1..160 characters');
  }
  return normalized;
}

function normalizeCommandArgsV1(
  value: unknown,
): Readonly<Record<string, CommandBindingArgumentV1>> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('command binding args must be a flat object');
  }
  const result: Record<string, CommandBindingArgumentV1> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.length < 1 || key.length > 80)
      throw new RangeError('command binding arg key is invalid');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'boolean' &&
      !(typeof entry === 'number' && Number.isFinite(entry))
    ) {
      throw new TypeError('command binding arg values must be finite primitive JSON values');
    }
    result[key] = entry as CommandBindingArgumentV1;
  }
  return Object.keys(result).length === 0 ? undefined : Object.freeze(result);
}

export function createCommandBindingV1(
  commandId: string,
  args?: Readonly<Record<string, CommandBindingArgumentV1>>,
): CommandBindingV1 {
  const normalizedArgs = normalizeCommandArgsV1(args);
  return Object.freeze({
    commandId: normalizeCommandIdV1(commandId),
    ...(normalizedArgs === undefined ? {} : { args: normalizedArgs }),
  });
}

export function parseCommandBindingV1(value: unknown): CommandBindingV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('command binding must be an object');
  }
  const record = value as { readonly commandId?: unknown; readonly args?: unknown };
  return createCommandBindingV1(
    normalizeCommandIdV1(record.commandId),
    normalizeCommandArgsV1(record.args),
  );
}

export const DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1: CommandBindingV1 = createCommandBindingV1(
  DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
);

function transitionV1(pointerId: number, phase: StylusButtonPhaseV1): StylusButtonTransitionV1 {
  return Object.freeze({
    schema: 'illustro.stylus-button-transition/1' as const,
    pointerId,
    slot: 'barrel-primary' as const,
    phase,
  });
}

function primaryBarrelHeldV1(sample: PointerInputSampleV1): boolean {
  return (sample.buttons & PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1) !== 0;
}

export class StylusButtonStateRouterV1 {
  readonly #primaryBarrelHeldPointers = new Set<number>();

  route(batch: PointerInputBatchV1): readonly StylusButtonTransitionV1[] {
    const transitions: StylusButtonTransitionV1[] = [];
    for (const sample of batch.confirmed) {
      if (sample.source !== 'pen') continue;
      const wasHeld = this.#primaryBarrelHeldPointers.has(sample.pointerId);
      const isHeld = primaryBarrelHeldV1(sample);
      if (isHeld === wasHeld) continue;
      if (isHeld) this.#primaryBarrelHeldPointers.add(sample.pointerId);
      else this.#primaryBarrelHeldPointers.delete(sample.pointerId);
      transitions.push(transitionV1(sample.pointerId, isHeld ? 'pressed' : 'released'));
    }

    if (
      (batch.eventType === 'pointerup' || batch.eventType === 'pointercancel') &&
      this.#primaryBarrelHeldPointers.delete(batch.pointerId)
    ) {
      transitions.push(transitionV1(batch.pointerId, 'released'));
    }
    return Object.freeze(transitions);
  }

  releaseAll(): readonly StylusButtonTransitionV1[] {
    const transitions = [...this.#primaryBarrelHeldPointers]
      .sort((a, b) => a - b)
      .map((pointerId) => transitionV1(pointerId, 'released'));
    this.#primaryBarrelHeldPointers.clear();
    return Object.freeze(transitions);
  }

  snapshot(): StylusButtonRouterSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.stylus-button-router/1' as const,
      primaryBarrelHeldPointers: this.#primaryBarrelHeldPointers.size,
    });
  }
}
