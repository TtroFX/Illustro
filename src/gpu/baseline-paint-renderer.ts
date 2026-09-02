import { baselineBrushShaderSource } from '../generated/baseline-brush-shader.js';
import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import {
  baselineDabColorV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
} from './baseline-brush.js';
import type { RendererSurfaceLikeV1 } from './renderer-device-resources.js';
import type { RendererTileStateV1 } from './renderer-tile-state.js';
import {
  tileBoundsForDocumentV1,
  type DirtyTileStateV1,
  type TileCoordinateV1,
} from './sparse-tile-model.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';
import {
  BaselineRasterTileStoreV1,
  type BaselineRasterLayerDescriptorV1,
  type BaselineRasterTileImageV1,
  type BaselineRasterTilePatchDirectionV1,
  type BaselineRasterTilePatchV1,
} from './baseline-raster-tile-store.js';

const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_TEXTURE_USAGE_COPY_SRC = 0x0001;
const GPU_TEXTURE_USAGE_COPY_DST = 0x0002;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x0010;
const INSTANCE_FLOATS = 8;
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const INSTANCE_BUFFER_ALIGNMENT_BYTES = 256;

interface BaselineGpuTextureLikeV1 {
  createView(): object;
  destroy?(): void;
}

interface BaselineGpuCanvasContextLikeV1 {
  getCurrentTexture(): BaselineGpuTextureLikeV1;
}

interface BaselineGpuBufferLikeV1 {
  destroy?(): void;
}

interface BaselineGpuRenderPassLikeV1 {
  setPipeline(pipeline: object): void;
  setVertexBuffer(slot: number, buffer: BaselineGpuBufferLikeV1): void;
  draw(
    vertexCount: number,
    instanceCount: number,
    firstVertex?: number,
    firstInstance?: number,
  ): void;
  end(): void;
}

interface BaselineGpuCommandEncoderLikeV1 {
  beginRenderPass(descriptor: {
    readonly label: string;
    readonly colorAttachments: readonly [
      {
        readonly view: object;
        readonly loadOp: 'clear' | 'load';
        readonly storeOp: 'store';
        readonly clearValue: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      },
    ];
  }): BaselineGpuRenderPassLikeV1;
  copyTextureToTexture(
    source: { readonly texture: BaselineGpuTextureLikeV1 },
    destination: { readonly texture: BaselineGpuTextureLikeV1 },
    copySize: {
      readonly width: number;
      readonly height: number;
      readonly depthOrArrayLayers: 1;
    },
  ): void;
  finish(): object;
}

interface BaselineGpuDeviceLikeV1 extends IllustroGpuDeviceV1 {
  readonly queue: {
    writeBuffer(buffer: BaselineGpuBufferLikeV1, bufferOffset: number, data: Float32Array): void;
    writeTexture?(
      destination: {
        readonly texture: BaselineGpuTextureLikeV1;
        readonly origin: { readonly x: number; readonly y: number; readonly z: 0 };
      },
      data: Uint8Array,
      layout: { readonly offset: 0; readonly bytesPerRow: number; readonly rowsPerImage: number },
      size: { readonly width: number; readonly height: number; readonly depthOrArrayLayers: 1 },
    ): void;
    submit(commandBuffers: readonly object[]): void;
  };
  createBuffer(descriptor: {
    readonly label: string;
    readonly size: number;
    readonly usage: number;
  }): BaselineGpuBufferLikeV1;
  createTexture(descriptor: {
    readonly label: string;
    readonly size: {
      readonly width: number;
      readonly height: number;
      readonly depthOrArrayLayers: 1;
    };
    readonly format: string;
    readonly usage: number;
  }): BaselineGpuTextureLikeV1;
  createCommandEncoder(descriptor: { readonly label: string }): BaselineGpuCommandEncoderLikeV1;
  createRenderPipeline(descriptor: {
    readonly label: string;
    readonly layout: 'auto';
    readonly vertex: {
      readonly module: unknown;
      readonly entryPoint: 'baseline_brush_vertex';
      readonly buffers: readonly [
        {
          readonly arrayStride: number;
          readonly stepMode: 'instance';
          readonly attributes: readonly [
            { readonly shaderLocation: 0; readonly offset: 0; readonly format: 'float32x2' },
            { readonly shaderLocation: 1; readonly offset: 8; readonly format: 'float32x2' },
            { readonly shaderLocation: 2; readonly offset: 16; readonly format: 'float32' },
            { readonly shaderLocation: 3; readonly offset: 20; readonly format: 'float32x3' },
          ];
        },
      ];
    };
    readonly fragment: {
      readonly module: unknown;
      readonly entryPoint: 'baseline_brush_fragment';
      readonly targets: readonly [
        {
          readonly format: string;
          readonly blend: {
            readonly color: {
              readonly srcFactor: 'one';
              readonly dstFactor: 'one-minus-src-alpha';
              readonly operation: 'add';
            };
            readonly alpha: {
              readonly srcFactor: 'one';
              readonly dstFactor: 'one-minus-src-alpha';
              readonly operation: 'add';
            };
          };
          readonly writeMask: number;
        },
      ];
    };
    readonly primitive: { readonly topology: 'triangle-list' };
  }): object;
}

