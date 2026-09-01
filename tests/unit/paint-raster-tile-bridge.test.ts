import { describe, expect, it } from 'vitest';
import {
  PaintPersistenceControllerV1,
  paintRasterTilePayloadRefV1,
  parsePaintRasterTilePayloadRefV1,
  type PaintStorageWorkerLikeV1,
} from '../../src/app/paint-persistence-controller.js';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

const HASH = 'a'.repeat(64);

class Renderer {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
}

class TileWorker implements PaintStorageWorkerLikeV1 {
  readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  readonly transfers: Transferable[][] = [];
  stored = new Uint8Array([1, 2, 3, 4]);

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }
  postMessage(message: unknown, transfer: readonly Transferable[] = []): void {
    this.transfers.push([...transfer]);
    const request = message as Readonly<Record<string, unknown>>;
    queueMicrotask(() => {
      if (request.type === 'storage.project.create') {
        this.emit({
          type: 'storage.response',
          requestId: request.requestId,
          ok: true,
          result: {
            metadata: { projectId: request.projectId },
            snapshot: request.initialSnapshot,
            documentRevision: request.documentRevision,
            sequence: 1,
            recoveryGeneration: 1,
          },
        });
        return;
      }
      if (request.type === 'storage.tile.put') {
        const bytes = new Uint8Array(request.bytes as ArrayBuffer);
        this.stored = new Uint8Array(bytes);
        this.emit({
          type: 'storage.response',
          requestId: request.requestId,
          ok: true,
          result: {
            codec: 'raw',
            pixelFormat: request.pixelFormat,
            width: request.width,
            height: request.height,
            rawByteLength: bytes.byteLength,
            encodedByteLength: bytes.byteLength + 24,
            object: {
              hash: HASH,
              algorithm: 'sha256',
              byteLength: bytes.byteLength + 24,
              created: true,
            },
          },
        });
        return;
      }
      if (request.type === 'storage.tile.get') {
        const bytes = this.stored.slice().buffer;
        this.emit({
          type: 'storage.response',
          requestId: request.requestId,
          ok: true,
          result: { codec: 'raw', pixelFormat: 'rgba8-unorm', width: 1, height: 1, bytes },
        });
        return;
      }
      throw new Error(`unsupported request ${String(request.type)}`);
    });
  }
  private emit(data: unknown): void {
    const event = { data } as MessageEvent<unknown>;
    for (const listener of this.listeners) listener(event);
  }
}

async function controller() {
  const worker = new TileWorker();
  const session = new PaintSessionControllerV1(new Renderer());
  const history = new PaintHistoryControllerV1(session);
  const persistence = new PaintPersistenceControllerV1(worker, session, history);
  await persistence.initialize({ name: 'Tile bridge', document: { width: 32, height: 32 } });
  return { worker, persistence };
}

describe('M5B canonical raster tile bridge', () => {
  it('uses a validated content-addressed payloadRef', () => {
    expect(paintRasterTilePayloadRefV1(HASH)).toBe(`sha256:${HASH}`);
    expect(parsePaintRasterTilePayloadRefV1(`sha256:${HASH}`)).toBe(HASH);
    expect(() => parsePaintRasterTilePayloadRefV1('tile:unsafe')).toThrow(/sha256/);
    expect(() => paintRasterTilePayloadRefV1('ABC')).toThrow(/SHA-256/);
  });

  it('persists and reads exact raster bytes through the Storage Worker bridge', async () => {
    const { worker, persistence } = await controller();
    const source = new Uint8Array([9, 8, 7, 6]);
    const persisted = await persistence.persistRasterTile({
      width: 1,
      height: 1,
      pixelFormat: 'rgba8-unorm',
      bytes: source,
    });
    expect(persisted).toMatchObject({
      payloadRef: `sha256:${HASH}`,
      objectHash: HASH,
      codec: 'raw',
      pixelFormat: 'rgba8-unorm',
      width: 1,
      height: 1,
      rawByteLength: 4,
    });
    source.fill(0);
    const restored = await persistence.readRasterTile(persisted.payloadRef);
    expect([...restored.bytes]).toEqual([9, 8, 7, 6]);
    expect(worker.transfers.some((items) => items.length === 1)).toBe(true);
    persistence.dispose();
  });
});
