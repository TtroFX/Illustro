import { describe, expect, it } from 'vitest';
import {
  assertSupportedMajor,
  assertValueSchema,
  classifyVersionCompatibility,
  deserializeJson,
  parseSchemaVersion,
  serializeJson,
  toJsonValue,
  validateValueSchema,
  type ValueSchemaV1,
} from '../../src/domain/serialization.js';

describe('canonical serialization primitives', () => {
  it('serializes plain JSON state with deterministic key ordering', () => {
    const encoded = serializeJson({ z: 1, a: { y: true, x: 'ok' } });
    expect(encoded).toBe('{"a":{"x":"ok","y":true},"z":1}');
    expect(deserializeJson(encoded)).toEqual({ a: { x: 'ok', y: true }, z: 1 });
  });

  it('rejects values that cannot be canonical JSON state', () => {
    expect(() => toJsonValue({ missing: undefined })).toThrow(TypeError);
    expect(() => toJsonValue(Number.NaN)).toThrow(TypeError);
    expect(() => toJsonValue(new Date())).toThrow(TypeError);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => toJsonValue(cyclic)).toThrow(TypeError);
  });
});

describe('schema validation primitives', () => {
  const schema: ValueSchemaV1 = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['fast', 'quality'] },
      strength: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['mode', 'strength'],
    additionalProperties: false,
  };

  it('returns structured issues and provides a throwing assertion', () => {
    const value = toJsonValue({ mode: 'unknown', strength: 2, extra: true });
    const issues = validateValueSchema(value, schema);

    expect(issues.map((entry) => entry.code).sort()).toEqual([
      'additionalProperty',
      'enum',
      'maximum',
    ]);
    expect(() => assertValueSchema(value, schema)).toThrow(TypeError);
    expect(validateValueSchema(toJsonValue({ mode: 'fast', strength: 0.5 }), schema)).toEqual([]);
  });
});

describe('schema version handling', () => {
  it('parses major.minor versions and classifies compatibility', () => {
    const supported = parseSchemaVersion('1.2');

    expect(classifyVersionCompatibility(parseSchemaVersion('1.2'), supported)).toBe('exact');
    expect(classifyVersionCompatibility(parseSchemaVersion('1.4'), supported)).toBe(
      'compatible-newer-minor',
    );
    expect(classifyVersionCompatibility(parseSchemaVersion('1.1'), supported)).toBe('older');
    expect(classifyVersionCompatibility(parseSchemaVersion('2.0'), supported)).toBe(
      'unsupported-major',
    );
    expect(() => assertSupportedMajor(parseSchemaVersion('2.0'), supported)).toThrow(RangeError);
    expect(() => parseSchemaVersion('1')).toThrow(TypeError);
  });
});
