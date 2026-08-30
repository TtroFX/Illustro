import {
  INITIAL_REVISION,
  createLayerId,
  createMaskId,
  createNodeId,
  createObjectId,
  type LayerId,
  type MaskId,
  type NodeId,
  type ObjectId,
  type ResourceId,
  type Revision,
} from './identity.js';

export const LAYER_TYPE_IDS = [
  'raster',
  'vector',
  'text',
  'fill',
  'gradient',
  'adjustment',
  'folder',
  'linkedObject',
  'lineartBoundary',
] as const;

export type LayerTypeId = (typeof LAYER_TYPE_IDS)[number];

export const BLEND_MODE_IDS = [
  'normal',
  'darken',
  'multiply',
  'color-burn',
  'linear-burn',
  'darker-color',
  'lighten',
  'screen',
  'color-dodge',
  'linear-dodge',
  'lighter-color',
  'overlay',
  'soft-light',
  'hard-light',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'difference',
  'exclusion',
  'subtract',
  'divide',
  'hue',
  'saturation',
  'color',
  'luminosity',
  'pass-through',
] as const;

export type BlendModeId = (typeof BLEND_MODE_IDS)[number];
export type NamespacedMetadataV1 = Readonly<Record<string, unknown>>;
export type UnitRgbaV1 = readonly [number, number, number, number];

export interface LayerLocksV1 {
  readonly all: boolean;
  readonly pixels: boolean;
  readonly alpha: boolean;
  readonly position: boolean;
}

export interface LayerRoleFlagsV1 {
  readonly reference: boolean;
  readonly draft: boolean;
}

export interface ClippingSpecV1 {
  readonly mode: 'alpha';
  readonly baseLayerId: LayerId;
}

export type TransformNodeKindV1 = 'affine' | 'perspective' | 'mesh' | 'puppet';

export interface TransformNodeV1 {
  readonly id: NodeId;
  readonly revision: Revision;
  readonly kind: TransformNodeKindV1;
  readonly parameters: NamespacedMetadataV1;
}

export interface EffectNodeV1 {
  readonly id: NodeId;
  readonly revision: Revision;
  readonly effectId: string;
  readonly enabled: boolean;
  readonly parameters: NamespacedMetadataV1;
}

export interface BoundsHintV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sourceRevision: Revision;
}

export interface RasterTileReferenceV1 {
  readonly x: number;
  readonly y: number;
  readonly revision: Revision;
  readonly payloadRef: string;
}

export interface VectorObjectV1 {
  readonly id: ObjectId;
  readonly revision: Revision;
  readonly kind: 'path' | 'shape';
  readonly geometry: NamespacedMetadataV1;
  readonly style: NamespacedMetadataV1;
  readonly transformStack: readonly TransformNodeV1[];
}

export interface MaskBaseV1<Kind extends MaskAttachmentV1['kind']> {
  readonly id: MaskId;
  readonly revision: Revision;
  readonly kind: Kind;
  readonly enabled: boolean;
  readonly inverted: boolean;
  readonly transformStack: readonly TransformNodeV1[];
  readonly metadata: NamespacedMetadataV1;
}

export interface RasterMaskAttachmentV1 extends MaskBaseV1<'raster-mask'> {
  readonly defaultCoverage: 0 | 1;
  readonly tiles: readonly RasterTileReferenceV1[];
}

export interface VectorMaskAttachmentV1 extends MaskBaseV1<'vector-mask'> {
  readonly paths: readonly VectorObjectV1[];
}

export type EffectMaskCoverageV1 =
  | {
      readonly kind: 'raster';
      readonly defaultCoverage: 0 | 1;
      readonly tiles: readonly RasterTileReferenceV1[];
    }
  | {
      readonly kind: 'vector';
      readonly paths: readonly VectorObjectV1[];
    };

export interface EffectMaskAttachmentV1 extends MaskBaseV1<'effect-mask'> {
  readonly effectNodeId: NodeId;
  readonly coverage: EffectMaskCoverageV1;
}

export type MaskAttachmentV1 =
  | RasterMaskAttachmentV1
  | VectorMaskAttachmentV1
  | EffectMaskAttachmentV1;

export interface LayerBaseV1<Type extends LayerTypeId = LayerTypeId> {
  readonly id: LayerId;
  readonly type: Type;
  readonly revision: Revision;
  readonly parentId: LayerId | null;
  readonly name: string;
  readonly visible: boolean;
  readonly opacity: number;
  readonly blendMode: BlendModeId;
  readonly locks: LayerLocksV1;
  readonly clipping: ClippingSpecV1 | null;
  readonly roleFlags: LayerRoleFlagsV1;
  readonly masks: readonly MaskAttachmentV1[];
  readonly transformStack: readonly TransformNodeV1[];
  readonly effectStack: readonly EffectNodeV1[];
  readonly boundsHint: BoundsHintV1 | null;
  readonly metadata: NamespacedMetadataV1;
}

