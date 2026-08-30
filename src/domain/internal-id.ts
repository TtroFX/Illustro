declare const internalIdBrand: unique symbol;

export type InternalId = string & { readonly [internalIdBrand]: 'InternalId' };

export const MAX_INTERNAL_ID_LENGTH = 160;
const INTERNAL_ID_SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;

export function isLocaleNeutralInternalId(value: unknown): value is InternalId {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_INTERNAL_ID_LENGTH) {
    return false;
  }
  if (!/^[\x20-\x7e]+$/.test(value)) return false;
  const segments = value.split('.');
  return segments.every((segment) => INTERNAL_ID_SEGMENT_PATTERN.test(segment));
}

export function parseInternalId(value: unknown, label = 'internal ID'): InternalId {
  if (!isLocaleNeutralInternalId(value)) {
    throw new TypeError(`${label} must be a locale-neutral ASCII identifier`);
  }
  return value;
}

export function assertLocaleNeutralInternalIds(
  values: readonly unknown[],
  label = 'internal ID',
): void {
  for (const value of values) parseInternalId(value, label);
}