export interface BaselinePaintRendererSnapshotV1 {
  readonly schema: 'illustro.baseline-paint-renderer/1';
  readonly documentWidth: number | null;
  readonly documentHeight: number | null;
  readonly activeStrokeId: string | null;
  readonly activeDabCount: number;
  readonly committedStrokeCount: number;
  readonly committedDabCount: number;
  readonly surfaceReady: boolean;
  readonly deviceReady: boolean;
}

export interface BaselinePaintCommittedStrokeV1 {
  readonly strokeId: string;
  readonly layerId?: string;
  readonly operation?: BaselineBrushCompositeOperationV1;
  readonly dabs: readonly BaselineBrushDabV1[];
}

export interface BaselinePaintAffectedTileV1 {
  readonly coordinate: TileCoordinateV1;
  readonly dirty: DirtyTileStateV1 | null;
}

export interface BaselinePaintFinalizationV1 {
  readonly schema: 'illustro.baseline-paint-finalization/1';
  readonly strokeId: string;
  readonly dabCount: number;
  readonly affectedTiles: readonly BaselinePaintAffectedTileV1[];
  readonly tilePatches: readonly BaselineRasterTilePatchV1[];
  readonly renderer: BaselinePaintRendererSnapshotV1;
}

interface ActiveBaselineStrokeV1 {
  readonly strokeId: string;
  readonly operation: BaselineBrushCompositeOperationV1;
  readonly dabs: BaselineBrushDabV1[];
}

interface RetainedSceneV1 {
  readonly texture: BaselineGpuTextureLikeV1;
  readonly width: number;
  readonly height: number;
  readonly format: string;
}

function freezeDabs(dabs: readonly BaselineBrushDabV1[]): readonly BaselineBrushDabV1[] {
  return Object.freeze(
    dabs.map((dab) =>
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: dab.x,
        y: dab.y,
        radius: dab.radius,
        radiusX: baselineDabRadiusXV1(dab),
        radiusY: baselineDabRadiusYV1(dab),
        opacity: dab.opacity,
        ...(dab.color === undefined
          ? {}
          : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),
      }),
    ),
  );
}

function isRenderableDab(dab: BaselineBrushDabV1): boolean {
  return (
    dab.schema === 'illustro.baseline-brush-dab/1' &&
    Number.isFinite(dab.x) &&
    Number.isFinite(dab.y) &&
    Number.isFinite(dab.radius) &&
    dab.radius > 0 &&
    Number.isFinite(baselineDabRadiusXV1(dab)) &&
    baselineDabRadiusXV1(dab) > 0 &&
    Number.isFinite(baselineDabRadiusYV1(dab)) &&
    baselineDabRadiusYV1(dab) > 0 &&
    Number.isFinite(dab.opacity) &&
    dab.opacity >= 0 &&
    dab.opacity <= 1
  );
}

function sameDab(left: BaselineBrushDabV1, right: BaselineBrushDabV1): boolean {
  return (
    left.schema === right.schema &&
    left.x === right.x &&
    left.y === right.y &&
    left.radius === right.radius &&
    baselineDabRadiusXV1(left) === baselineDabRadiusXV1(right) &&
    baselineDabRadiusYV1(left) === baselineDabRadiusYV1(right) &&
    left.opacity === right.opacity &&
    baselineDabColorV1(left).every(
      (component, index) => component === baselineDabColorV1(right)[index],
    )
  );
}

function isDabPrefix(
  prefix: readonly BaselineBrushDabV1[],
  complete: readonly BaselineBrushDabV1[],
): boolean {
  if (prefix.length > complete.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    const left = prefix[index];
    const right = complete[index];
    if (left === undefined || right === undefined || !sameDab(left, right)) return false;
  }
  return true;
}

