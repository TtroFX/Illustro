import { describe, expect, it } from 'vitest';
import type { CspSutParsedV1 } from '../../src/interchange/csp-sut-parser-v1.js';
import { mapCspBrushToIllustroV1 } from '../../src/interchange/csp-brush-mapper-v1.js';
import {
  createCspBrushPropertyReportV1,
  createIbisBrushPropertyReportV1,
} from '../../src/interchange/brush-import-property-report-v1.js';
import { mapIbisBrushToIllustroV1 } from '../../src/interchange/ibis-brush-mapper-v1.js';
import type { IbisBrushPayloadV1 } from '../../src/interchange/ibis-brush-parser-v1.js';

function cspFixtureV1(input: {
  readonly variant?: CspSutParsedV1['variant'];
  readonly materialData?: Uint8Array | null;
} = {}): CspSutParsedV1 {
  const materials =
    input.materialData === null
      ? []
      : [
          Object.freeze({
            _PW_ID: 9,
            MaterialName: 'tip',
            FileData: input.materialData ?? Uint8Array.from([9, 8, 7, 6]),
          }),
        ];
  return Object.freeze({
    schema: 'illustro.csp-sut-parser/1',
    sourceByteLength: 4096,
    tables: Object.freeze(['MaterialFile', 'Node', 'Variant']),
    node: Object.freeze({
      NodeName: 'Report CSP Brush',
      NodeVariantId: 42,
      NodeInitVariantId: 7,
      _PW_ID: 1,
    }),
    variant: Object.freeze(
      input.variant ?? {
        VariantId: 42,
        BrushSize: 80,
        BrushInterval: 8,
        BrushFlow: 750,
        PressureGraph: Uint8Array.from([1, 2, 3, 4, 5]),
      },
    ),
    materials: Object.freeze(materials),
    nodeName: 'Report CSP Brush',
    nodeVariantId: 42,
    nodeInitVariantId: 7,
  });
}

function ibisFixtureV1(input: {
  readonly parameterPrefixBytes?: number;
  readonly postNameBytes?: number;
  readonly trailerBytes?: number;
} = {}): IbisBrushPayloadV1 {
  const decodedBytes = new Uint8Array(64);
  new DataView(decodedBytes.buffer).setUint32(16, 4, false);
  new DataView(decodedBytes.buffer).setFloat32(20, 12, false);
  new DataView(decodedBytes.buffer).setFloat32(24, 96, false);
  return Object.freeze({
    schema: 'illustro.ibis-brush-parser/1',
    envelope: {} as IbisBrushPayloadV1['envelope'],
    carrierHeader: Uint8Array.from([0x00, 0x01, 0xd5, 0x88]),
    compressedBody: new Uint8Array(0),
    decodedBytes,
    innerSignature: Uint8Array.from([0x01, 0x00, 0x02, 0x02]),
    declaredPayloadByteLength: 52,
    parameterPrefix: new Uint8Array(input.parameterPrefixBytes ?? 16),
    name: 'Report ibis Brush',
    nameBytes: new TextEncoder().encode('Report ibis Brush'),
    postNamePayload: new Uint8Array(input.postNameBytes ?? 5),
    trailer: new Uint8Array(input.trailerBytes ?? 4),
  });
}

