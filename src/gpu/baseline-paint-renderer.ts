import { baselineBrushShaderSource } from '../generated/baseline-brush-shader.js';
import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from './baseline-brush.js';
import type { RendererSurfaceLikeV1 } from './renderer-device-resources.js';
import type { RendererTileStateV1 } from './renderer-tile-state.js';
import type { DirtyTileStateV1, TileCoordinateV1 } from './sparse-tile-model.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';

const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_TEXTURE_USAGE_COPY_SRC = 0x0001;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x0010;
const INSTANCE_FLOATS = 5;
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

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
  readonly renderer: BaselinePaintRendererSnapshotV1;
}

interface ActiveBaselineStrokeV1 {
  readonly strokeId: string;
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
    left.opacity === right.opacity
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
  }
  return values;
}

class BaselineGpuSurfaceRasterizerV1 {
  #device: IllustroGpuDeviceV1 | null = null;
  #shaderModule: unknown = null;
  #scene: RetainedSceneV1 | null = null;
  readonly #pipelines = new Map<string, object>();

  attachDevice(device: IllustroGpuDeviceV1 | null): void {
    this.invalidateScene();
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
          usage: GPU_TEXTURE_USAGE_COPY_SRC | GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
        }),
        width: input.surface.width,
        height: input.surface.height,
        format: input.format,
      });
      this.#scene = scene;
    }

    const context = canvasContext(input.surface);
    const encoder = device.createCommandEncoder({ label: 'illustro-baseline-brush-surface' });
    let buffer: BaselineGpuBufferLikeV1 | null = null;
    try {
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
          buffer = device.createBuffer({
            label: 'illustro-baseline-brush-instances',
            size: instanceData.byteLength,
            usage: GPU_BUFFER_USAGE_COPY_DST | GPU_BUFFER_USAGE_VERTEX,
          });
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
    } finally {
      buffer?.destroy?.();
    }
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
}

export class BaselinePaintRendererV1 {
  readonly #gpu = new BaselineGpuSurfaceRasterizerV1();
  #device: IllustroGpuDeviceV1 | null = null;
  #surface: RendererSurfaceLikeV1 | null = null;
  #surfaceFormat: string | null = null;
  #tileState: RendererTileStateV1 | null = null;
  #documentWidth: number | null = null;
  #documentHeight: number | null = null;
  #activeStroke: ActiveBaselineStrokeV1 | null = null;
  readonly #committedStrokes = new Map<string, readonly BaselineBrushDabV1[]>();
  #committedDabCount = 0;
  readonly #finalizations = new Map<string, BaselinePaintFinalizationV1>();