function requireRenderDevice(device: IllustroGpuDeviceV1): BaselineGpuDeviceLikeV1 {
  const candidate = device as Partial<BaselineGpuDeviceLikeV1>;
  if (
    candidate.queue === undefined ||
    typeof candidate.queue.writeBuffer !== 'function' ||
    typeof candidate.queue.submit !== 'function' ||
    typeof candidate.createBuffer !== 'function' ||
    typeof candidate.createTexture !== 'function' ||
    typeof candidate.createCommandEncoder !== 'function' ||
    typeof candidate.createRenderPipeline !== 'function'
  ) {
    throw new Error('WebGPU baseline brush render operations are unavailable');
  }
  return candidate as BaselineGpuDeviceLikeV1;
}

function canvasContext(surface: RendererSurfaceLikeV1): BaselineGpuCanvasContextLikeV1 {
  const context = surface.getContext('webgpu') as Partial<BaselineGpuCanvasContextLikeV1> | null;
  if (context === null || typeof context.getCurrentTexture !== 'function') {
    throw new Error('WebGPU canvas current-texture access is unavailable');
  }
  return context as BaselineGpuCanvasContextLikeV1;
}

function createInstanceData(
  dabs: readonly BaselineBrushDabV1[],
  documentWidth: number,
  documentHeight: number,
  targetWidth: number,
  targetHeight: number,
): Float32Array {
  const values = new Float32Array(dabs.length * INSTANCE_FLOATS);
  const scaleX = targetWidth / documentWidth;
  const scaleY = targetHeight / documentHeight;
  for (const [index, dab] of dabs.entries()) {
    if (!isRenderableDab(dab)) throw new RangeError('invalid baseline brush dab');
    const offset = index * INSTANCE_FLOATS;
    const centerX = dab.x * scaleX;
    const centerY = dab.y * scaleY;
    values[offset] = (centerX / targetWidth) * 2 - 1;
    values[offset + 1] = 1 - (centerY / targetHeight) * 2;
    values[offset + 2] = (baselineDabRadiusXV1(dab) * scaleX * 2) / targetWidth;
    values[offset + 3] = (baselineDabRadiusYV1(dab) * scaleY * 2) / targetHeight;
    values[offset + 4] = dab.opacity;
    const color = baselineDabColorV1(dab);
    values[offset + 5] = color[0];
    values[offset + 6] = color[1];
    values[offset + 7] = color[2];
  }
  return values;
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function surfaceTileBytes(
  tile: BaselineRasterTileImageV1,
  targetWidth: number,
  targetHeight: number,
  canvasFormat: string,
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(targetWidth * targetHeight * 4);
  const bgra = canvasFormat.startsWith('bgra8');
  if (!bgra && !canvasFormat.startsWith('rgba8')) {
    throw new Error(`baseline tile patch does not support canvas format: ${canvasFormat}`);
  }
  const halfView =
    tile.pixelFormat === 'rgba16-float'
      ? new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength)
      : null;
  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceY = Math.min(tile.height - 1, Math.floor((targetY * tile.height) / targetHeight));
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceX = Math.min(tile.width - 1, Math.floor((targetX * tile.width) / targetWidth));
      const sourcePixel = sourceY * tile.width + sourceX;
      let red: number;
      let green: number;
      let blue: number;
      let alpha: number;
      if (halfView === null) {
        const sourceOffset = sourcePixel * 4;
        red = tile.bytes[sourceOffset] ?? 0;
        green = tile.bytes[sourceOffset + 1] ?? 0;
        blue = tile.bytes[sourceOffset + 2] ?? 0;
        alpha = tile.bytes[sourceOffset + 3] ?? 0;
      } else {
        const sourceOffset = sourcePixel * 8;
        red = Math.round(
          Math.min(1, Math.max(0, halfToFloat(halfView.getUint16(sourceOffset, true)))) * 255,
        );
        green = Math.round(
          Math.min(1, Math.max(0, halfToFloat(halfView.getUint16(sourceOffset + 2, true)))) * 255,
        );
        blue = Math.round(
          Math.min(1, Math.max(0, halfToFloat(halfView.getUint16(sourceOffset + 4, true)))) * 255,
        );
        alpha = Math.round(
          Math.min(1, Math.max(0, halfToFloat(halfView.getUint16(sourceOffset + 6, true)))) * 255,
        );
      }
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      const alphaUnit = alpha / 255;
      const premultipliedRed = Math.round(red * alphaUnit);
      const premultipliedGreen = Math.round(green * alphaUnit);
      const premultipliedBlue = Math.round(blue * alphaUnit);
      result[targetOffset] = bgra ? premultipliedBlue : premultipliedRed;
      result[targetOffset + 1] = premultipliedGreen;
      result[targetOffset + 2] = bgra ? premultipliedRed : premultipliedBlue;
      result[targetOffset + 3] = alpha;
    }
  }
  return result;
}

