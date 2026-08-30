import {
  assertValueSchema,
  toJsonValue,
  type JsonValue,
  type ValueSchemaV1,
  type ValidationIssueV1,
  validateValueSchema,
} from './serialization.js';
import { isUuid } from './identity.js';

export const COMMAND_NAMESPACES = [
  'app',
  'project',
  'document',
  'history',
  'clipboard',
  'view',
  'tool',
  'brush',
  'color',
  'selection',
  'transform',
  'layer',
  'mask',
  'vector',
  'text',
  'fill',
  'lineart',
  'effect',
  'asset',
  'action',
  'timelapse',
  'workspace',
  'import',
  'export',
  'recovery',
] as const;

export type CommandNamespace = (typeof COMMAND_NAMESPACES)[number];
declare const commandIdBrand: unique symbol;
declare const commandInvocationIdBrand: unique symbol;
declare const commandTransactionIdBrand: unique symbol;

export type CommandId = string & { readonly [commandIdBrand]: 'CommandId' };
export type CommandInvocationId = string & {
  readonly [commandInvocationIdBrand]: 'CommandInvocationId';
};
export type CommandTransactionId = string & {
  readonly [commandTransactionIdBrand]: 'CommandTransactionId';
};

export type CommandInvocationKind =
  | 'instant'
  | 'toggle'
  | 'tool'
  | 'temporary-tool'
  | 'modal-task'
  | 'parameterized';

export type CommandUndoPolicy =
  | 'none'
  | 'document-transaction'
  | 'workspace-state'
  | 'external-side-effect';
export type CommandSafetyClass = 'ordinary' | 'destructive' | 'external-side-effect';
export type CommandRepeatPolicy = 'none' | 'repeatable' | 'coalesce';

export const COMMAND_CONTEXT_REQUIREMENTS = [
  'project',
  'document',
  'editable-document',
  'active-layer',
  'selection',
  'clipboard-content',
  'full-editor',
  'online',
] as const;

export type CommandContextRequirement = (typeof COMMAND_CONTEXT_REQUIREMENTS)[number];

export interface CommandContextV1 {
  readonly requirements: Readonly<Partial<Record<CommandContextRequirement, boolean>>>;
  readonly facts?: Readonly<Record<string, JsonValue>>;
}

export interface CommandEligibilityV1 {
  readonly quickHole: boolean;
  readonly quickAccess: boolean;
  readonly commandBar: boolean;
  readonly shortcut: boolean;
  readonly stylus: boolean;
  readonly gesture: boolean;
  readonly autoAction: boolean;
}

export interface CommandPredicateResultV1 {
  readonly pass: boolean;
  readonly reasonKey?: string;
}

export type CommandPredicateV1 = (
  context: CommandContextV1,
  args: JsonValue | undefined,
) => boolean | CommandPredicateResultV1;

export interface CommandDefinitionV1 {
  readonly id: CommandId;
  readonly labelKey: string;
  readonly descriptionKey?: string;
  readonly category: string;
  readonly invocationKind: CommandInvocationKind;
  readonly contextRequirements: readonly CommandContextRequirement[];
  readonly undoPolicy: CommandUndoPolicy;
  readonly eligibility: CommandEligibilityV1;
  readonly parameterSchema?: ValueSchemaV1;
  readonly availableWhen?: CommandPredicateV1;
  readonly enabledWhen?: CommandPredicateV1;
  readonly disabledReasonKey?: string;
  readonly safety: CommandSafetyClass;
  readonly repeatPolicy: CommandRepeatPolicy;
}

export type CommandStateV1 =
  | {
      readonly status: 'unavailable';
      readonly reasonKey: string;
    }
  | {
      readonly status: 'disabled';
      readonly reasonKey: string;
    }
  | {
      readonly status: 'enabled';
    };

export interface CommandBindingV1 {
  readonly commandId: CommandId;
  readonly args?: JsonValue;
}

export interface CommandInvocationV1 extends CommandBindingV1 {
  readonly invocationId: CommandInvocationId;
  readonly transactionId: CommandTransactionId | null;
}

export class CommandRegistryError extends Error {
  constructor(
    readonly code:
      | 'duplicate-command'
      | 'unknown-command'
      | 'unavailable'
      | 'disabled'
      | 'invalid-args',
    message: string,
    readonly issues: readonly ValidationIssueV1[] = [],
  ) {
    super(message);
    this.name = 'CommandRegistryError';
  }
}

const COMMAND_SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;

export function parseCommandId(value: unknown): CommandId {
  if (typeof value !== 'string') throw new TypeError('command ID must be a string');
  const segments = value.split('.');
  const namespace = segments[0];
  if (segments.length < 2 || !COMMAND_NAMESPACES.includes(namespace as CommandNamespace)) {
    throw new TypeError('command ID must start with a canonical top-level namespace');
  }
  if (segments.some((segment) => !COMMAND_SEGMENT_PATTERN.test(segment))) {
    throw new TypeError('command ID segments must be locale-neutral identifier tokens');
  }
  return value as CommandId;
}

function createInvocationId(): CommandInvocationId {
  return crypto.randomUUID() as CommandInvocationId;
}

function createTransactionId(): CommandTransactionId {
  return crypto.randomUUID() as CommandTransactionId;
}