export interface RasterLayerV1 extends LayerBaseV1<'raster'> {
  readonly tiles: readonly RasterTileReferenceV1[];
}

export interface FolderLayerV1 extends LayerBaseV1<'folder'> {
  readonly role: 'normal' | 'lineart-group';
  readonly childLayerIds: readonly LayerId[];
}

export interface VectorLayerV1 extends LayerBaseV1<'vector'> {
  readonly objects: readonly VectorObjectV1[];
}

export interface AdjustmentLayerV1 extends LayerBaseV1<'adjustment'> {
  readonly adjustment: EffectNodeV1;
}

export type ColorValueV1 = {
  readonly space: 'srgb' | 'display-p3';
  readonly rgba: UnitRgbaV1;
};

export type FillSpecV1 =
  | {
      readonly kind: 'solid';
      readonly color: ColorValueV1;
    }
  | {
      readonly kind: 'pattern';
      readonly resourceId: ResourceId;
      readonly transform: TransformNodeV1 | null;
    };

export interface FillLayerV1 extends LayerBaseV1<'fill'> {
  readonly fill: FillSpecV1;
}

export interface GradientStopV1 {
  readonly position: number;
  readonly color: ColorValueV1;
}

export interface GradientPointV1 {
  readonly x: number;
  readonly y: number;
  readonly color: ColorValueV1;
}

export type GradientSpecV1 =
  | {
      readonly kind: 'linear' | 'radial' | 'conical';
      readonly stops: readonly GradientStopV1[];
      readonly geometry: NamespacedMetadataV1;
    }
  | {
      readonly kind: 'freeform';
      readonly points: readonly GradientPointV1[];
    };

export interface GradientLayerV1 extends LayerBaseV1<'gradient'> {
  readonly gradient: GradientSpecV1;
}

export type ImplementedLayerV1 =
  | RasterLayerV1
  | FolderLayerV1
  | VectorLayerV1
  | AdjustmentLayerV1
  | FillLayerV1
  | GradientLayerV1;

export interface LayerCommonInput {
  readonly id?: LayerId;
  readonly parentId?: LayerId | null;
  readonly name: string;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly blendMode?: BlendModeId;
  readonly locks?: Partial<LayerLocksV1>;
  readonly clipping?: ClippingSpecV1 | null;
  readonly roleFlags?: Partial<LayerRoleFlagsV1>;
  readonly masks?: readonly MaskAttachmentV1[];
  readonly transformStack?: readonly TransformNodeV1[];
  readonly effectStack?: readonly EffectNodeV1[];
  readonly metadata?: NamespacedMetadataV1;
}

function assertUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite value in 0..1`);
  }
}

function assertColor(color: ColorValueV1): void {
  for (const component of color.rgba) assertUnitInterval(component, 'color component');
}

function assertTileCoordinate(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function createBase<Type extends LayerTypeId>(
  type: Type,
  input: LayerCommonInput,
): LayerBaseV1<Type> {
  const opacity = input.opacity ?? 1;
  assertUnitInterval(opacity, 'layer opacity');
  if (input.name.length === 0) throw new TypeError('layer name must not be empty');

  return Object.freeze({
    id: input.id ?? createLayerId(),
    type,
    revision: INITIAL_REVISION,
    parentId: input.parentId ?? null,
    name: input.name,
    visible: input.visible ?? true,
    opacity,
    blendMode: input.blendMode ?? 'normal',
    locks: Object.freeze({
      all: input.locks?.all ?? false,
      pixels: input.locks?.pixels ?? false,
      alpha: input.locks?.alpha ?? false,
      position: input.locks?.position ?? false,
    }),
    clipping: input.clipping ?? null,
    roleFlags: Object.freeze({
      reference: input.roleFlags?.reference ?? false,
      draft: input.roleFlags?.draft ?? false,
    }),
    masks: freezeArray(input.masks ?? []),
    transformStack: freezeArray(input.transformStack ?? []),
    effectStack: freezeArray(input.effectStack ?? []),
    boundsHint: null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

function createMaskBase<Kind extends MaskAttachmentV1['kind']>(
  kind: Kind,
  input: {
    readonly id?: MaskId;
    readonly enabled?: boolean;
    readonly inverted?: boolean;
    readonly transformStack?: readonly TransformNodeV1[];
    readonly metadata?: NamespacedMetadataV1;
  },
): MaskBaseV1<Kind> {
  return Object.freeze({
    id: input.id ?? createMaskId(),
    revision: INITIAL_REVISION,
    kind,
    enabled: input.enabled ?? true,
    inverted: input.inverted ?? false,
    transformStack: freezeArray(input.transformStack ?? []),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function createTransformNode(
  kind: TransformNodeKindV1,
  parameters: NamespacedMetadataV1 = {},
): TransformNodeV1 {
  return Object.freeze({
    id: createNodeId(),
    revision: INITIAL_REVISION,
    kind,
    parameters: Object.freeze({ ...parameters }),
  });
}

export function createEffectNode(
  effectId: string,
  parameters: NamespacedMetadataV1 = {},
): EffectNodeV1 {
  if (effectId.length === 0) throw new TypeError('effectId must not be empty');
  return Object.freeze({
    id: createNodeId(),
    revision: INITIAL_REVISION,
    effectId,
    enabled: true,
    parameters: Object.freeze({ ...parameters }),
  });
}

export function createRasterTileReference(input: {
  x: number;
  y: number;
  payloadRef: string;
}): RasterTileReferenceV1 {
  assertTileCoordinate(input.x, 'tile x');
  assertTileCoordinate(input.y, 'tile y');
  if (input.payloadRef.length === 0) throw new TypeError('tile payloadRef must not be empty');
  return Object.freeze({
    x: input.x,
    y: input.y,
    revision: INITIAL_REVISION,
    payloadRef: input.payloadRef,
  });
}

export function createVectorObject(input: {
  kind: VectorObjectV1['kind'];
  geometry?: NamespacedMetadataV1;
  style?: NamespacedMetadataV1;
}): VectorObjectV1 {
  return Object.freeze({
    id: createObjectId(),
    revision: INITIAL_REVISION,
    kind: input.kind,
    geometry: Object.freeze({ ...(input.geometry ?? {}) }),
    style: Object.freeze({ ...(input.style ?? {}) }),
    transformStack: Object.freeze([]),
  });
}

export function createRasterMask(
  input: {
    id?: MaskId;
    defaultCoverage?: 0 | 1;
    tiles?: readonly RasterTileReferenceV1[];
    enabled?: boolean;
    inverted?: boolean;
  } = {},
): RasterMaskAttachmentV1 {
  return Object.freeze({
    ...createMaskBase('raster-mask', input),
    defaultCoverage: input.defaultCoverage ?? 1,
    tiles: freezeArray(input.tiles ?? []),
  });
}

export function createVectorMask(
  input: {
    id?: MaskId;
    paths?: readonly VectorObjectV1[];
    enabled?: boolean;
    inverted?: boolean;
  } = {},
): VectorMaskAttachmentV1 {
  return Object.freeze({
    ...createMaskBase('vector-mask', input),
    paths: freezeArray(input.paths ?? []),
  });
}

export function createEffectMask(input: {
  effectNodeId: NodeId;
  coverage: EffectMaskCoverageV1;
  id?: MaskId;
  enabled?: boolean;
  inverted?: boolean;
}): EffectMaskAttachmentV1 {
  return Object.freeze({
    ...createMaskBase('effect-mask', input),
    effectNodeId: input.effectNodeId,
    coverage: input.coverage,
  });
}

export function createRasterLayer(
  input: LayerCommonInput & { readonly tiles?: readonly RasterTileReferenceV1[] },
): RasterLayerV1 {
  return Object.freeze({ ...createBase('raster', input), tiles: freezeArray(input.tiles ?? []) });
}

export function createFolderLayer(
  input: LayerCommonInput & {
    readonly childLayerIds?: readonly LayerId[];
    readonly role?: FolderLayerV1['role'];
  },
): FolderLayerV1 {
  const role = input.role ?? 'normal';
  const base = createBase('folder', input);
  return Object.freeze({
    ...base,
    role,
    blendMode:
      role === 'lineart-group' && base.blendMode === 'normal' ? 'pass-through' : base.blendMode,
    childLayerIds: freezeArray(input.childLayerIds ?? []),
  });
}

export function createVectorLayer(
  input: LayerCommonInput & { readonly objects?: readonly VectorObjectV1[] },
): VectorLayerV1 {
  return Object.freeze({
    ...createBase('vector', input),
    objects: freezeArray(input.objects ?? []),
  });
}

export function createAdjustmentLayer(
  input: LayerCommonInput & { readonly adjustment: EffectNodeV1 },
): AdjustmentLayerV1 {
  return Object.freeze({ ...createBase('adjustment', input), adjustment: input.adjustment });
}

export function createFillLayer(
  input: LayerCommonInput & { readonly fill: FillSpecV1 },
): FillLayerV1 {
  if (input.fill.kind === 'solid') assertColor(input.fill.color);
  return Object.freeze({ ...createBase('fill', input), fill: input.fill });
}

export function createGradientLayer(
  input: LayerCommonInput & { readonly gradient: GradientSpecV1 },
): GradientLayerV1 {
  if (input.gradient.kind === 'freeform') {
    if (input.gradient.points.length === 0) {
      throw new RangeError('freeform gradient requires at least one point');
    }
    for (const point of input.gradient.points) assertColor(point.color);
  } else {
    if (input.gradient.stops.length < 2) {
      throw new RangeError('gradient requires at least two stops');
    }
    for (const stop of input.gradient.stops) {
      assertUnitInterval(stop.position, 'gradient stop position');
      assertColor(stop.color);
    }
  }
  return Object.freeze({ ...createBase('gradient', input), gradient: input.gradient });
}
