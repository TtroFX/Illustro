import { describe, expect, it } from 'vitest';
import {
  CSP_SUT_MAX_MATERIAL_BLOB_BYTES_V1,
  CSP_SUT_MAX_SOURCE_BYTES_V1,
  CSP_SUT_SQLITE_HEADER_V1,
  parseCspSutV1,
  type CspSutSqlDatabaseV1,
  type CspSutSqlExecResultV1,
  type CspSutSqlModuleV1,
  type CspSutSqlValueV1,
} from '../../src/interchange/csp-sut-parser-v1.js';

function sutSourceV1(size = 512): Uint8Array {
  const source = new Uint8Array(size);
  for (let index = 0; index < CSP_SUT_SQLITE_HEADER_V1.length; index += 1) {
    source[index] = CSP_SUT_SQLITE_HEADER_V1.charCodeAt(index);
  }
  return source;
}

function resultV1(
  columns: readonly string[],
  values: readonly (readonly CspSutSqlValueV1[])[],
): readonly CspSutSqlExecResultV1[] {
  return [{ columns, values }];
}

function fakeModuleV1(
  input: {
    readonly tables?: readonly string[];
    readonly nodeRows?: readonly (readonly CspSutSqlValueV1[])[];
    readonly variantRows?: readonly (readonly CspSutSqlValueV1[])[];
    readonly materialRows?: readonly (readonly CspSutSqlValueV1[])[];
    readonly onSource?: (source: Uint8Array) => void;
    readonly onClose?: () => void;
  } = {},
): CspSutSqlModuleV1 {
  const tables = input.tables ?? ['MaterialFile', 'Node', 'Variant'];
  const nodeRows = input.nodeRows ?? [['Synthetic CSP Brush', 42, 7, 1]];
  const variantRows = input.variantRows ?? [[42, 55, 0.75, Uint8Array.from([1, 2, 3, 4])]];
  const materialRows = input.materialRows ?? [[1, 'tip', Uint8Array.from([9, 8, 7])]];

  class FakeDatabase implements CspSutSqlDatabaseV1 {
    constructor(source: Uint8Array) {
      input.onSource?.(source);
    }

    exec(sql: string, params?: readonly CspSutSqlValueV1[]) {
      if (sql.includes('sqlite_master')) {
        return resultV1(
          ['name'],
          tables.map((table) => [table]),
        );
      }
      if (sql.includes('FROM "Node"')) {
        return resultV1(['NodeName', 'NodeVariantId', 'NodeInitVariantId', '_PW_ID'], nodeRows);
      }
      if (sql.includes('FROM "Variant"')) {
        expect(params).toEqual([42]);
        return resultV1(['VariantId', 'BrushSize', 'Opacity', 'SizeEffector'], variantRows);
      }
      if (sql.includes('FROM "MaterialFile"')) {
        return resultV1(['_PW_ID', 'MaterialName', 'FileData'], materialRows);
      }
      throw new Error(`unexpected SQL: ${sql}`);
    }

    close(): void {
      input.onClose?.();
    }
  }

  return { Database: FakeDatabase };
}

describe('M6B-008 CSP SUT parser', () => {
  it('discovers dynamic tables and stages the active Node, Variant and MaterialFile rows', async () => {
    let closed = false;
    const parsed = await parseCspSutV1(
      sutSourceV1(),
      fakeModuleV1({ onClose: () => (closed = true) }),
    );

    expect(parsed).toMatchObject({
      schema: 'illustro.csp-sut-parser/1',
      sourceByteLength: 512,
      tables: ['MaterialFile', 'Node', 'Variant'],
      nodeName: 'Synthetic CSP Brush',
      nodeVariantId: 42,
      nodeInitVariantId: 7,
      node: {
        NodeName: 'Synthetic CSP Brush',
        NodeVariantId: 42,
        NodeInitVariantId: 7,
      },
      variant: {
        VariantId: 42,
        BrushSize: 55,
        Opacity: 0.75,
      },
    });
    expect(parsed.variant.SizeEffector).toEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(parsed.materials[0]?.FileData).toEqual(Uint8Array.from([9, 8, 7]));
    expect(closed).toBe(true);
  });

  it('copies the source and returned BLOBs so caller mutation cannot rewrite staged data', async () => {
    const source = sutSourceV1();
    const variantBlob = Uint8Array.from([4, 5, 6]);
    const materialBlob = Uint8Array.from([7, 8, 9]);
    let databaseSource: Uint8Array | null = null;
    const parsed = await parseCspSutV1(
      source,
      fakeModuleV1({
        variantRows: [[42, 10, 1, variantBlob]],
        materialRows: [[1, 'tip', materialBlob]],
        onSource: (value) => (databaseSource = value),
      }),
    );

    source.fill(255);
    variantBlob.fill(0);
    materialBlob.fill(0);
    expect(databaseSource?.[0]).toBe(CSP_SUT_SQLITE_HEADER_V1.charCodeAt(0));
    expect(parsed.variant.SizeEffector).toEqual(Uint8Array.from([4, 5, 6]));
    expect(parsed.materials[0]?.FileData).toEqual(Uint8Array.from([7, 8, 9]));
  });

  it('fails closed when the SQLite signature or required Node/Variant schema is missing', async () => {
    await expect(parseCspSutV1(new Uint8Array(512), fakeModuleV1())).rejects.toThrow(
      'SQLite header',
    );
    await expect(parseCspSutV1(sutSourceV1(), fakeModuleV1({ tables: ['Node'] }))).rejects.toThrow(
      'Node and Variant',
    );
  });

  it('requires one active brush Node and its current Variant row', async () => {
    await expect(
      parseCspSutV1(
        sutSourceV1(),
        fakeModuleV1({
          nodeRows: [
            ['One', 42, 7, 1],
            ['Two', 43, 8, 2],
          ],
        }),
      ),
    ).rejects.toThrow('exactly one active brush Node');

    await expect(parseCspSutV1(sutSourceV1(), fakeModuleV1({ variantRows: [] }))).rejects.toThrow(
      'Variant row',
    );
  });

  it('rejects oversized source files and material BLOB budgets before unsafe staging', async () => {
    const oversized = sutSourceV1(CSP_SUT_MAX_SOURCE_BYTES_V1 + 1);
    await expect(parseCspSutV1(oversized, fakeModuleV1())).rejects.toThrow('safety limit');

    const materialBlob = new Uint8Array(CSP_SUT_MAX_MATERIAL_BLOB_BYTES_V1 + 1);
    await expect(
      parseCspSutV1(
        sutSourceV1(),
        fakeModuleV1({ materialRows: [[1, 'too-large', materialBlob]] }),
      ),
    ).rejects.toThrow('material blobs exceed');
  });
});
