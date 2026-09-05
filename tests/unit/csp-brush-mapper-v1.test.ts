import { describe, expect, it } from 'vitest';
import type { CspSutParsedV1 } from '../../src/interchange/csp-sut-parser-v1.js';
import {
  CSP_BRUSH_IMPORTED_CATEGORY_V1,
  mapCspBrushToIllustroV1,
} from '../../src/interchange/csp-brush-mapper-v1.js';

function parsedFixtureV1(
  variant: CspSutParsedV1['variant'] = {
    VariantId: 42,
    BrushSize: 80,
    BrushInterval: 8,
    BrushFlow: 750,
    SizeEffector: Uint8Array.from([1, 2, 3, 4]),
  },
): CspSutParsedV1 {
  return Object.freeze({
    schema: 'illustro.csp-sut-parser/1',
    sourceByteLength: 4096,
    tables: Object.freeze(['MaterialFile', 'Node', 'Variant']),
    node: Object.freeze({
      NodeName: 'Synthetic CSP Brush',
      NodeVariantId: 42,
      NodeInitVariantId: 7,
      _PW_ID: 1,
    }),
    variant: Object.freeze(variant),
    materials: Object.freeze([
      Object.freeze({
        _PW_ID: 9,
        MaterialName: 'tip',
        FileData: Uint8Array.from([9, 8, 7]),
      }),
    ]),
    nodeName: 'Synthetic CSP Brush',
    nodeVariantId: 42,
    nodeInitVariantId: 7,
  });
}

describe('M6B-009 CSP to Illustro parameter mapper', () => {
  it('maps the exact source name, BrushSize and dimensional BrushInterval ratio only', () => {
    const result = mapCspBrushToIllustroV1({
      parsed: parsedFixtureV1(),
      presetId: 'user.csp.synthetic',
    });

    expect(result).toMatchObject({
      schema: 'illustro.csp-brush-mapper/1',
      observed: {
        sourceBrushSizePx: 80,
        sourceBrushIntervalPx: 8,
      },
      sizeMapping: 'exact',
      spacingMapping: 'direct-ratio',
      mappedFields: ['Node.NodeName', 'Variant.BrushSize', 'Variant.BrushInterval'],
    });
    expect(result.preset).toMatchObject({
      id: 'user.csp.synthetic',
      name: 'Synthetic CSP Brush',
      category: CSP_BRUSH_IMPORTED_CATEGORY_V1,
      behavior: 'paint',
      defaultSizePx: 80,
      stroke: { spacingRatio: 0.1 },
      provenance: {
        sourceFormat: 'CLIP-STUDIO-PAINT-SUT',
        sourceParserSchema: 'illustro.csp-sut-parser/1',
        sourceVariantId: 42,
        sourceInitVariantId: 7,
      },
      importCompatibility: {
        sourceName: 'exact',
        sourceDefaultSize: 'exact',
        sourceSpacing: 'direct-ratio',
        sourceBehavior: 'unmapped-default-paint',
        sourceParameters: 'partial-known-fields-only',
        unknownParameters: 'preserved-source-summary',
      },
    });
  });

  it('clamps only values outside canonical hard limits and records the conversion', () => {
    const result = mapCspBrushToIllustroV1({
      parsed: parsedFixtureV1({ VariantId: 42, BrushSize: 5000, BrushInterval: 25000 }),
      presetId: 'user.csp.clamped',
    });

    expect(result.preset.defaultSizePx).toBe(4096);
    expect(result.preset.stroke.spacingRatio).toBe(4);
    expect(result.sizeMapping).toBe('clamped');
    expect(result.spacingMapping).toBe('clamped-ratio');
  });

  it('leaves unavailable source scalars at canonical defaults instead of guessing', () => {
    const result = mapCspBrushToIllustroV1({
      parsed: parsedFixtureV1({ VariantId: 42, BrushFlow: 500 }),
      presetId: 'user.csp.partial',
    });

    expect(result.preset.defaultSizePx).toBe(16);
    expect(result.sizeMapping).toBe('unavailable');
    expect(result.spacingMapping).toBe('unavailable');
    expect(result.mappedFields).toEqual(['Node.NodeName']);
    expect(result.preset.importCompatibility).toMatchObject({
      sourceDefaultSize: 'unavailable',
      sourceSpacing: 'unavailable',
    });
  });

  it('preserves unknown scalar fields and bounded BLOB summaries without activating their semantics', () => {
    const parsed = parsedFixtureV1({
      VariantId: 42,
      BrushSize: 64,
      BrushFlow: 777,
      BrushRotationEffector: 3,
      PressureGraph: Uint8Array.from({ length: 40 }, (_, index) => index),
    });
    const result = mapCspBrushToIllustroV1({ parsed, presetId: 'user.csp.opaque' });
    const serializedSource = JSON.stringify(result.preset.extensions.clipStudioPaintSource);

    expect(serializedSource).toContain('"BrushFlow":777');
    expect(serializedSource).toContain('"BrushRotationEffector":3');
    expect(serializedSource).toContain('"byteLength":40');
    expect(serializedSource).toContain('0001020304050607');
    expect(serializedSource).toContain('"truncated":true');
    expect(result.mappedFields).not.toContain('Variant.BrushFlow');
    expect(result.mappedFields).not.toContain('Variant.BrushRotationEffector');
    expect(result.mappedFields).not.toContain('Variant.PressureGraph');
  });

  it('fails closed when a present known scalar has an invalid SQLite value', () => {
    expect(() =>
      mapCspBrushToIllustroV1({
        parsed: parsedFixtureV1({ VariantId: 42, BrushSize: -1 }),
        presetId: 'user.csp.invalid-size',
      }),
    ).toThrow('invalid CSP BrushSize value');

    expect(() =>
      mapCspBrushToIllustroV1({
        parsed: parsedFixtureV1({ VariantId: 42, BrushSize: 10, BrushInterval: -0.1 }),
        presetId: 'user.csp.invalid-spacing',
      }),
    ).toThrow('invalid CSP BrushInterval value');
  });
});
