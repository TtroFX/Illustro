import { describe, expect, it } from 'vitest';
import {
  CommandRegistryError,
  CommandRegistryV1,
  createCommandDefinition,
  isCommandInvocationId,
  isCommandTransactionId,
  parseCommandId,
} from '../../src/domain/command-registry.js';

const ELIGIBILITY = Object.freeze({
  quickHole: true,
  quickAccess: true,
  commandBar: true,
  shortcut: true,
  stylus: true,
  gesture: false,
  autoAction: true,
});

const DOCUMENT_CONTEXT = Object.freeze({
  requirements: Object.freeze({
    project: true,
    document: true,
    'editable-document': true,
    'active-layer': true,
    selection: false,
    'clipboard-content': false,
    'full-editor': true,
    online: true,
  }),
});

describe('command ID contract', () => {
  it('accepts canonical namespaces and rejects non-canonical IDs', () => {
    expect(parseCommandId('history.undo')).toBe('history.undo');
    expect(parseCommandId('recovery.restoreCheckpoint')).toBe('recovery.restoreCheckpoint');
    expect(() => parseCommandId('custom.undo')).toThrow(TypeError);
    expect(() => parseCommandId('history')).toThrow(TypeError);
  });
});

describe('canonical command registry', () => {
  it('registers one definition per stable ID and lists deterministically', () => {
    const registry = new CommandRegistryV1();
    const undo = createCommandDefinition({
      id: 'history.undo',
      labelKey: 'command.history.undo',
      category: 'history',
      invocationKind: 'instant',
      contextRequirements: ['document'],
      undoPolicy: 'none',
      eligibility: ELIGIBILITY,
      safety: 'ordinary',
      repeatPolicy: 'repeatable',
    });
    registry.register(undo);

    expect(registry.get(undo.id)).toBe(undo);
    expect(registry.list().map((entry) => entry.id)).toEqual(['history.undo']);
    expect(() => registry.register(undo)).toThrow(CommandRegistryError);
  });

  it('separates unavailable and disabled command state', () => {
    const registry = new CommandRegistryV1();
    const command = createCommandDefinition({
      id: 'layer.delete',
      labelKey: 'command.layer.delete',
      category: 'layer',
      invocationKind: 'instant',
      contextRequirements: ['document', 'active-layer'],
      undoPolicy: 'document-transaction',
      eligibility: ELIGIBILITY,
      enabledWhen: (context) => ({
        pass: context.facts?.locked !== true,
        reasonKey: 'command.layer.locked',
      }),
      safety: 'destructive',
      repeatPolicy: 'none',
    });
    registry.register(command);

    expect(
      registry.evaluate(
        { commandId: command.id },
        { requirements: { document: true, 'active-layer': false } },
      ),
    ).toEqual({ status: 'unavailable', reasonKey: 'command.context.active-layer' });

    expect(
      registry.evaluate(
        { commandId: command.id },
        { ...DOCUMENT_CONTEXT, facts: { locked: true } },
      ),
    ).toEqual({ status: 'disabled', reasonKey: 'command.layer.locked' });
  });

  it('validates parameterized bindings and gives document transactions stable UUID identities', () => {
    const registry = new CommandRegistryV1();
    const resize = createCommandDefinition({
      id: 'document.resize',
      labelKey: 'command.document.resize',
      category: 'document',
      invocationKind: 'parameterized',
      contextRequirements: ['editable-document'],
      undoPolicy: 'document-transaction',
      eligibility: ELIGIBILITY,
      parameterSchema: {
        type: 'object',
        properties: {
          width: { type: 'integer', minimum: 1 },
          height: { type: 'integer', minimum: 1 },
        },
        required: ['width', 'height'],
        additionalProperties: false,
      },
      safety: 'ordinary',
      repeatPolicy: 'coalesce',
    });
    registry.register(resize);

    const invocation = registry.createInvocation(
      { commandId: resize.id, args: { width: 1920, height: 1080 } },
      DOCUMENT_CONTEXT,
    );

    expect(isCommandInvocationId(invocation.invocationId)).toBe(true);
    expect(isCommandTransactionId(invocation.transactionId)).toBe(true);
    expect(invocation.args).toEqual({ height: 1080, width: 1920 });

    expect(() =>
      registry.createInvocation(
        { commandId: resize.id, args: { width: 0, height: 1080 } },
        DOCUMENT_CONTEXT,
      ),
    ).toThrow(CommandRegistryError);
  });

  it('does not create a document transaction identity for workspace-state commands', () => {
    const registry = new CommandRegistryV1();
    const command = createCommandDefinition({
      id: 'workspace.reset',
      labelKey: 'command.workspace.reset',
      category: 'workspace',
      invocationKind: 'instant',
      contextRequirements: [],
      undoPolicy: 'workspace-state',
      eligibility: ELIGIBILITY,
      safety: 'ordinary',
      repeatPolicy: 'none',
    });
    registry.register(command);

    expect(registry.createInvocation({ commandId: command.id }, DOCUMENT_CONTEXT).transactionId).toBeNull();
  });
});
