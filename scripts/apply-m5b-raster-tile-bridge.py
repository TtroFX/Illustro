from pathlib import Path

path = Path('src/workers/storage.worker.ts')
text = path.read_text()
text = text.replace(
    "import { putImmutableObject } from '../storage/immutable-object-store.js';",
    "import { readImmutableObject, putImmutableObject } from '../storage/immutable-object-store.js';",
    1,
)
text = text.replace(
    "import {\n  parseProjectId,",
    "import { isSha256Hex } from '../domain/resources.js';\nimport {\n  parseProjectId,",
    1,
)
text = text.replace(
    "  persistMaskTile,\n  persistRasterTile,",
    "  decodeTile,\n  persistMaskTile,\n  persistRasterTile,",
    1,
)
text = text.replace(
    "type WorkerScope = {\n  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;\n  postMessage(message: unknown): void;\n};",
    "type WorkerScope = {\n  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;\n  postMessage(message: unknown, transfer?: readonly Transferable[]): void;\n};",
    1,
)
anchor = "  | {\n      readonly type: 'storage.entity.persist';"
addition = "  | {\n      readonly type: 'storage.tile.get';\n      readonly requestId: string;\n      readonly objectHash: string;\n    }\n"
if anchor not in text:
    raise SystemExit('storage request union anchor missing')
text = text.replace(anchor, addition + anchor, 1)
anchor = "  if (\n    value.type === 'storage.entity.persist' &&"
addition = "  if (\n    value.type === 'storage.tile.get' &&\n    typeof value.objectHash === 'string' &&\n    isSha256Hex(value.objectHash)\n  ) {\n    return {\n      type: value.type,\n      requestId: value.requestId,\n      objectHash: value.objectHash,\n    };\n  }\n"
if anchor not in text:
    raise SystemExit('storage tile get parser anchor missing')
text = text.replace(anchor, addition + anchor, 1)
anchor = "    if (request.type === 'storage.entity.persist') {"
addition = "    if (request.type === 'storage.tile.get') {\n      const root = await rootPromise;\n      const encoded = await readImmutableObject(root.sha256Objects, request.objectHash);\n      const decoded = decodeTile(encoded);\n      const bytes = decoded.bytes.buffer;\n      scope.postMessage(\n        {\n          type: 'storage.response',\n          requestId: request.requestId,\n          ok: true,\n          result: {\n            codec: decoded.codec,\n            pixelFormat: decoded.pixelFormat,\n            width: decoded.width,\n            height: decoded.height,\n            bytes,\n          },\n        },\n        [bytes],\n      );\n      return;\n    }\n\n"
if anchor not in text:
    raise SystemExit('storage tile get handler anchor missing')
text = text.replace(anchor, addition + anchor, 1)
path.write_text(text)

