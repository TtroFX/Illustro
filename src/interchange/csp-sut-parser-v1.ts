export const CSP_SUT_PARSER_SCHEMA_V1 = 'illustro.csp-sut-parser/1' as const;
export const CSP_SUT_MAX_SOURCE_BYTES_V1 = 64 * 1024 * 1024;
export const CSP_SUT_MAX_MATERIAL_ROWS_V1 = 64;
export const CSP_SUT_MAX_MATERIAL_BLOB_BYTES_V1 = 32 * 1024 * 1024;
export const CSP_SUT_SQLITE_HEADER_V1 = 'SQLite format 3\u0000' as const;

export type CspSutSqlValueV1 = string | number | Uint8Array | null;
export type CspSutRowV1 = Readonly<Record<string, CspSutSqlValueV1>>;

export interface CspSutSqlExecResultV1 {
  readonly columns: readonly string[];
  readonly values: readonly (readonly CspSutSqlValueV1[])[];
}

export interface CspSutSqlDatabaseV1 {
  exec(sql: string, params?: readonly CspSutSqlValueV1[]): readonly CspSutSqlExecResultV1[];
  close(): void;
}

export interface CspSutSqlModuleV1 {
  readonly Database: new (source: Uint8Array) => CspSutSqlDatabaseV1;
}

export type CspSutSqlInitializerV1 = (options?: {
  readonly locateFile?: (file: string) => string;
}) => Promise<CspSutSqlModuleV1>;

export interface CspSutParsedV1 {
  readonly schema: typeof CSP_SUT_PARSER_SCHEMA_V1;
  readonly sourceByteLength: number;
  readonly tables: readonly string[];
  readonly node: CspSutRowV1;
  readonly variant: CspSutRowV1;
  readonly materials: readonly CspSutRowV1[];
  readonly nodeName: string;
  readonly nodeVariantId: number;
  readonly nodeInitVariantId: number | null;
}

type CspSqlGlobalV1 = typeof globalThis & { readonly initSqlJs?: CspSutSqlInitializerV1 };

let runtimeSqlModulePromiseV1: Promise<CspSutSqlModuleV1> | null = null;

async function runtimeSqlModuleV1(): Promise<CspSutSqlModuleV1> {
  if (runtimeSqlModulePromiseV1 !== null) return runtimeSqlModulePromiseV1;
  const initializer = (globalThis as CspSqlGlobalV1).initSqlJs;
  if (typeof initializer !== 'function') {
    throw new TypeError('CSP SUT SQLite runtime is unavailable');
  }
  runtimeSqlModulePromiseV1 = initializer({
    locateFile: (file) => `./vendor/${file}`,
  });
  try {
    return await runtimeSqlModulePromiseV1;
  } catch (error) {
    runtimeSqlModulePromiseV1 = null;
    throw new TypeError('CSP SUT SQLite runtime failed to initialize', { cause: error });
  }
}

function hasSqliteHeaderV1(source: Uint8Array): boolean {
  if (source.byteLength < CSP_SUT_SQLITE_HEADER_V1.length) return false;
  for (let index = 0; index < CSP_SUT_SQLITE_HEADER_V1.length; index += 1) {
    if (source[index] !== CSP_SUT_SQLITE_HEADER_V1.charCodeAt(index)) return false;
  }
  return true;
}

function checkedSourceV1(source: Uint8Array): Uint8Array {
  if (!(source instanceof Uint8Array)) throw new TypeError('CSP SUT source must be Uint8Array');
  if (source.byteLength < 100) throw new RangeError('CSP SUT SQLite source is truncated');
  if (source.byteLength > CSP_SUT_MAX_SOURCE_BYTES_V1) {
    throw new RangeError('CSP SUT source exceeds the safety limit');
  }
  if (!hasSqliteHeaderV1(source)) throw new TypeError('invalid CSP SUT SQLite header');
  return source.slice();
}

function cloneSqlValueV1(value: CspSutSqlValueV1): CspSutSqlValueV1 {
  return value instanceof Uint8Array ? value.slice() : value;
}

