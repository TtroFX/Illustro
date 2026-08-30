export type JsonPrimitive = null | boolean | number | string;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface ValidationIssueV1 {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type ValueSchemaV1 =
  | {
      readonly type: 'null';
    }
  | {
      readonly type: 'boolean';
    }
  | {
      readonly type: 'string';
      readonly enum?: readonly string[];
      readonly minLength?: number;
      readonly maxLength?: number;
    }
  | {
      readonly type: 'number' | 'integer';
      readonly minimum?: number;
      readonly maximum?: number;
    }
  | {
      readonly type: 'array';
      readonly items: ValueSchemaV1;
      readonly minItems?: number;
      readonly maxItems?: number;
    }
  | {
      readonly type: 'object';
      readonly properties: Readonly<Record<string, ValueSchemaV1>>;
      readonly required?: readonly string[];
      readonly additionalProperties?: boolean;
    };

export interface SchemaVersionV1 {
  readonly major: number;
  readonly minor: number;
}

export type VersionCompatibilityV1 =
  | 'exact'
  | 'compatible-newer-minor'
  | 'older'
  | 'unsupported-major';

function isPlainRecord(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeJsonValue(value: unknown, seen: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite');
    return value;
  }

  if (typeof value !== 'object') {
    throw new TypeError(`value of type ${typeof value} is not JSON-serializable`);
  }

  if (seen.has(value)) throw new TypeError('cyclic values are not JSON-serializable');
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => normalizeJsonValue(item, seen)));
    }

    if (!isPlainRecord(value)) {
      throw new TypeError('only plain records and arrays are JSON-serializable');
    }

    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) throw new TypeError(`property ${key} is undefined`);
      output[key] = normalizeJsonValue(item, seen);
    }
    return Object.freeze(output);
  } finally {
    seen.delete(value);
  }
}

export function toJsonValue(value: unknown): JsonValue {
  return normalizeJsonValue(value, new Set<object>());
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(toJsonValue(value));
}

export function deserializeJson(text: string): JsonValue {
  return toJsonValue(JSON.parse(text) as unknown);
}

function issue(path: string, code: string, message: string): ValidationIssueV1 {
  return Object.freeze({ path, code, message });
}

export function validateValueSchema(
  value: JsonValue,
  schema: ValueSchemaV1,
  path = '$',
): readonly ValidationIssueV1[] {
  const issues: ValidationIssueV1[] = [];

  switch (schema.type) {
    case 'null':
      if (value !== null) issues.push(issue(path, 'type', 'expected null'));
      break;
    case 'boolean':
      if (typeof value !== 'boolean') issues.push(issue(path, 'type', 'expected boolean'));
      break;
    case 'string':
      if (typeof value !== 'string') {
        issues.push(issue(path, 'type', 'expected string'));
        break;
      }
      if (schema.enum !== undefined && !schema.enum.includes(value)) {
        issues.push(issue(path, 'enum', 'value is not in the allowed set'));
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        issues.push(
          issue(path, 'minLength', `string must contain at least ${schema.minLength} characters`),
        );
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        issues.push(
          issue(path, 'maxLength', `string must contain at most ${schema.maxLength} characters`),
        );
      }
      break;
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push(issue(path, 'type', `expected ${schema.type}`));
        break;
      }
      if (schema.type === 'integer' && !Number.isSafeInteger(value)) {
        issues.push(issue(path, 'integer', 'expected a safe integer'));
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        issues.push(issue(path, 'minimum', `value must be at least ${schema.minimum}`));
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        issues.push(issue(path, 'maximum', `value must be at most ${schema.maximum}`));
      }
      break;
    }
    case 'array':
      if (!Array.isArray(value)) {
        issues.push(issue(path, 'type', 'expected array'));
        break;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        issues.push(
          issue(path, 'minItems', `array must contain at least ${schema.minItems} items`),
        );
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        issues.push(issue(path, 'maxItems', `array must contain at most ${schema.maxItems} items`));
      }
      for (const [index, item] of value.entries()) {
        issues.push(...validateValueSchema(item, schema.items, `${path}[${index}]`));
      }
      break;
    case 'object': {
      if (value === null || Array.isArray(value) || typeof value !== 'object') {
        issues.push(issue(path, 'type', 'expected object'));
        break;
      }
      const record = value as Readonly<Record<string, JsonValue>>;
      for (const required of schema.required ?? []) {
        if (!(required in record))
          issues.push(issue(`${path}.${required}`, 'required', 'required property is missing'));
      }
      for (const [key, item] of Object.entries(record)) {
        const propertySchema = schema.properties[key];
        if (propertySchema === undefined) {
          if (schema.additionalProperties !== true) {
            issues.push(
              issue(`${path}.${key}`, 'additionalProperty', 'unknown property is not allowed'),
            );
          }
          continue;
        }
        issues.push(...validateValueSchema(item, propertySchema, `${path}.${key}`));
      }
      break;
    }
  }

  return Object.freeze(issues);
}

export function assertValueSchema(value: JsonValue, schema: ValueSchemaV1): void {
  const issues = validateValueSchema(value, schema);
  if (issues.length === 0) return;
  const first = issues[0];
  throw new TypeError(
    `schema validation failed at ${first?.path ?? '$'}: ${first?.message ?? 'invalid value'}`,
  );
}

export function parseSchemaVersion(value: string): SchemaVersionV1 {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(value);
  if (match === null) throw new TypeError('schema version must use major.minor decimal notation');
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) {
    throw new RangeError('schema version components must be safe integers');
  }
  return Object.freeze({ major, minor });
}

export function formatSchemaVersion(version: SchemaVersionV1): string {
  if (!Number.isSafeInteger(version.major) || version.major < 0)
    throw new RangeError('major version must be a non-negative safe integer');
  if (!Number.isSafeInteger(version.minor) || version.minor < 0)
    throw new RangeError('minor version must be a non-negative safe integer');
  return `${version.major}.${version.minor}`;
}

export function classifyVersionCompatibility(
  found: SchemaVersionV1,
  supported: SchemaVersionV1,
): VersionCompatibilityV1 {
  if (found.major !== supported.major) return 'unsupported-major';
  if (found.minor === supported.minor) return 'exact';
  return found.minor > supported.minor ? 'compatible-newer-minor' : 'older';
}

export function assertSupportedMajor(found: SchemaVersionV1, supported: SchemaVersionV1): void {
  if (found.major !== supported.major) {
    throw new RangeError(
      `unsupported schema major ${found.major}; supported major is ${supported.major}`,
    );
  }
}