  snapshot(): BaselinePaintRendererSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.baseline-paint-renderer/1' as const,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      activeStrokeId: this.#activeStroke?.strokeId ?? null,
      activeDabCount: this.#activeStroke?.dabs.length ?? 0,
      committedStrokeCount: this.#committedStrokes.size,
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
  ): BaselinePaintRendererSnapshotV1 {
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new RangeError('baseline paint document dimensions must be positive safe integers');
    }
    this.#tileState = tileState;
    this.#documentWidth = width;
    this.#documentHeight = height;
    this.#activeStroke = null;
    this.#committedStrokes.clear();
    this.#committedDabCount = 0;
    this.#finalizations.clear();
    this.#gpu.invalidateScene();
    this.#rebuildScene();
    return this.snapshot();
  }

  presentStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
  ): BaselinePaintRendererSnapshotV1 {
    this.#requireDocument();
    if (strokeId.length === 0) throw new TypeError('baseline paint strokeId must not be empty');
    if (this.#finalizations.has(strokeId)) return this.snapshot();
    const delta = freezeDabs(dabs);
    if (delta.some((dab) => !isRenderableDab(dab)))
      throw new RangeError('invalid baseline brush dab');

    if (this.#activeStroke !== null && this.#activeStroke.strokeId !== strokeId) {
      this.#activeStroke = null;
      this.#rebuildScene();
    }
    if (this.#activeStroke === null) {
      this.#activeStroke = { strokeId, dabs: [] };
    }
    this.#activeStroke.dabs.push(...delta);
    if (delta.length > 0) this.#appendDabs(delta);
    return this.snapshot();
  }

  cancelStroke(strokeId: string): BaselinePaintRendererSnapshotV1 {
    if (this.#activeStroke?.strokeId === strokeId) {
      this.#activeStroke = null;
      this.#rebuildScene();
    }
    return this.snapshot();
  }

  finalizeStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
  ): BaselinePaintFinalizationV1 {
    const existing = this.#finalizations.get(strokeId);
    if (existing !== undefined) return existing;
    const { tileState, width, height } = this.#requireDocument();
    if (strokeId.length === 0) throw new TypeError('baseline paint strokeId must not be empty');
    const frozenDabs = freezeDabs(dabs);
    if (frozenDabs.some((dab) => !isRenderableDab(dab))) {
      throw new RangeError('invalid baseline brush dab');
    }

    const active = this.#activeStroke;
    if (active?.strokeId === strokeId && isDabPrefix(active.dabs, frozenDabs)) {
      const missingTail = frozenDabs.slice(active.dabs.length);
      if (missingTail.length > 0) {
        active.dabs.push(...missingTail);
        this.#appendDabs(missingTail);
      } else if (!this.#hasCurrentScene()) {
        this.#rebuildScene();
      }
    } else {
      this.#activeStroke = { strokeId, dabs: [...frozenDabs] };
      this.#rebuildScene();
    }

    const affectedTiles = planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => {
      tileState.allocate(plan.coordinate);
      const dirty = tileState.markDirty(plan.coordinate, plan.dirtyRect);
      return Object.freeze({ coordinate: plan.coordinate, dirty });
    });
    const previous = this.#committedStrokes.get(strokeId);
    if (previous !== undefined) this.#committedDabCount -= previous.length;
    this.#committedStrokes.set(strokeId, frozenDabs);
    this.#committedDabCount += frozenDabs.length;
    if (this.#activeStroke?.strokeId === strokeId) this.#activeStroke = null;

    const finalization = Object.freeze({
      schema: 'illustro.baseline-paint-finalization/1' as const,
      strokeId,
      dabCount: frozenDabs.length,
      affectedTiles: Object.freeze(affectedTiles),
      renderer: this.snapshot(),
    });
    this.#finalizations.set(strokeId, finalization);
    return finalization;
  }

  restoreCommittedStrokes(
    strokes: readonly BaselinePaintCommittedStrokeV1[],
  ): BaselinePaintRendererSnapshotV1 {
    const { tileState, width, height } = this.#requireDocument();
    tileState.resetContent();
    this.#activeStroke = null;
    this.#committedStrokes.clear();
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
      this.#committedStrokes.set(stroke.strokeId, dabs);
      this.#committedDabCount += dabs.length;
    }
    this.#rebuildScene();
    return this.snapshot();
  }

  dispose(): void {
    this.#gpu.attachDevice(null);
    this.#device = null;
    this.#surface = null;
    this.#surfaceFormat = null;
    this.#tileState = null;
    this.#documentWidth = null;
    this.#documentHeight = null;
    this.#activeStroke = null;
    this.#committedStrokes.clear();
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
    const dabs: BaselineBrushDabV1[] = [];
    for (const committed of this.#committedStrokes.values()) dabs.push(...committed);
    if (this.#activeStroke !== null) dabs.push(...this.#activeStroke.dabs);
    this.#gpu.render({
      surface: this.#surface,
      format: this.#surfaceFormat,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      dabs,
      mode: 'replace',
    });
  }

  #requireDocument(): {
    readonly tileState: RendererTileStateV1;
    readonly width: number;
    readonly height: number;
  } {
    if (this.#tileState === null || this.#documentWidth === null || this.#documentHeight === null) {
      throw new Error('baseline paint document is not configured');
    }
    return {
      tileState: this.#tileState,
      width: this.#documentWidth,
      height: this.#documentHeight,
    };
  }
}
