import { describe, expect, it } from 'vitest';
import {
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
} from '../../src/domain/brush-schema.js';
import { createProvenanceV1, createResourceV1 } from '../../src/domain/resources.js';
import {
  parseIllbrushPackageV1,
  writeIllbrushPackageV1,
} from '../../src/interchange/illbrush-v1.js';
import { createMemoryBrushPackageAttachmentStoreV1 } from '../../src/app/brush-package-attachment-store.js';
import {
  exportNativeBrushPackageV1,
  importNativeBrushPackageV1,
  nativeBrushFilenameV1,
} from '../../src/app/brush-interchange-service.js';

function fixtureBrush() {
  return createBaselineBrushPresetV1({
    id: 'user.native-import',
    name: 'Native / Brush',
    category: 'Imported',
    behavior: 'paint',
    defaultSizePx: 18,
    tags: ['native'],
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

describe('M6B-003/M6B-004 native brush import/export service', () => {
  it('imports a verified package before exposing its canonical brush and persists package bytes', async () => {
    const brush = fixtureBrush();
    const archive = await writeIllbrushPackageV1({ brush });
    const attachments = createMemoryBrushPackageAttachmentStoreV1();
    let importedName = '';
    const result = await importNativeBrushPackageV1({
      archiveBytes: archive,
      attachments,
      brushPresets: {
        snapshot: () => {
          throw new Error('snapshot is not used during import');
        },
        importPreset(preset) {
          importedName = preset.name;
          return preset.id;
        },
      },
    });

    expect(result.presetId).toBe(brush.id);
    expect(importedName).toBe(brush.name);
    expect([...(await attachments.get(brush.id))!]).toEqual([...archive]);
  });

  it('re-exports the current canonical preset while preserving imported resources', async () => {
    const resourceBytes = new Uint8Array([3, 1, 4, 1, 5, 9]);
    const descriptor = createResourceV1({
      kind: 'grain',
      contentHash: await sha256Hex(resourceBytes),
      mimeType: 'application/octet-stream',
      byteLength: resourceBytes.byteLength,
      provenance: createProvenanceV1({ sourceClass: 'user-imported' }),
    });
    const sourceBrush = fixtureBrush();
    const sourceArchive = await writeIllbrushPackageV1({
      brush: sourceBrush,
      resources: [{ descriptor, bytes: resourceBytes }],
    });
    const attachments = createMemoryBrushPackageAttachmentStoreV1();
    await attachments.put(sourceBrush.id, sourceArchive);
    const editedBrush = normalizeBrushPresetV1({
      ...sourceBrush,
      revision: sourceBrush.revision + 1,
      name: 'Edited Native Brush',
    });

    const exported = await exportNativeBrushPackageV1({ brush: editedBrush, attachments });
    const parsed = await parseIllbrushPackageV1(exported);
    expect(parsed.brush.name).toBe('Edited Native Brush');
    expect(parsed.brush.revision).toBe(editedBrush.revision);
    expect(parsed.resources).toHaveLength(1);
    expect(parsed.resources[0]?.descriptor).toEqual(descriptor);
    expect([...parsed.resources[0]!.bytes]).toEqual([...resourceBytes]);
  });

  it('exports a valid brush-only package for presets without imported attachments', async () => {
    const brush = fixtureBrush();
    const bytes = await exportNativeBrushPackageV1({
      brush,
      attachments: createMemoryBrushPackageAttachmentStoreV1(),
    });
    const parsed = await parseIllbrushPackageV1(bytes);
    expect(parsed.brush).toEqual(brush);
    expect(parsed.resources).toEqual([]);
  });

  it('keeps attachment bytes copy-safe and creates filesystem-safe .illbrush names', async () => {
    const store = createMemoryBrushPackageAttachmentStoreV1();
    const source = new Uint8Array([1, 2, 3]);
    await store.put('user.copy-safe', source);
    source[0] = 9;
    const loaded = await store.get('user.copy-safe');
    expect([...loaded!]).toEqual([1, 2, 3]);
    loaded![1] = 8;
    expect([...(await store.get('user.copy-safe'))!]).toEqual([1, 2, 3]);
    expect(nativeBrushFilenameV1(' A/B:*? Brush. ')).toBe('A-B--- Brush.illbrush');
  });
});
