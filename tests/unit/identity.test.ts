import { describe, expect, it } from 'vitest';
import {
  INITIAL_REVISION,
  createDocumentId,
  createLayerId,
  createNodeId,
  createObjectId,
  createResourceId,
  isRevision,
  isUuid,
  nextRevision,
  parseDocumentId,
  parseRevision,
} from '../../src/domain/identity.js';

describe('canonical semantic identity', () => {
  it('creates distinct standards-shaped UUIDs for each semantic identity family', () => {
    const ids = [
      createDocumentId(),
      createLayerId(),
      createResourceId(),
      createObjectId(),
      createNodeId(),
    ];

    expect(ids.every(isUuid)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts canonical UUID references and rejects names, indexes, and malformed values', () => {
    const id = createDocumentId();
    expect(parseDocumentId(id)).toBe(id);
    expect(() => parseDocumentId('Layer 1')).toThrow(TypeError);
    expect(() => parseDocumentId(0)).toThrow(TypeError);
    expect(() => parseDocumentId('00000000-0000-0000-0000-000000000000')).toThrow(TypeError);
  });
});

describe('canonical revision counters', () => {
  it('starts at zero and increments monotonically', () => {
    const revision1 = nextRevision(INITIAL_REVISION);
    const revision2 = nextRevision(revision1);

    expect(INITIAL_REVISION).toBe(0);
    expect(revision1).toBe(1);
    expect(revision2).toBe(2);
  });

  it('accepts only non-negative JavaScript safe integers', () => {
    expect(isRevision(0)).toBe(true);
    expect(parseRevision(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(isRevision(-1)).toBe(false);
    expect(isRevision(1.5)).toBe(false);
    expect(isRevision(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('fails closed instead of overflowing the safe-integer range', () => {
    const maximum = parseRevision(Number.MAX_SAFE_INTEGER);
    expect(() => nextRevision(maximum)).toThrow(RangeError);
  });
});