describe('M6B-010 unsupported brush property reporting', () => {
  it('reports exact/converted CSP mappings and every remaining Variant property without raw BLOB payloads', () => {
    const parsed = cspFixtureV1();
    const mapping = mapCspBrushToIllustroV1({ parsed, presetId: 'user.csp.report' });
    const report = createCspBrushPropertyReportV1({ parsed, mapping });

    expect(report).toMatchObject({
      schema: 'illustro.brush-import-property-report/1',
      sourceFamily: 'CLIP-STUDIO-PAINT-SUT',
      sourceVersion: null,
      targetSchema: 'illustro.brush/1',
      mappedFields: ['Node.NodeName', 'Variant.BrushSize', 'Variant.BrushInterval'],
      ignoredFields: ['MaterialFile.FileData', 'Variant.BrushFlow', 'Variant.PressureGraph'],
      compatibility: {
        schema: 'illustro.compatibility-report/1',
        sourceFormat: 'CLIP-STUDIO-PAINT-SUT',
        writable: true,
        requiresUserAcceptance: true,
      },
    });

    const sizeIssue = report.compatibility.issues.find(
      (issue) => issue.sourcePath === 'Variant.BrushSize',
    );
    const intervalIssue = report.compatibility.issues.find(
      (issue) => issue.sourcePath === 'Variant.BrushInterval',
    );
    expect(sizeIssue?.mapping).toBe('exact');
    expect(intervalIssue?.mapping).toBe('converted');

    const pressureIssue = report.compatibility.issues.find(
      (issue) => issue.sourcePath === 'Variant.PressureGraph',
    );
    expect(pressureIssue).toMatchObject({ severity: 'lossy', mapping: 'ignored' });
    expect(JSON.stringify(pressureIssue?.details)).toContain('"byteLength":5');
    expect(JSON.stringify(pressureIssue?.details)).not.toContain('0102030405');
  });

  it('does not request acceptance when all staged CSP properties are represented', () => {
    const parsed = cspFixtureV1({
      variant: { VariantId: 42, BrushSize: 80, BrushInterval: 8 },
      materialData: null,
    });
    const mapping = mapCspBrushToIllustroV1({ parsed, presetId: 'user.csp.exact' });
    const report = createCspBrushPropertyReportV1({ parsed, mapping });

    expect(report.ignoredFields).toEqual([]);
    expect(report.compatibility.writable).toBe(true);
    expect(report.compatibility.requiresUserAcceptance).toBe(false);
  });

  it('rejects a CSP mapping that does not belong to the staged parser payload', () => {
    const parsed = cspFixtureV1({ materialData: null });
    const mapping = mapCspBrushToIllustroV1({ parsed, presetId: 'user.csp.mismatch' });
    const forged = {
      ...mapping,
      preset: {
        ...mapping.preset,
        provenance: { ...mapping.preset.provenance, sourceParserSchema: 'other.parser/1' },
      },
    };
    expect(() => createCspBrushPropertyReportV1({ parsed, mapping: forged })).toThrow(
      'mapping/parser provenance mismatch',
    );
  });

  it('reports ibis mapped name/size and one bounded aggregate issue for unexplained parameter bytes', () => {
    const payload = ibisFixtureV1();
    const mapping = mapIbisBrushToIllustroV1({ payload, presetId: 'user.ibis.report' });
    const report = createIbisBrushPropertyReportV1({ payload, mapping });

    expect(report).toMatchObject({
      sourceFamily: 'ibisPaint-IPBZ',
      sourceVersion: '0001d588',
      targetSchema: 'illustro.brush/1',
      mappedFields: ['payload.name', 'payload.sizeRange'],
      ignoredFields: ['payload.unmappedParameterBytes'],
      compatibility: {
        sourceFormat: 'ibisPaint-IPBZ',
        sourceVersion: '0001d588',
        writable: true,
        requiresUserAcceptance: true,
      },
    });
    const opaqueIssue = report.compatibility.issues.find(
      (issue) => issue.sourcePath === 'payload.unmappedParameterBytes',
    );
    expect(opaqueIssue).toMatchObject({ severity: 'lossy', mapping: 'ignored' });
    expect(opaqueIssue?.details).toEqual({
      parameterPrefixByteLength: 16,
      postNamePayloadByteLength: 5,
      trailerByteLength: 4,
      opaqueByteLength: 25,
      rawBytesIncludedInReport: false,
    });
  });

  it('keeps an ibis report non-lossy when no unexplained parameter region remains', () => {
    const payload = ibisFixtureV1({
      parameterPrefixBytes: 0,
      postNameBytes: 0,
      trailerBytes: 0,
    });
    const mapping = mapIbisBrushToIllustroV1({ payload, presetId: 'user.ibis.exact' });
    const report = createIbisBrushPropertyReportV1({ payload, mapping });

    expect(report.ignoredFields).toEqual([]);
    expect(report.compatibility.requiresUserAcceptance).toBe(false);
  });
});
