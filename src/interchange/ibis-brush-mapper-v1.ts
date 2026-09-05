import {
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';
import type { IbisBrushPayloadV1 } from './ibis-brush-parser-v1.js';

export const IBIS_BRUSH_MAPPER_SCHEMA_V1 = 'illustro.ibis-brush-mapper/1' as const;
export const IBIS_BRUSH_SUPPORTED_CARRIER_VERSION_HEX_V1 = '0001d588' as const;
export const IBIS_BRUSH_SOURCE_TYPE_OFFSET_V1 = 16;
export const IBIS_BRUSH_SOURCE_SIZE_MIN_OFFSET_V1 = 20;
export const IBIS_BRUSH_SOURCE_SIZE_MAX_OFFSET_V1 = 24;
export const IBIS_BRUSH_IMPORTED_CATEGORY_V1 = 'Imported / ibisPaint' as const;

const TARGET_SIZE_MIN_PX_V1 = 1;
const TARGET_SIZE_MAX_PX_V1 = 4096;
const TARGET_DEFAULT_SIZE_PX_V1 = 16;

export interface IbisBrushObservedParametersV1 {
  readonly carrierVersionHex: string;
  readonly sourceTypeId: number;
  readonly sourceSizeMinPx: number;
  readonly sourceSizeMaxPx: number;
}

export interface IbisBrushMapResultV1 {
  readonly schema: typeof IBIS_BRUSH_MAPPER_SCHEMA_V1;
  readonly preset: BrushPresetV1;
  readonly observed: IbisBrushObservedParametersV1;
  readonly sizeRangeMapping: 'exact' | 'converted';
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function bytesToHexV1(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function readU32BigEndianV1(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) {
    throw new RangeError('ibis brush observed uint32 field is truncated');
  }
  return viewOf(bytes).getUint32(offset, false);
}

function readFloat32BigEndianV1(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) {
    throw new RangeError('ibis brush observed float32 field is truncated');
  }
  return viewOf(bytes).getFloat32(offset, false);
}

function clampTargetSizeV1(value: number): number {
  return Math.min(TARGET_SIZE_MAX_PX_V1, Math.max(TARGET_SIZE_MIN_PX_V1, value));
}

function observeIbisBrushParametersV1(payload: IbisBrushPayloadV1): IbisBrushObservedParametersV1 {
  const carrierVersionHex = bytesToHexV1(payload.carrierHeader);
  if (carrierVersionHex !== IBIS_BRUSH_SUPPORTED_CARRIER_VERSION_HEX_V1) {
    throw new TypeError(`unsupported ibis brush carrier version: ${carrierVersionHex}`);
  }

  const sourceTypeId = readU32BigEndianV1(payload.decodedBytes, IBIS_BRUSH_SOURCE_TYPE_OFFSET_V1);
  const sourceSizeMinPx = readFloat32BigEndianV1(
    payload.decodedBytes,
    IBIS_BRUSH_SOURCE_SIZE_MIN_OFFSET_V1,
  );
  const sourceSizeMaxPx = readFloat32BigEndianV1(
    payload.decodedBytes,
    IBIS_BRUSH_SOURCE_SIZE_MAX_OFFSET_V1,
  );
  if (
    !Number.isFinite(sourceSizeMinPx) ||
    !Number.isFinite(sourceSizeMaxPx) ||
    sourceSizeMinPx <= 0 ||
    sourceSizeMaxPx <= 0 ||
    sourceSizeMinPx > sourceSizeMaxPx
  ) {
    throw new RangeError('invalid ibis brush observed size range');
  }

  return Object.freeze({
    carrierVersionHex,
    sourceTypeId,
    sourceSizeMinPx,
    sourceSizeMaxPx,
  });
}

export function mapIbisBrushToIllustroV1(input: {
  readonly payload: IbisBrushPayloadV1;
  readonly presetId: string;
}): IbisBrushMapResultV1 {
  const observed = observeIbisBrushParametersV1(input.payload);
  const sizeMinPx = clampTargetSizeV1(observed.sourceSizeMinPx);
  const sizeMaxPx = clampTargetSizeV1(observed.sourceSizeMaxPx);
  const defaultSizePx = Math.min(sizeMaxPx, Math.max(sizeMinPx, TARGET_DEFAULT_SIZE_PX_V1));
  const sizeRangeMapping =
    sizeMinPx === observed.sourceSizeMinPx && sizeMaxPx === observed.sourceSizeMaxPx
      ? 'exact'
      : 'converted';

  const baseline = createBaselineBrushPresetV1({
    id: input.presetId,
    name: input.payload.name,
    category: IBIS_BRUSH_IMPORTED_CATEGORY_V1,
    behavior: 'paint',
    defaultSizePx,
  });

  const preset = normalizeBrushPresetV1({
    ...baseline,
    provenance: {
      ...baseline.provenance,
      sourceFormat: 'ibisPaint-IPBZ',
      sourceParserSchema: input.payload.schema,
      sourceCarrierVersion: observed.carrierVersionHex,
      sourceTypeId: observed.sourceTypeId,
    },
    importCompatibility: {
      ...baseline.importCompatibility,
      sourceName: 'exact',
      sourceSizeRange: sizeRangeMapping,
      unknownParameters: 'preserved-opaque',
    },
    extensions: {
      ...baseline.extensions,
      parameterLimits: {
        sizePx: { min: sizeMinPx, max: sizeMaxPx },
        opacity: { min: 0.01, max: 1 },
        flow: { min: 0.01, max: 1 },
      },
      ibisPaintSource: {
        carrierVersionHex: observed.carrierVersionHex,
        sourceTypeId: observed.sourceTypeId,
        sourceSizeMinPx: observed.sourceSizeMinPx,
        sourceSizeMaxPx: observed.sourceSizeMaxPx,
        parameterPrefixHex: bytesToHexV1(input.payload.parameterPrefix),
        postNamePayloadHex: bytesToHexV1(input.payload.postNamePayload),
        trailerHex: bytesToHexV1(input.payload.trailer),
      },
    },
  });

  return Object.freeze({
    schema: IBIS_BRUSH_MAPPER_SCHEMA_V1,
    preset,
    observed,
    sizeRangeMapping,
  });
}
