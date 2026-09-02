import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { serializeJson } from '../../src/domain/serialization.js';
import { createLinkedObjectLayer } from '../../src/domain/special-layers.js';

describe('M5B Linked Object canonical embedded representation', () => {
  it('keeps the embedded snapshot canonical without an external file permission dependency', () => {
    const embeddedSnapshot = createDocumentV1({ width: 96, height: 64 });
    const offlineSafe = createLinkedObjectLayer({ name: 'Embedded', embeddedSnapshot });
    const encoded = JSON.parse(serializeJson(offlineSafe)) as {
      embeddedSnapshot: { documentId: string; canvas: { width: number; height: number } };
      externalSource: unknown;
    };
    expect(encoded.embeddedSnapshot.documentId).toBe(embeddedSnapshot.documentId);
    expect(encoded.embeddedSnapshot.canvas).toMatchObject({ width: 96, height: 64 });
    expect(encoded.externalSource).toBeNull();
  });

  it('keeps external source metadata ancillary to the canonical embedded snapshot', () => {
    const embeddedSnapshot = createDocumentV1({ width: 80, height: 80 });
    const linked = createLinkedObjectLayer({
      name: 'Relinkable',
      embeddedSnapshot,
      externalSource: {
        originalName: 'reference.psd',
        format: 'image/vnd.adobe.photoshop',
        sourceHash: 'c'.repeat(64),
      },
    });
    const encoded = JSON.parse(serializeJson(linked)) as {
      embeddedSnapshot: { documentId: string };
      externalSource: { sourceHash: string } | null;
    };
    expect(encoded.embeddedSnapshot.documentId).toBe(embeddedSnapshot.documentId);
    expect(encoded.externalSource?.sourceHash).toBe('c'.repeat(64));
  });
});
