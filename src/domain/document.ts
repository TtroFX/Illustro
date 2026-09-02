import {
  INITIAL_REVISION,
  createDocumentId,
  createProjectId,
  type DocumentId,
  type LayerId,
  type ProjectId,
  type Revision,
} from './identity.js';
import type { LayerBaseV1 } from './layers.js';
import type { ResourceV1 } from './resources.js';

export const DOCUMENT_V1_SCHEMA = 'illustro.document/1' as const;
export const MAX_CANVAS_DIMENSION = 32_768;
export const MAX_CANVAS_AREA = 2 ** 28;

export type DocumentColorSpace = 'srgb' | 'display-p3';
export type DocumentPrecision = 'rgba8-unorm' | 'rgba16-float';
export type CanonicalAlphaMode = 'straight';

export interface DocumentColorProfileV1 {
  readonly kind: 'builtin-rgb';
  readonly space: DocumentColorSpace;
  readonly whitePoint: 'd65';
  readonly transfer: 'srgb';
}

export type RgbaUnitColor = readonly [number, number, number, number];

export type CanvasBackgroundSpec =
  | { readonly kind: 'transparent' }
  | { readonly kind: 'solid'; readonly rgba: RgbaUnitColor };

export interface CanvasSpec {
  readonly width: number;
  readonly height: number;
  readonly resolution: {
    readonly ppi: number;
  };
  readonly background: CanvasBackgroundSpec;
  readonly displayCheckerPolicy: {
    readonly mode: 'default';
  };
  readonly bounds: {
    readonly x: 0;
    readonly y: 0;
    readonly width: number;
    readonly height: number;
  };
}

export interface DocumentColorSpec {
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
  readonly alphaMode: CanonicalAlphaMode;
  readonly profile?: DocumentColorProfileV1;
}

export interface FeatureFlagSet {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

export interface LayerTreeV1 {
  readonly rootLayerIds: readonly LayerId[];
  readonly layers: Readonly<Record<string, LayerBaseV1>>;
}

export type ResourceTableV1 = Readonly<Record<string, ResourceV1>>;
export type GuideRulerStateV1 = Readonly<Record<string, unknown>>;
export type DocumentSettingsV1 = Readonly<Record<string, unknown>>;
export type DocumentExtensionTableV1 = Readonly<Record<string, unknown>>;

export interface DocumentV1 {
  readonly schema: typeof DOCUMENT_V1_SCHEMA;
  readonly documentId: DocumentId;
  readonly projectId: ProjectId;
  readonly revision: Revision;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly canvas: CanvasSpec;
  readonly color: DocumentColorSpec;
  readonly layerTree: LayerTreeV1;
  readonly resources: ResourceTableV1;
  readonly guidesAndRulers: GuideRulerStateV1;
  readonly documentSettings: DocumentSettingsV1;
  readonly featureFlags: FeatureFlagSet;
  readonly extensions: DocumentExtensionTableV1;
}

function assertCanvasDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CANVAS_DIMENSION) {
    throw new RangeError(`${label} must be an integer in 1..${MAX_CANVAS_DIMENSION}`);
  }
}

function assertUnitColor(color: RgbaUnitColor): void {
  if (
    color.length !== 4 ||
    color.some((component) => !Number.isFinite(component) || component < 0 || component > 1)
  ) {
    throw new RangeError('background RGBA components must be finite values in 0..1');
  }
}

export function createCanvasSpec(input: {
  width: number;
  height: number;
  ppi?: number;
  background?: CanvasBackgroundSpec;
}): CanvasSpec {
  assertCanvasDimension(input.width, 'canvas width');
  assertCanvasDimension(input.height, 'canvas height');
  if (input.width * input.height > MAX_CANVAS_AREA) {
    throw new RangeError(`canvas area must not exceed ${MAX_CANVAS_AREA} logical pixels`);
  }

  const ppi = input.ppi ?? 300;
  if (!Number.isFinite(ppi) || ppi <= 0) {
    throw new RangeError('canvas PPI must be a finite positive number');
  }

  const background = input.background ?? { kind: 'transparent' as const };
  if (background.kind === 'solid') assertUnitColor(background.rgba);

  return Object.freeze({
    width: input.width,
    height: input.height,
    resolution: Object.freeze({ ppi }),
    background,
    displayCheckerPolicy: Object.freeze({ mode: 'default' as const }),
    bounds: Object.freeze({
      x: 0 as const,
      y: 0 as const,
      width: input.width,
      height: input.height,
    }),
  });
}

export function createDocumentColorProfileV1(
  workingSpace: DocumentColorSpace,
): DocumentColorProfileV1 {
  return Object.freeze({
    kind: 'builtin-rgb' as const,
    space: workingSpace,
    whitePoint: 'd65' as const,
    transfer: 'srgb' as const,
  });
}

export function resolveDocumentColorProfileV1(color: DocumentColorSpec): DocumentColorProfileV1 {
  const profile = color.profile;
  if (profile !== undefined && profile.space === color.workingSpace) return profile;
  return createDocumentColorProfileV1(color.workingSpace);
}

export function createDocumentColorSpec(
  workingSpace: DocumentColorSpace = 'srgb',
  precision: DocumentPrecision = 'rgba8-unorm',
): DocumentColorSpec {
  return Object.freeze({
    workingSpace,
    precision,
    alphaMode: 'straight' as const,
    profile: createDocumentColorProfileV1(workingSpace),
  });
}

export function createDocumentV1(input: {
  width: number;
  height: number;
  ppi?: number;
  background?: CanvasBackgroundSpec;
  workingSpace?: DocumentColorSpace;
  precision?: DocumentPrecision;
  documentId?: DocumentId;
  projectId?: ProjectId;
  now?: Date;
}): DocumentV1 {
  const timestamp = (input.now ?? new Date()).toISOString();
  const canvas = createCanvasSpec({
    width: input.width,
    height: input.height,
    ...(input.ppi === undefined ? {} : { ppi: input.ppi }),
    ...(input.background === undefined ? {} : { background: input.background }),
  });

  return Object.freeze({
    schema: DOCUMENT_V1_SCHEMA,
    documentId: input.documentId ?? createDocumentId(),
    projectId: input.projectId ?? createProjectId(),
    revision: INITIAL_REVISION,
    createdAt: timestamp,
    modifiedAt: timestamp,
    canvas,
    color: createDocumentColorSpec(input.workingSpace, input.precision),
    layerTree: Object.freeze({
      rootLayerIds: Object.freeze([]),
      layers: Object.freeze({}),
    }),
    resources: Object.freeze({}),
    guidesAndRulers: Object.freeze({}),
    documentSettings: Object.freeze({}),
    featureFlags: Object.freeze({ required: Object.freeze([]), optional: Object.freeze([]) }),
    extensions: Object.freeze({}),
  });
}
