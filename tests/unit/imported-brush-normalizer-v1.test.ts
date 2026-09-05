import { describe, expect, it } from 'vitest';
import type { CspSutParsedV1 } from '../../src/interchange/csp-sut-parser-v1.js';
import {
  ImportedBrushAcceptanceRequiredErrorV1,
  commitImportedBrushStageV1,
  stageCspBrushImportV1,
  stageIbisBrushImportV1,
} from '../../src/interchange/imported-brush-normalizer-v1.js';
import type { IbisBrushPayloadV1 } from '../../src/interchange/ibis-brush-parser-v1.js';

function cspFixtureV1(lossy: boolean): CspSutParsedV1 {
  return Object.freeze({
    schema: 'illustro.csp-sut-parser/1',
    sourceByteLength: 4096,
    tables: Object.freeze(['Node', 'Variant']),
    node: Object.freeze({
      NodeName: 'Normalized CSP',
      NodeVariantId: 42,
      NodeInitVariantId: 7,
    }),
    variant: Object.freeze(
      lossy
        ? { VariantId: 42, BrushSize: 48, BrushInterval: 6, BrushFlow: 700 }
        : { VariantId: 42, BrushSize: 48, BrushInterval: 6 },
    ),
    materials: Object.freeze([]),
    nodeName: 'Normalized CSP',
    nodeVariantId: 42,
    nodeInitVariantId: 7,
  });
}

function ibisFixtureV1(opaqueBytes: number): IbisBrushPayloadV1 {
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
    parameterPrefix: new Uint8Array(opaqueBytes),
    name: 'Normalized ibis',
    nameBytes: new TextEncoder().encode('Normalized ibis'),
    postNamePayload: new Uint8Array(0),
    trailer: new Uint8Array(0),
  });
}

describe('M6B-011 imported brush canonical normalization', () => {
  it('commits an exact CSP stage to canonical illustro.brush/1 without acceptance', () => {
    const stage = stageCspBrushImportV1({
      parsed: cspFixtureV1(false),
      presetId: 'user.import.csp.exact',
    });
    const committed = commitImportedBrushStageV1({ stage });

    expect(stage.schema).toBe('illustro.imported-brush-stage/1');
    expect(committed).toMatchObject({
      schema: 'illustro.imported-brush-commit/1',
      acceptedLossyMapping: false,
      preset: {
        schema: 'illustro.brush/1',
        id: 'user.import.csp.exact',
        name: 'Normalized CSP',
        defaultSizePx: 48,
        stroke: { spacingRatio: 0.125 },
      },
    });
  });

  it('blocks lossy CSP commit until the compatibility loss is explicitly accepted', () => {
    const stage = stageCspBrushImportV1({
      parsed: cspFixtureV1(true),
      presetId: 'user.import.csp.lossy',
    });

    expect(stage.report.compatibility.requiresUserAcceptance).toBe(true);
    expect(() => commitImportedBrushStageV1({ stage })).toThrow(
      ImportedBrushAcceptanceRequiredErrorV1,
    );

    const committed = commitImportedBrushStageV1({ stage, acceptLossyMapping: true });
    expect(committed.acceptedLossyMapping).toBe(true);
    expect(committed.preset.schema).toBe('illustro.brush/1');
  });

  it('applies the same acceptance boundary to ibisPaint staging', () => {
    const stage = stageIbisBrushImportV1({
      payload: ibisFixtureV1(8),
      presetId: 'user.import.ibis.lossy',
    });

    expect(stage.sourceFamily).toBe('ibisPaint-IPBZ');
    expect(stage.report.ignoredFields).toContain('payload.unmappedParameterBytes');
    expect(() => commitImportedBrushStageV1({ stage })).toThrow(
      ImportedBrushAcceptanceRequiredErrorV1,
    );
    expect(
      commitImportedBrushStageV1({ stage, acceptLossyMapping: true }).preset.schema,
    ).toBe('illustro.brush/1');
  });

  it('fails closed when a staged report is forged for another source family', () => {
    const stage = stageCspBrushImportV1({
      parsed: cspFixtureV1(false),
      presetId: 'user.import.csp.forged',
    });
    const forged = {
      ...stage,
      report: {
        ...stage.report,
        sourceFamily: 'ibisPaint-IPBZ' as const,
      },
    };

    expect(() => commitImportedBrushStageV1({ stage: forged })).toThrow(
      'source/report family mismatch',
    );
  });

  it('rejects empty imported preset ids before source mapping', () => {
    expect(() =>
      stageCspBrushImportV1({ parsed: cspFixtureV1(false), presetId: '   ' }),
    ).toThrow('preset id must contain');
  });
});
