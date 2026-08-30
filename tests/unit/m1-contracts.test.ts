import { describe, expect, it } from 'vitest';
import { isLocaleNeutralInternalId, parseInternalId } from '../../src/domain/internal-id.js';
import { createMigrationStep, MigrationRegistryV1 } from '../../src/domain/migration.js';
import {
  createCompatibilityReport,
  createFidelityReport,
  createStructuredErrorRecord,
  createStructuredReportIssue,
} from '../../src/domain/reports.js';
import { parseSchemaVersion, serializeJson } from '../../src/domain/serialization.js';

describe('locale-neutral internal ID policy', () => {
  it('accepts stable ASCII identifiers and rejects localized/display text', () => {
    expect(isLocaleNeutralInternalId('lineart.boundary-connect')).toBe(true);
    expect(isLocaleNeutralInternalId('tool.toggleBrushEraser')).toBe(true);
    expect(isLocaleNeutralInternalId('線画.接続')).toBe(false);
    expect(isLocaleNeutralInternalId('tool brush')).toBe(false);
    expect(() => parseInternalId('tool/brush')).toThrow(TypeError);
  });
});

describe('migration framework', () => {
  it('runs explicit deterministic steps without mutating the source value', () => {
    const registry = new MigrationRegistryV1();
    registry.registerMany([
      createMigrationStep({
        id: 'migration.document.v1-0-to-v1-1',
        from: parseSchemaVersion('1.0'),
        to: parseSchemaVersion('1.1'),
        migrate: (input) => ({ ...(input as Record<string, never>), migrated: true }),
      }),
      createMigrationStep({
        id: 'migration.document.v1-1-to-v1-2',
        from: parseSchemaVersion('1.1'),
        to: parseSchemaVersion('1.2'),
        migrate: (input) => ({ ...(input as Record<string, never>), version: '1.2' }),
      }),
    ]);
    const source = { value: 1 };
    const before = JSON.stringify(source);
    const result = registry.migrate(source, parseSchemaVersion('1.0'), parseSchemaVersion('1.2'));

    expect(JSON.stringify(source)).toBe(before);
    expect(serializeJson(result.value)).toBe('{"migrated":true,"value":1,"version":"1.2"}');
    expect(result.appliedStepIds).toHaveLength(2);
  });

  it('rejects nondeterministic and cross-major migration behavior', () => {
    expect(() =>
      createMigrationStep({
        id: 'migration.invalid',
        from: parseSchemaVersion('1.0'),
        to: parseSchemaVersion('2.0'),
        migrate: (input) => input,
      }),
    ).toThrow(RangeError);

    const registry = new MigrationRegistryV1();
    let counter = 0;
    registry.register(
      createMigrationStep({
        id: 'migration.nondeterministic',
        from: parseSchemaVersion('1.0'),
        to: parseSchemaVersion('1.1'),
        migrate: () => ({ counter: counter++ }),
      }),
    );
    expect(() =>
      registry.migrate({}, parseSchemaVersion('1.0'), parseSchemaVersion('1.1')),
    ).toThrow(TypeError);
  });
});

describe('structured compatibility, fidelity, and error reports', () => {
  it('derives writable and fidelity state from structured issues', () => {
    const lossy = createStructuredReportIssue({
      code: 'compat.psd.layerStyleRasterized',
      severity: 'lossy',
      sourcePath: 'layers/4',
      sourceFeature: 'photoshop-layer-style',
      mapping: 'rasterized',
      resultingPath: 'layers/4',
      messageKey: 'compat.psd.layerStyleRasterized.message',
      details: { effect: 'bevel' },
    });
    const unsupported = createStructuredReportIssue({
      code: 'compat.psd.smartObjectUnsupported',
      severity: 'unsupported',
      sourceFeature: 'smart-object-live-link',
      mapping: 'rejected',
      messageKey: 'compat.psd.smartObjectUnsupported.message',
    });

    expect(createCompatibilityReport({ sourceFormat: 'psd', issues: [lossy] })).toMatchObject({
      writable: true,
      requiresUserAcceptance: true,
    });
    expect(createCompatibilityReport({ sourceFormat: 'psd', issues: [unsupported] }).writable).toBe(
      false,
    );
    expect(
      createFidelityReport({ direction: 'import', format: 'psd', issues: [lossy] }),
    ).toMatchObject({
      exact: false,
      hasLoss: true,
    });
  });

  it('keeps runtime errors machine-readable and localization-neutral', () => {
    const error = createStructuredErrorRecord({
      code: 'storage.project.writeFailed',
      severity: 'error',
      operation: 'storage.project.write',
      messageKey: 'error.storage.project.writeFailed',
      recoverability: 'retryable',
      details: { phase: 'checkpoint' },
    });
    expect(error).toMatchObject({
      schema: 'illustro.error/1',
      recoverability: 'retryable',
      causeCode: null,
    });
  });
});
