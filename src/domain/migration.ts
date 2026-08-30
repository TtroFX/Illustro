import { parseInternalId, type InternalId } from './internal-id.js';
import {
  deserializeJson,
  formatSchemaVersion,
  serializeJson,
  toJsonValue,
  type JsonValue,
  type SchemaVersionV1,
} from './serialization.js';

export interface MigrationStepV1 {
  readonly id: InternalId;
  readonly from: SchemaVersionV1;
  readonly to: SchemaVersionV1;
  readonly migrate: (input: JsonValue) => JsonValue;
}

export interface MigrationResultV1 {
  readonly from: SchemaVersionV1;
  readonly to: SchemaVersionV1;
  readonly appliedStepIds: readonly InternalId[];
  readonly value: JsonValue;
}

function compareVersions(left: SchemaVersionV1, right: SchemaVersionV1): number {
  return left.major === right.major ? left.minor - right.minor : left.major - right.major;
}

function versionKey(version: SchemaVersionV1): string {
  return formatSchemaVersion(version);
}

export function createMigrationStep(input: {
  id: string;
  from: SchemaVersionV1;
  to: SchemaVersionV1;
  migrate: (input: JsonValue) => JsonValue;
}): MigrationStepV1 {
  if (input.from.major !== input.to.major || compareVersions(input.from, input.to) >= 0) {
    throw new RangeError('migration steps must move forward within one schema major');
  }
  return Object.freeze({
    id: parseInternalId(input.id, 'migration step ID'),
    from: Object.freeze({ ...input.from }),
    to: Object.freeze({ ...input.to }),
    migrate: input.migrate,
  });
}

export class MigrationRegistryV1 {
  readonly #stepsBySource = new Map<string, MigrationStepV1>();

  register(step: MigrationStepV1): void {
    const key = versionKey(step.from);
    if (this.#stepsBySource.has(key)) {
      throw new TypeError(`a migration is already registered from ${key}`);
    }
    this.#stepsBySource.set(key, step);
  }

  registerMany(steps: readonly MigrationStepV1[]): void {
    for (const step of steps) this.register(step);
  }

  migrate(input: unknown, from: SchemaVersionV1, target: SchemaVersionV1): MigrationResultV1 {
    if (from.major !== target.major) {
      throw new RangeError('migration cannot cross schema major versions');
    }
    if (compareVersions(from, target) > 0) {
      throw new RangeError('migration target must not be older than source');
    }

    let currentVersion = Object.freeze({ ...from });
    let currentValue = toJsonValue(input);
    const appliedStepIds: InternalId[] = [];

    while (compareVersions(currentVersion, target) < 0) {
      const step = this.#stepsBySource.get(versionKey(currentVersion));
      if (step === undefined) {
        throw new RangeError(`no migration path from ${versionKey(currentVersion)}`);
      }
      if (compareVersions(step.to, target) > 0) {
        throw new RangeError(`migration ${step.id} overshoots target ${versionKey(target)}`);
      }

      const immutableInputText = serializeJson(currentValue);
      const first = toJsonValue(step.migrate(deserializeJson(immutableInputText)));
      const second = toJsonValue(step.migrate(deserializeJson(immutableInputText)));
      const firstText = serializeJson(first);
      if (firstText !== serializeJson(second)) {
        throw new TypeError(`migration ${step.id} is not deterministic for the supplied input`);
      }

      currentValue = deserializeJson(firstText);
      currentVersion = step.to;
      appliedStepIds.push(step.id);
    }

    return Object.freeze({
      from: Object.freeze({ ...from }),
      to: Object.freeze({ ...target }),
      appliedStepIds: Object.freeze(appliedStepIds),
      value: currentValue,
    });
  }
}