class BaselineGpuSurfaceRasterizerV1 {
  #device: IllustroGpuDeviceV1 | null = null;
  #shaderModule: unknown = null;
  #scene: RetainedSceneV1 | null = null;
  #instanceBuffer: BaselineGpuBufferLikeV1 | null = null;
  #instanceBufferCapacity = 0;
  readonly #pipelines = new Map<string, object>();

  attachDevice(device: IllustroGpuDeviceV1 | null): void {
    this.invalidateScene();
    this.#instanceBuffer?.destroy?.();
    this.#instanceBuffer = null;
    this.#instanceBufferCapacity = 0;
    this.#device = device;
    this.#shaderModule = null;
    this.#pipelines.clear();
  }

  invalidateScene(): void {
    this.#scene?.texture.destroy?.();
    this.#scene = null;
  }

  hasSceneFor(surface: RendererSurfaceLikeV1, format: string): boolean {
    return (
      this.#scene !== null &&
      this.#scene.width === surface.width &&
      this.#scene.height === surface.height &&
      this.#scene.format === format
    );
  }

  render(input: {
    readonly surface: RendererSurfaceLikeV1;
    readonly format: string;
    readonly documentWidth: number;
    readonly documentHeight: number;
    readonly dabs: readonly BaselineBrushDabV1[];
    readonly mode: 'replace' | 'append';
  }): void {
    const rawDevice = this.#device;
    if (rawDevice === null) throw new Error('baseline brush renderer has no WebGPU device');
    const device = requireRenderDevice(rawDevice);
    if (input.format.length === 0)
      throw new TypeError('baseline brush canvas format must not be empty');
    if (input.surface.width < 1 || input.surface.height < 1) {
      throw new RangeError('baseline brush target surface must have positive dimensions');
    }
    if (input.documentWidth < 1 || input.documentHeight < 1) {
      throw new RangeError('baseline brush document must have positive dimensions');
    }
    if (input.dabs.some((dab) => !isRenderableDab(dab))) {
      throw new RangeError('invalid baseline brush dab');
    }

    let scene = this.#scene;
    if (input.mode === 'append') {
      if (!this.hasSceneFor(input.surface, input.format) || scene === null) {
        throw new Error('baseline retained scene is unavailable for incremental append');
      }
    } else if (!this.hasSceneFor(input.surface, input.format) || scene === null) {
      this.invalidateScene();
      scene = Object.freeze({
        texture: device.createTexture({
          label: 'illustro-baseline-retained-scene',
          size: {
            width: input.surface.width,
            height: input.surface.height,
            depthOrArrayLayers: 1,
          },
          format: input.format,
          usage:
            GPU_TEXTURE_USAGE_COPY_SRC |
            GPU_TEXTURE_USAGE_COPY_DST |
            GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
        }),
        width: input.surface.width,
        height: input.surface.height,
        format: input.format,
      });
      this.#scene = scene;
    }

    const context = canvasContext(input.surface);
    const encoder = device.createCommandEncoder({ label: 'illustro-baseline-brush-surface' });
    if (input.mode === 'replace' || input.dabs.length > 0) {
      const pass = encoder.beginRenderPass({
        label: 'illustro-baseline-brush-retained-pass',
        colorAttachments: [
          {
            view: scene.texture.createView(),
            loadOp: input.mode === 'replace' ? 'clear' : 'load',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      if (input.dabs.length > 0) {
        const instanceData = createInstanceData(
          input.dabs,
          input.documentWidth,
          input.documentHeight,
          input.surface.width,
          input.surface.height,
        );
        const buffer = this.#requireInstanceBuffer(device, instanceData.byteLength);
        device.queue.writeBuffer(buffer, 0, instanceData);
        pass.setPipeline(this.#pipeline(input.format, device));
        pass.setVertexBuffer(0, buffer);
        pass.draw(6, input.dabs.length, 0, 0);
      }
      pass.end();
    }

    encoder.copyTextureToTexture(
      { texture: scene.texture },
      { texture: context.getCurrentTexture() },
      {
        width: input.surface.width,
        height: input.surface.height,
        depthOrArrayLayers: 1,
      },
    );
    device.queue.submit([encoder.finish()]);
  }

  patchTiles(input: {
    readonly surface: RendererSurfaceLikeV1;
    readonly format: string;
    readonly documentWidth: number;
    readonly documentHeight: number;
    readonly tiles: readonly BaselineRasterTileImageV1[];
  }): void {
    const rawDevice = this.#device;
    if (rawDevice === null) throw new Error('baseline brush renderer has no WebGPU device');
    const device = requireRenderDevice(rawDevice);
    const scene = this.#scene;
    if (!this.hasSceneFor(input.surface, input.format) || scene === null) {
      throw new Error('baseline retained scene is unavailable for tile patching');
    }
    if (typeof device.queue.writeTexture !== 'function') {
      throw new Error('WebGPU queue.writeTexture is unavailable for tile restoration');
    }
    for (const tile of input.tiles) {
      const bounds = tileBoundsForDocumentV1(
        input.documentWidth,
        input.documentHeight,
        tile.coordinate,
      );
      const targetX = Math.floor((bounds.x * input.surface.width) / input.documentWidth);
      const targetY = Math.floor((bounds.y * input.surface.height) / input.documentHeight);
      const targetRight = Math.ceil(
        ((bounds.x + bounds.validWidth) * input.surface.width) / input.documentWidth,
      );
      const targetBottom = Math.ceil(
        ((bounds.y + bounds.validHeight) * input.surface.height) / input.documentHeight,
      );
      const width = Math.max(1, Math.min(input.surface.width - targetX, targetRight - targetX));
      const height = Math.max(1, Math.min(input.surface.height - targetY, targetBottom - targetY));
      const bytes = surfaceTileBytes(tile, width, height, input.format);
      device.queue.writeTexture(
        { texture: scene.texture, origin: { x: targetX, y: targetY, z: 0 } },
        bytes,
        { offset: 0, bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 },
      );
    }
    const context = canvasContext(input.surface);
    const encoder = device.createCommandEncoder({ label: 'illustro-baseline-tile-patch-present' });
    encoder.copyTextureToTexture(
      { texture: scene.texture },
      { texture: context.getCurrentTexture() },
      { width: input.surface.width, height: input.surface.height, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
  }

  #pipeline(format: string, device: BaselineGpuDeviceLikeV1): object {
    const existing = this.#pipelines.get(format);
    if (existing !== undefined) return existing;
    this.#shaderModule ??= device.createShaderModule({
      label: 'illustro-baseline-brush-shader',
      code: baselineBrushShaderSource,
    });
    const pipeline = device.createRenderPipeline({
      label: `illustro-baseline-brush-${format}`,
      layout: 'auto',
      vertex: {
        module: this.#shaderModule,
        entryPoint: 'baseline_brush_vertex',
        buffers: [
          {
            arrayStride: INSTANCE_STRIDE_BYTES,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
              { shaderLocation: 2, offset: 16, format: 'float32' },
              { shaderLocation: 3, offset: 20, format: 'float32x3' },
            ],
          },
        ],
      },
      fragment: {
        module: this.#shaderModule,
        entryPoint: 'baseline_brush_fragment',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
            writeMask: 0x0f,
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.#pipelines.set(format, pipeline);
    return pipeline;
  }

  #requireInstanceBuffer(
    device: BaselineGpuDeviceLikeV1,
    requiredBytes: number,
  ): BaselineGpuBufferLikeV1 {
    const existing = this.#instanceBuffer;
    if (existing !== null && this.#instanceBufferCapacity >= requiredBytes) return existing;
    const alignedRequired =
      Math.ceil(requiredBytes / INSTANCE_BUFFER_ALIGNMENT_BYTES) * INSTANCE_BUFFER_ALIGNMENT_BYTES;
    const capacity = Math.max(
      INSTANCE_BUFFER_ALIGNMENT_BYTES,
      alignedRequired,
      this.#instanceBufferCapacity * 2,
    );
    const replacement = device.createBuffer({
      label: 'illustro-baseline-brush-instance-pool',
      size: capacity,
      usage: GPU_BUFFER_USAGE_COPY_DST | GPU_BUFFER_USAGE_VERTEX,
    });
    existing?.destroy?.();
    this.#instanceBuffer = replacement;
    this.#instanceBufferCapacity = capacity;
    return replacement;
  }
}

export class BaselinePaintRendererV1 {
  readonly #gpu = new BaselineGpuSurfaceRasterizerV1();
  #device: IllustroGpuDeviceV1 | null = null;
  #surface: RendererSurfaceLikeV1 | null = null;
  #surfaceFormat: string | null = null;
  #tileState: RendererTileStateV1 | null = null;
  #canonicalTiles: BaselineRasterTileStoreV1 | null = null;
  #layers: readonly BaselineRasterLayerDescriptorV1[] = Object.freeze([]);
  #documentWidth: number | null = null;
  #documentHeight: number | null = null;
  #workingSpace: DocumentColorSpace = 'srgb';
  #activeStroke: ActiveBaselineStrokeV1 | null = null;
  #committedStrokeCount = 0;
  #committedDabCount = 0;
  readonly #finalizations = new Map<string, BaselinePaintFinalizationV1>();

  snapshot(): BaselinePaintRendererSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.baseline-paint-renderer/1' as const,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      activeStrokeId: this.#activeStroke?.strokeId ?? null,
      activeDabCount: this.#activeStroke?.dabs.length ?? 0,
      committedStrokeCount: this.#committedStrokeCount,
      committedDabCount: this.#committedDabCount,
      surfaceReady: this.#surface !== null && this.#surfaceFormat !== null,
      deviceReady: this.#device !== null,
    });
  }

  attachDevice(device: IllustroGpuDeviceV1 | null): void {
    this.#device = device;
    this.#gpu.attachDevice(device);
    this.#rebuildScene();
  }

  attachSurface(surface: RendererSurfaceLikeV1 | null, format: string | null): void {
    if ((surface === null) !== (format === null)) {
      throw new Error('baseline paint surface and format must be attached together');
    }
    this.#surface = surface;
    this.#surfaceFormat = format;
    this.#gpu.invalidateScene();
    this.#rebuildScene();
  }

  configureDocument(
    tileState: RendererTileStateV1,
    width: number,
    height: number,
    precision: DocumentPrecision = 'rgba8-unorm',
    layers: readonly BaselineRasterLayerDescriptorV1[] = Object.freeze([]),
    workingSpace: DocumentColorSpace = 'srgb',
  ): BaselinePaintRendererSnapshotV1 {
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new RangeError('baseline paint document dimensions must be positive safe integers');
    }
    this.#tileState = tileState;
    this.#documentWidth = width;
    this.#documentHeight = height;
    this.#workingSpace = workingSpace;
    this.#layers =
      layers.length > 0
        ? Object.freeze([...layers])
        : Object.freeze([Object.freeze({ layerId: '__baseline__', visible: true, opacity: 1 })]);
    this.#canonicalTiles = new BaselineRasterTileStoreV1(
      width,
      height,
      precision,
      this.#layers,
      this.#workingSpace,
    );
    this.#activeStroke = null;
    this.#committedStrokeCount = 0;
    this.#committedDabCount = 0;
    this.#finalizations.clear();
    this.#gpu.invalidateScene();
    this.#rebuildScene();
    return this.snapshot();
  }

  presentStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
    layerId?: string,
    operation: BaselineBrushCompositeOperationV1 = 'paint',
  ): BaselinePaintRendererSnapshotV1 {
    const { canonicalTiles } = this.#requireDocument();
    if (strokeId.length === 0) throw new TypeError('baseline paint strokeId must not be empty');
    if (this.#finalizations.has(strokeId)) return this.snapshot();
    const delta = freezeDabs(dabs);
    if (delta.some((dab) => !isRenderableDab(dab)))
      throw new RangeError('invalid baseline brush dab');

    if (this.#activeStroke !== null && this.#activeStroke.strokeId !== strokeId) {
      throw new Error('another baseline paint stroke is already active');
    }
    if (this.#activeStroke === null) {
      this.#activeStroke = { strokeId, operation, dabs: [] };
    }
    if (this.#activeStroke.operation !== operation) {
      throw new Error('baseline paint stroke changed brush operation');
    }
    canonicalTiles.applyDabs(this.#resolveLayerId(layerId), strokeId, delta, operation);
    this.#activeStroke.dabs.push(...delta);
    if (delta.length > 0) {
      if (operation === 'erase') {
        const { width, height } = this.#requireDocument();
        this.#patchCompositeTiles(
          planBaselineBrushTilesV1(delta, width, height).map((plan) => plan.coordinate),
        );
      } else {
        this.#appendDabs(delta);
      }
    }
    return this.snapshot();
  }

  cancelStroke(strokeId: string): BaselinePaintRendererSnapshotV1 {
    if (this.#activeStroke?.strokeId === strokeId) {
      const canonicalTiles = this.#canonicalTiles;
      const patches = canonicalTiles?.cancel(strokeId) ?? Object.freeze([]);
      this.#activeStroke = null;
      this.#patchCompositeTiles(patches.map((patch) => patch.coordinate));
    }
    return this.snapshot();
  }

  finalizeStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
    layerId?: string,
    operation: BaselineBrushCompositeOperationV1 = 'paint',
  ): BaselinePaintFinalizationV1 {
    const existing = this.#finalizations.get(strokeId);
    if (existing !== undefined) return existing;
    const { tileState, canonicalTiles, width, height } = this.#requireDocument();
    if (strokeId.length === 0) throw new TypeError('baseline paint strokeId must not be empty');
    const frozenDabs = freezeDabs(dabs);
    if (frozenDabs.some((dab) => !isRenderableDab(dab))) {
      throw new RangeError('invalid baseline brush dab');
    }

    const active = this.#activeStroke;
    if (active !== null && active.operation !== operation) {
      throw new Error('baseline finalized stroke changed brush operation');
    }
    const resolvedLayerId = this.#resolveLayerId(layerId);
    if (active?.strokeId === strokeId && isDabPrefix(active.dabs, frozenDabs)) {
      const missingTail = frozenDabs.slice(active.dabs.length);
      if (missingTail.length > 0) {
        canonicalTiles.applyDabs(resolvedLayerId, strokeId, missingTail, operation);
        active.dabs.push(...missingTail);
        if (operation === 'erase') {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(missingTail, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(missingTail);
        }
      } else if (!this.#hasCurrentScene()) {
        this.#rebuildScene();
      }
    } else if (active === null) {
      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };
      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);
      if (frozenDabs.length > 0) {
        if (operation === 'erase') {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(frozenDabs);
        }
      }
    } else {
      throw new Error('baseline finalized dabs do not extend the active retained prefix');
    }