export function isCommandInvocationId(value: unknown): value is CommandInvocationId {
  return isUuid(value);
}

export function isCommandTransactionId(value: unknown): value is CommandTransactionId {
  return isUuid(value);
}

function predicateResult(
  predicate: CommandPredicateV1 | undefined,
  context: CommandContextV1,
  args: JsonValue | undefined,
  fallbackReasonKey: string,
): CommandPredicateResultV1 {
  if (predicate === undefined) return { pass: true };
  const result = predicate(context, args);
  return typeof result === 'boolean' ? { pass: result, reasonKey: fallbackReasonKey } : result;
}

function validateDefinition(definition: CommandDefinitionV1): void {
  parseCommandId(definition.id);
  if (definition.labelKey.length === 0) throw new TypeError('command labelKey must not be empty');
  if (definition.category.length === 0) throw new TypeError('command category must not be empty');
  if (definition.invocationKind === 'parameterized' && definition.parameterSchema === undefined) {
    throw new TypeError('parameterized commands require a parameter schema');
  }
}

export class CommandRegistryV1 {
  readonly #definitions = new Map<CommandId, CommandDefinitionV1>();

  register(definition: CommandDefinitionV1): void {
    validateDefinition(definition);
    if (this.#definitions.has(definition.id)) {
      throw new CommandRegistryError(
        'duplicate-command',
        `command already registered: ${definition.id}`,
      );
    }
    this.#definitions.set(definition.id, Object.freeze(definition));
  }

  registerMany(definitions: readonly CommandDefinitionV1[]): void {
    for (const definition of definitions) this.register(definition);
  }

  has(commandId: CommandId): boolean {
    return this.#definitions.has(commandId);
  }

  get(commandId: CommandId): CommandDefinitionV1 {
    const definition = this.#definitions.get(commandId);
    if (definition === undefined) {
      throw new CommandRegistryError('unknown-command', `unknown command: ${commandId}`);
    }
    return definition;
  }

  list(): readonly CommandDefinitionV1[] {
    return Object.freeze(
      [...this.#definitions.values()].sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  evaluate(binding: CommandBindingV1, context: CommandContextV1): CommandStateV1 {
    const definition = this.get(binding.commandId);
    const args = this.normalizeArgs(definition, binding.args);

    for (const requirement of definition.contextRequirements) {
      if (context.requirements[requirement] !== true) {
        return Object.freeze({
          status: 'unavailable',
          reasonKey: `command.context.${requirement}`,
        });
      }
    }

    const availability = predicateResult(
      definition.availableWhen,
      context,
      args,
      'command.unavailable',
    );
    if (!availability.pass) {
      return Object.freeze({
        status: 'unavailable',
        reasonKey: availability.reasonKey ?? 'command.unavailable',
      });
    }

    const enabled = predicateResult(
      definition.enabledWhen,
      context,
      args,
      definition.disabledReasonKey ?? 'command.disabled',
    );
    if (!enabled.pass) {
      return Object.freeze({
        status: 'disabled',
        reasonKey: enabled.reasonKey ?? definition.disabledReasonKey ?? 'command.disabled',
      });
    }

    return Object.freeze({ status: 'enabled' });
  }

  createInvocation(binding: CommandBindingV1, context: CommandContextV1): CommandInvocationV1 {
    const definition = this.get(binding.commandId);
    const args = this.normalizeArgs(definition, binding.args);
    const state = this.evaluate(
      args === undefined
        ? { commandId: binding.commandId }
        : { commandId: binding.commandId, args },
      context,
    );

    if (state.status !== 'enabled') {
      throw new CommandRegistryError(
        state.status,
        `${binding.commandId} is ${state.status}: ${state.reasonKey}`,
      );
    }

    const transactionId =
      definition.undoPolicy === 'document-transaction' ? createTransactionId() : null;

    return Object.freeze({
      commandId: binding.commandId,
      ...(args === undefined ? {} : { args }),
      invocationId: createInvocationId(),
      transactionId,
    });
  }

  private normalizeArgs(
    definition: CommandDefinitionV1,
    args: JsonValue | undefined,
  ): JsonValue | undefined {
    if (definition.parameterSchema === undefined) {
      if (args !== undefined) {
        throw new CommandRegistryError(
          'invalid-args',
          `${definition.id} does not accept arguments`,
        );
      }
      return undefined;
    }

    if (args === undefined) {
      throw new CommandRegistryError('invalid-args', `${definition.id} requires arguments`);
    }

    const normalized = toJsonValue(args);
    const issues = validateValueSchema(normalized, definition.parameterSchema);
    if (issues.length > 0) {
      throw new CommandRegistryError(
        'invalid-args',
        `invalid arguments for ${definition.id}`,
        issues,
      );
    }
    assertValueSchema(normalized, definition.parameterSchema);
    return normalized;
  }
}

export function createCommandDefinition(
  input: Omit<CommandDefinitionV1, 'id'> & { readonly id: string },
): CommandDefinitionV1 {
  const definition = {
    ...input,
    id: parseCommandId(input.id),
    contextRequirements: Object.freeze([...input.contextRequirements]),
    eligibility: Object.freeze({ ...input.eligibility }),
  } as CommandDefinitionV1;
  validateDefinition(definition);
  return Object.freeze(definition);
}
