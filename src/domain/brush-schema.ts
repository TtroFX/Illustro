export const BRUSH_V1_SCHEMA = 'illustro.brush/1' as const;
export const BRUSH_SCHEMA_VERSION = 1 as const;
export const ILLBRUSH_PACKAGE_VERSION = '1.0' as const;
export const ILLBRUSH_MIME_TYPE = 'application/x-illustro-brush+zip' as const;

export type BrushSchemaIdentifier = typeof BRUSH_V1_SCHEMA;
export type BrushSchemaVersion = typeof BRUSH_SCHEMA_VERSION;

export function isSupportedBrushSchema(value: unknown): value is BrushSchemaIdentifier {
  return value === BRUSH_V1_SCHEMA;
}