path = Path('src/app/paint-persistence-controller.ts')
text = path.read_text()
text = text.replace(
    "import { parseHistorySpineStateV1, type HistorySpineStateV1 } from '../history/history.js';",
    "import { isSha256Hex } from '../domain/resources.js';\nimport { parseHistorySpineStateV1, type HistorySpineStateV1 } from '../history/history.js';\nimport type { TileCodecIdV1 } from '../storage/tile-codec.js';",
    1,
)
text = text.replace(
    "export interface PaintStorageWorkerLikeV1 {\n  postMessage(message: unknown): void;",
    "export interface PaintStorageWorkerLikeV1 {\n  postMessage(message: unknown, transfer?: readonly Transferable[]): void;",
    1,
)
anchor = "export type PaintPersistenceNewDocumentInputV1 = Omit<PaintDocumentCreationInputV1, 'projectId'>;\n"
addition = "\nexport type PaintRasterTilePixelFormatV1 = 'rgba8-unorm' | 'rgba16-float';\n\nexport interface PaintPersistedRasterTileV1 {\n  readonly schema: 'illustro.paint-persisted-raster-tile/1';\n  readonly payloadRef: string;\n  readonly objectHash: string;\n  readonly codec: TileCodecIdV1;\n  readonly pixelFormat: PaintRasterTilePixelFormatV1;\n  readonly width: number;\n  readonly height: number;\n  readonly rawByteLength: number;\n  readonly encodedByteLength: number;\n}\n\nexport interface PaintDecodedRasterTileV1 {\n  readonly schema: 'illustro.paint-decoded-raster-tile/1';\n  readonly payloadRef: string;\n  readonly objectHash: string;\n  readonly codec: TileCodecIdV1;\n  readonly pixelFormat: PaintRasterTilePixelFormatV1;\n  readonly width: number;\n  readonly height: number;\n  readonly bytes: Uint8Array<ArrayBuffer>;\n}\n\nexport function paintRasterTilePayloadRefV1(objectHash: string): string {\n  if (!isSha256Hex(objectHash)) throw new TypeError('raster tile object hash must be lowercase SHA-256');\n  return `sha256:${objectHash}`;\n}\n\nexport function parsePaintRasterTilePayloadRefV1(payloadRef: string): string {\n  if (!payloadRef.startsWith('sha256:')) throw new TypeError('raster tile payloadRef must use sha256');\n  const objectHash = payloadRef.slice('sha256:'.length);\n  if (!isSha256Hex(objectHash)) throw new TypeError('raster tile payloadRef hash is invalid');\n  return objectHash;\n}\n"
if anchor not in text:
    raise SystemExit('paint persistence type anchor missing')
text = text.replace(anchor, anchor + addition, 1)
anchor = "function storageErrorMessage(value: unknown): string {"
helpers = "function ownedArrayBuffer(value: Uint8Array | ArrayBuffer): ArrayBuffer {\n  if (value instanceof ArrayBuffer) return value.slice(0);\n  const copy = new Uint8Array(value.byteLength);\n  copy.set(value);\n  return copy.buffer;\n}\n\nfunction rasterPixelFormat(value: unknown): PaintRasterTilePixelFormatV1 {\n  if (value !== 'rgba8-unorm' && value !== 'rgba16-float') {\n    throw new TypeError('storage returned a non-raster tile pixel format');\n  }\n  return value;\n}\n\nfunction tileCodec(value: unknown): TileCodecIdV1 {\n  if (value !== 'raw' && value !== 'lz4-block') throw new TypeError('storage returned invalid tile codec');\n  return value;\n}\n\nfunction positiveTileDimension(value: unknown, label: string): number {\n  if (!Number.isSafeInteger(value) || (value as number) < 1) {\n    throw new TypeError(`${label} must be a positive safe integer`);\n  }\n  return value as number;\n}\n\n"
if anchor not in text:
    raise SystemExit('paint persistence helper anchor missing')