    const affectedTiles = planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => {
      tileState.allocate(plan.coordinate);
      const dirty = tileState.markDirty(plan.coordinate, plan.dirtyRect);
      return Object.freeze({ coordinate: plan.coordinate, dirty });
    });
    const tilePatches = canonicalTiles.finalize(strokeId);
    this.#committedStrokeCount += 1;
    this.#committedDabCount += frozenDabs.length;
    if (this.#activeStroke?.strokeId === strokeId) this.#activeStroke = null;

    const finalization = Object.freeze({
      schema: 'illustro.baseline-paint-finalization/1' as const,
      strokeId,
      dabCount: frozenDabs.length,
      affectedTiles: Object.freeze(affectedTiles),
      tilePatches,
      renderer: this.snapshot(),
    });
    this.#finalizations.set(strokeId, finalization);
    while (this.#finalizations.size > 8) {
      const oldest = this.#finalizations.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#finalizations.delete(oldest);
    }
    return finalization;
  }

  restoreCommittedStrokes(
    strokes: readonly BaselinePaintCommittedStrokeV1[],
  ): BaselinePaintRendererSnapshotV1 {
    const { tileState, width, height } = this.#requireDocument();
    tileState.resetContent();
    const precision = this.#canonicalTiles?.pixelFormat ?? 'rgba8-unorm';
    this.#canonicalTiles = new BaselineRasterTileStoreV1(
      width,
      height,
      precision,
      this.#layers,
      this.#workingSpace,
    );
    this.#activeStroke = null;
    this.#committedStrokeCount = 0;
    this.#committedDabCount = 0;
    this.#finalizations.clear();
    const seen = new Set<string>();
    for (const stroke of strokes) {
      if (stroke.strokeId.length === 0 || seen.has(stroke.strokeId)) {
        throw new TypeError('baseline restored stroke IDs must be unique and non-empty');
      }
      seen.add(stroke.strokeId);
      const dabs = freezeDabs(stroke.dabs);
      if (dabs.some((dab) => !isRenderableDab(dab)))
        throw new RangeError('invalid restored baseline dab');
      for (const plan of planBaselineBrushTilesV1(dabs, width, height)) {
        tileState.allocate(plan.coordinate);
        tileState.markDirty(plan.coordinate, plan.dirtyRect);
      }
      const layerId = this.#resolveLayerId(stroke.layerId);
      this.#canonicalTiles.applyDabs(layerId, stroke.strokeId, dabs, stroke.operation ?? 'paint');
      this.#canonicalTiles.finalize(stroke.strokeId);
      this.#committedStrokeCount += 1;
      this.#committedDabCount += dabs.length;
    }
    this.#rebuildScene();
    return this.snapshot();
  }

  restoreCanonicalTiles(
    tiles: readonly BaselineRasterTileImageV1[],
    layers: readonly BaselineRasterLayerDescriptorV1[] = this.#layers,
  ): BaselinePaintRendererSnapshotV1 {
    const { tileState, canonicalTiles } = this.#requireDocument();
    tileState.resetContent();
    this.#layers = Object.freeze([...layers]);
    canonicalTiles.setLayers(this.#layers);
    canonicalTiles.restore(tiles);
    this.#activeStroke = null;
    this.#committedStrokeCount = 0;
    this.#committedDabCount = 0;
    this.#finalizations.clear();
    for (const tile of tiles) {
      tileState.allocate(tile.coordinate);
      tileState.markDirty(tile.coordinate, {
        x: 0,
        y: 0,
        width: tile.width,
        height: tile.height,
      });
    }
    this.#rebuildScene();
    return this.snapshot();
  }

  applyTilePatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): BaselinePaintRendererSnapshotV1 {
    const { tileState, canonicalTiles, width, height } = this.#requireDocument();
    const affected = canonicalTiles.applyPatches(patches, direction);
    for (const coordinate of affected) {
      const bounds = tileBoundsForDocumentV1(width, height, coordinate);
      tileState.allocate(coordinate);
      tileState.markDirty(coordinate, {
        x: 0,
        y: 0,
        width: bounds.validWidth,
        height: bounds.validHeight,
      });
    }
    this.#activeStroke = null;
    this.#patchCompositeTiles(affected);
    return this.snapshot();
  }

  exportCanonicalTiles(): readonly BaselineRasterTileImageV1[] {
    return this.#requireDocument().canonicalTiles.exportTiles();
  }

  exportCompositeTiles(
    options: { readonly includeDraft?: boolean } = {},
  ): readonly BaselineRasterTileImageV1[] {
    return this.#requireDocument().canonicalTiles.compositeTiles(undefined, options);
  }

  dispose(): void {
    this.#gpu.attachDevice(null);
    this.#device = null;
    this.#surface = null;
    this.#surfaceFormat = null;
    this.#tileState = null;
    this.#canonicalTiles = null;
    this.#layers = Object.freeze([]);
    this.#documentWidth = null;
    this.#documentHeight = null;
    this.#activeStroke = null;
    this.#committedStrokeCount = 0;
    this.#committedDabCount = 0;
    this.#finalizations.clear();
  }

  #hasCurrentScene(): boolean {
    return (
      this.#surface !== null &&
      this.#surfaceFormat !== null &&
      this.#gpu.hasSceneFor(this.#surface, this.#surfaceFormat)
    );
  }

  #appendDabs(dabs: readonly BaselineBrushDabV1[]): void {
    if (
      this.#device === null ||
      this.#surface === null ||
      this.#surfaceFormat === null ||
      this.#documentWidth === null ||
      this.#documentHeight === null
    ) {
      return;
    }
    if (!this.#gpu.hasSceneFor(this.#surface, this.#surfaceFormat)) {
      this.#rebuildScene();
      return;
    }
    this.#gpu.render({
      surface: this.#surface,
      format: this.#surfaceFormat,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      dabs,
      mode: 'append',
    });
  }

  #rebuildScene(): void {
    if (
      this.#device === null ||
      this.#surface === null ||
      this.#surfaceFormat === null ||
      this.#documentWidth === null ||
      this.#documentHeight === null
    ) {
      return;
    }
    this.#gpu.render({
      surface: this.#surface,
      format: this.#surfaceFormat,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      dabs: Object.freeze([]),
      mode: 'replace',
    });
    const tiles = this.#canonicalTiles?.compositeTiles() ?? Object.freeze([]);
    if (tiles.length > 0) {
      this.#gpu.patchTiles({
        surface: this.#surface,
        format: this.#surfaceFormat,
        documentWidth: this.#documentWidth,
        documentHeight: this.#documentHeight,
        tiles,
      });
    }
  }

  #patchCompositeTiles(coordinates: readonly TileCoordinateV1[]): void {
    if (coordinates.length === 0) return;
    if (
      this.#device === null ||
      this.#surface === null ||
      this.#surfaceFormat === null ||
      this.#documentWidth === null ||
      this.#documentHeight === null ||
      this.#canonicalTiles === null
    ) {
      return;
    }
    if (!this.#gpu.hasSceneFor(this.#surface, this.#surfaceFormat)) {
      this.#rebuildScene();
      return;
    }
    this.#gpu.patchTiles({
      surface: this.#surface,
      format: this.#surfaceFormat,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      tiles: this.#canonicalTiles.compositeTiles(coordinates),
    });
  }

  #resolveLayerId(layerId?: string): string {
    const resolved = layerId ?? this.#layers[0]?.layerId;
    if (resolved === undefined || resolved.length === 0) {
      throw new Error('baseline paint has no raster layer');
    }
    if (!this.#layers.some((layer) => layer.layerId === resolved)) {
      throw new Error(`baseline paint raster layer is missing: ${resolved}`);
    }
    return resolved;
  }

  #requireDocument(): {
    readonly tileState: RendererTileStateV1;
    readonly canonicalTiles: BaselineRasterTileStoreV1;
    readonly width: number;
    readonly height: number;
  } {
    if (
      this.#tileState === null ||
      this.#canonicalTiles === null ||
      this.#documentWidth === null ||
      this.#documentHeight === null
    ) {
      throw new Error('baseline paint document is not configured');
    }
    return {
      tileState: this.#tileState,
      canonicalTiles: this.#canonicalTiles,
      width: this.#documentWidth,
      height: this.#documentHeight,
    };
  }
}