function rowsFromExecV1(results: readonly CspSutSqlExecResultV1[]): readonly CspSutRowV1[] {
  if (results.length === 0) return Object.freeze([]);
  if (results.length !== 1) throw new TypeError('unexpected CSP SUT SQLite result set count');
  const result = results[0];
  if (result === undefined) return Object.freeze([]);
  const rows = result.values.map((values) => {
    if (values.length !== result.columns.length) {
      throw new TypeError('invalid CSP SUT SQLite row width');
    }
    const row: Record<string, CspSutSqlValueV1> = {};
    for (let index = 0; index < result.columns.length; index += 1) {
      const column = result.columns[index];
      const value = values[index];
      if (column === undefined || value === undefined) {
        throw new TypeError('invalid CSP SUT SQLite result value');
      }
      row[column] = cloneSqlValueV1(value);
    }
    return Object.freeze(row);
  });
  return Object.freeze(rows);
}

function queryRowsV1(
  database: CspSutSqlDatabaseV1,
  sql: string,
  params?: readonly CspSutSqlValueV1[],
): readonly CspSutRowV1[] {
  return rowsFromExecV1(database.exec(sql, params));
}

function requiredStringV1(row: CspSutRowV1, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`CSP SUT ${key} is missing or invalid`);
  }
  return value;
}

function requiredIntegerV1(row: CspSutRowV1, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`CSP SUT ${key} is missing or invalid`);
  }
  return value;
}

function optionalIntegerV1(row: CspSutRowV1, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === 0) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`CSP SUT ${key} is invalid`);
  }
  return value;
}

function materialBlobBytesV1(materials: readonly CspSutRowV1[]): number {
  let total = 0;
  for (const row of materials) {
    for (const value of Object.values(row)) {
      if (value instanceof Uint8Array) {
        total += value.byteLength;
        if (total > CSP_SUT_MAX_MATERIAL_BLOB_BYTES_V1) {
          throw new RangeError('CSP SUT material blobs exceed the safety limit');
        }
      }
    }
  }
  return total;
}

export async function parseCspSutV1(
  source: Uint8Array,
  sqlModule?: CspSutSqlModuleV1,
): Promise<CspSutParsedV1> {
  const ownedSource = checkedSourceV1(source);
  const module = sqlModule ?? (await runtimeSqlModuleV1());
  const database = new module.Database(ownedSource);

  try {
    const tableRows = queryRowsV1(
      database,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tables = Object.freeze(
      tableRows
        .map((row) => requiredStringV1(row, 'name'))
        .filter((name, index, all) => all.indexOf(name) === index),
    );
    if (!tables.includes('Node') || !tables.includes('Variant')) {
      throw new TypeError('CSP SUT requires Node and Variant tables');
    }

    const nodeRows = queryRowsV1(
      database,
      'SELECT * FROM "Node" WHERE "NodeVariantId" IS NOT NULL AND "NodeVariantId" != 0 LIMIT 2',
    );
    if (nodeRows.length !== 1) {
      throw new TypeError('CSP SUT must contain exactly one active brush Node');
    }
    const node = nodeRows[0];
    if (node === undefined) throw new TypeError('CSP SUT active brush Node is missing');
    const nodeName = requiredStringV1(node, 'NodeName');
    const nodeVariantId = requiredIntegerV1(node, 'NodeVariantId');
    const nodeInitVariantId = optionalIntegerV1(node, 'NodeInitVariantId');

    const variantRows = queryRowsV1(
      database,
      'SELECT * FROM "Variant" WHERE "VariantId" = ? LIMIT 2',
      [nodeVariantId],
    );
    if (variantRows.length !== 1) {
      throw new TypeError('CSP SUT current Variant row is missing or ambiguous');
    }
    const variant = variantRows[0];
    if (variant === undefined) throw new TypeError('CSP SUT current Variant row is missing');

    const materials = tables.includes('MaterialFile')
      ? queryRowsV1(
          database,
          `SELECT * FROM "MaterialFile" LIMIT ${CSP_SUT_MAX_MATERIAL_ROWS_V1 + 1}`,
        )
      : Object.freeze([]);
    if (materials.length > CSP_SUT_MAX_MATERIAL_ROWS_V1) {
      throw new RangeError('CSP SUT material row count exceeds the safety limit');
    }
    materialBlobBytesV1(materials);

    return Object.freeze({
      schema: CSP_SUT_PARSER_SCHEMA_V1,
      sourceByteLength: ownedSource.byteLength,
      tables,
      node,
      variant,
      materials,
      nodeName,
      nodeVariantId,
      nodeInitVariantId,
    });
  } finally {
    database.close();
  }
}