text = text.replace(anchor, helpers + anchor, 1)
anchor = "  async markDirty(\n"
methods = "  async persistRasterTile(input: {\n    readonly width: number;\n    readonly height: number;\n    readonly pixelFormat: PaintRasterTilePixelFormatV1;\n    readonly bytes: Uint8Array | ArrayBuffer;\n  }): Promise<PaintPersistedRasterTileV1> {\n    this.#assertNotDisposed();\n    this.#requireProject();\n    const bytes = ownedArrayBuffer(input.bytes);\n    const result = await this.#request(\n      {\n        type: 'storage.tile.put',\n        kind: 'raster',\n        width: input.width,\n        height: input.height,\n        pixelFormat: input.pixelFormat,\n        bytes,\n      },\n      [bytes],\n    );\n    if (!isRecord(result) || !isRecord(result.object) || typeof result.object.hash !== 'string') {\n      throw new TypeError('invalid persisted raster tile response');\n    }\n    const objectHash = result.object.hash;\n    if (!isSha256Hex(objectHash)) throw new TypeError('persisted raster tile hash is invalid');\n    if (!Number.isSafeInteger(result.rawByteLength) || (result.rawByteLength as number) < 1) {\n      throw new TypeError('persisted raster tile raw length is invalid');\n    }\n    if (!Number.isSafeInteger(result.encodedByteLength) || (result.encodedByteLength as number) < 1) {\n      throw new TypeError('persisted raster tile encoded length is invalid');\n    }\n    return Object.freeze({\n      schema: 'illustro.paint-persisted-raster-tile/1' as const,\n      payloadRef: paintRasterTilePayloadRefV1(objectHash),\n      objectHash,\n      codec: tileCodec(result.codec),\n      pixelFormat: rasterPixelFormat(result.pixelFormat),\n      width: positiveTileDimension(result.width, 'persisted raster tile width'),\n      height: positiveTileDimension(result.height, 'persisted raster tile height'),\n      rawByteLength: result.rawByteLength as number,\n      encodedByteLength: result.encodedByteLength as number,\n    });\n  }\n\n  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {\n    this.#assertNotDisposed();\n    this.#requireProject();\n    const objectHash = parsePaintRasterTilePayloadRefV1(payloadRef);\n    const result = await this.#request({\n      type: 'storage.tile.get',\n      objectHash,\n    });\n    if (!isRecord(result) || !(result.bytes instanceof ArrayBuffer)) {\n      throw new TypeError('invalid decoded raster tile response');\n    }\n    const bytes = new Uint8Array(result.bytes);\n    return Object.freeze({\n      schema: 'illustro.paint-decoded-raster-tile/1' as const,\n      payloadRef,\n      objectHash,\n      codec: tileCodec(result.codec),\n      pixelFormat: rasterPixelFormat(result.pixelFormat),\n      width: positiveTileDimension(result.width, 'decoded raster tile width'),\n      height: positiveTileDimension(result.height, 'decoded raster tile height'),\n      bytes,\n    });\n  }\n\n"
if anchor not in text:
    raise SystemExit('paint persistence method anchor missing')
text = text.replace(anchor, methods + anchor, 1)
text = text.replace(
    "  #request(message: Readonly<Record<string, unknown>>): Promise<unknown> {",
    "  #request(\n    message: Readonly<Record<string, unknown>>,\n    transfer: readonly Transferable[] = [],\n  ): Promise<unknown> {",
    1,
)
text = text.replace(
    "        this.#worker.postMessage({ ...message, requestId });",
    "        this.#worker.postMessage({ ...message, requestId }, transfer);",
    1,
)
path.write_text(text)

Path('tests/unit/paint-raster-tile-bridge.test.ts').write_text("""import { describe, expect, it } from 'vitest';
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
          type: 'storage.response', requestId: request.requestId, ok: true,
          result: {
            metadata: { projectId: request.projectId }, snapshot: request.initialSnapshot,
            documentRevision: request.documentRevision, sequence: 1, recoveryGeneration: 1,
          },
        });
        return;
      }
      if (request.type === 'storage.tile.put') {
        const bytes = new Uint8Array(request.bytes as ArrayBuffer);
        this.stored = new Uint8Array(bytes);
        this.emit({
          type: 'storage.response', requestId: request.requestId, ok: true,
          result: {
            codec: 'raw', pixelFormat: request.pixelFormat, width: request.width, height: request.height,
            rawByteLength: bytes.byteLength, encodedByteLength: bytes.byteLength + 24,
            object: { hash: HASH, algorithm: 'sha256', byteLength: bytes.byteLength + 24, created: true },
          },
        });
        return;
      }
      if (request.type === 'storage.tile.get') {
        const bytes = this.stored.slice().buffer;
        this.emit({
          type: 'storage.response', requestId: request.requestId, ok: true,
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
      width: 1, height: 1, pixelFormat: 'rgba8-unorm', bytes: source,
    });
    expect(persisted).toMatchObject({
      payloadRef: `sha256:${HASH}`, objectHash: HASH, codec: 'raw',
      pixelFormat: 'rgba8-unorm', width: 1, height: 1, rawByteLength: 4,
    });
    source.fill(0);
    const restored = await persistence.readRasterTile(persisted.payloadRef);
    expect([...restored.bytes]).toEqual([9, 8, 7, 6]);
    expect(worker.transfers.some((items) => items.length === 1)).toBe(true);
    persistence.dispose();
  });
});
""")
