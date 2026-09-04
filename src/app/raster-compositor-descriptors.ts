import type { DocumentV1 } from '../domain/document.js';
import type { RasterMaskAttachmentV1, TransformNodeV1 } from '../domain/layers.js';
import type {
  BaselineAffineMatrixV1,
  BaselineRasterLayerDescriptorV1,
  BaselineRasterMaskDescriptorV1,
  BaselineRasterMaskEffectV1,
  BaselineRasterMaskTileImageV1,
} from '../gpu/baseline-raster-tile-store.js';
import { tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';

export interface RasterMaskTilePayloadV1 {
  readonly pixelFormat: 'rgba8-unorm';
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export type RasterMaskTileLoaderV1 = (payloadRef: string) => Promise<RasterMaskTilePayloadV1>;

const IDENTITY_AFFINE: BaselineAffineMatrixV1 = Object.freeze([1, 0, 0, 1, 0, 0]);

function isFiniteMatrix(value: unknown): value is BaselineAffineMatrixV1 {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

function multiplyAffine(
  left: BaselineAffineMatrixV1,
  right: BaselineAffineMatrixV1,
): BaselineAffineMatrixV1 {
  const [a2, b2, c2, d2, e2, f2] = left;
  const [a1, b1, c1, d1, e1, f1] = right;
  return Object.freeze([
    a2 * a1 + c2 * b1,
    b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1,
    b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2,
    b2 * e1 + d2 * f1 + f2,
  ]);
}

function inverseAffine(matrix: BaselineAffineMatrixV1): BaselineAffineMatrixV1 {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('Raster Mask affine transform is not invertible');
  }
  const inverse = 1 / determinant;
  const canonical = (value: number): number => (Object.is(value, -0) ? 0 : value);
  return Object.freeze([
    canonical(d * inverse),
    canonical(-b * inverse),
    canonical(-c * inverse),
    canonical(a * inverse),
    canonical((c * f - d * e) * inverse),
    canonical((b * e - a * f) * inverse),
  ]);
}

function nodeAffine(node: TransformNodeV1): BaselineAffineMatrixV1 {
  if (node.kind !== 'affine') {
    throw new Error(
      `baseline Raster Mask compositor does not support ${node.kind} mask transforms`,
    );
  }
  const matrix = node.parameters.matrix;
  if (!isFiniteMatrix(matrix)) {
    throw new Error('Raster Mask affine transform is missing its canonical matrix');
  }
  return Object.freeze([...matrix]) as BaselineAffineMatrixV1;
}

function documentToMaskTransform(mask: RasterMaskAttachmentV1): BaselineAffineMatrixV1 | undefined {
  if (mask.transformStack.length === 0) return undefined;
  let forward = IDENTITY_AFFINE;
  for (const node of mask.transformStack) forward = multiplyAffine(nodeAffine(node), forward);
  return inverseAffine(forward);
}

function maskEffects(mask: RasterMaskAttachmentV1): readonly BaselineRasterMaskEffectV1[] {
  const effects: BaselineRasterMaskEffectV1[] = [];
  for (const node of mask.effectStack ?? []) {
    if (!node.enabled) continue;
    if (node.effectId !== 'mask.feather' && node.effectId !== 'mask.blur') continue;
    const radiusPx = node.parameters.radiusPx;
    if (typeof radiusPx !== 'number' || !Number.isFinite(radiusPx) || radiusPx < 0) {
      throw new Error(`invalid ${node.effectId} radius in Raster Mask compositor`);
    }
    if (radiusPx === 0) continue;
    effects.push(
      Object.freeze({
        kind: node.effectId === 'mask.feather' ? ('feather' as const) : ('blur' as const),
        radiusPx,
      }),
    );
  }
  return Object.freeze(effects);
}

async function hydrateRasterMask(
  document: DocumentV1,
  mask: RasterMaskAttachmentV1,
  loadTile: RasterMaskTileLoaderV1 | null,
): Promise<BaselineRasterMaskDescriptorV1> {
  if (mask.tiles.length > 0 && loadTile === null) {
    throw new Error('Raster Mask compositor requires a canonical mask tile loader');
  }
  const tiles: BaselineRasterMaskTileImageV1[] = [];
  for (const reference of mask.tiles) {
    const bounds = tileBoundsForDocumentV1(document.canvas.width, document.canvas.height, {
      tx: reference.x,
      ty: reference.y,
    });
    const payload = await loadTile?.(reference.payloadRef);
    if (payload === undefined) throw new Error('Raster Mask tile loader returned no payload');
    if (
      payload.pixelFormat !== 'rgba8-unorm' ||
      payload.width !== bounds.validWidth ||
      payload.height !== bounds.validHeight ||
      payload.bytes.byteLength !== payload.width * payload.height * 4
    ) {
      throw new Error('Raster Mask tile violates the canonical mask tile contract');
    }
    tiles.push(
      Object.freeze({
        coordinate: Object.freeze({ tx: reference.x, ty: reference.y }),
        width: payload.width,
        height: payload.height,
        bytes: payload.bytes,
      }),
    );
  }
  const transform = documentToMaskTransform(mask);
  const effects = maskEffects(mask);
  return Object.freeze({
    maskId: mask.id,
    enabled: mask.enabled,
    inverted: mask.inverted,
    defaultCoverage: mask.defaultCoverage,
    tiles: Object.freeze(tiles),
    effects,
    ...(transform === undefined ? {} : { documentToMask: transform }),
  });
}

export async function hydratePaintRasterLayerDescriptorsV1(
  document: DocumentV1,
  loadMaskTile: RasterMaskTileLoaderV1 | null,
): Promise<readonly BaselineRasterLayerDescriptorV1[]> {
  const layers: BaselineRasterLayerDescriptorV1[] = [];
  const rootIds = new Set(document.layerTree.rootLayerIds);
  for (const layerId of document.layerTree.rootLayerIds) {
    const layer = document.layerTree.layers[layerId];
    if (layer?.type !== 'raster') continue;
    const unsupportedMask = layer.masks.find((mask) => mask.enabled && mask.kind !== 'raster-mask');
    if (unsupportedMask !== undefined) {
      throw new Error(
        `baseline raster compositor cannot render enabled ${unsupportedMask.kind} on ${layer.id}`,
      );
    }
    const masks = await Promise.all(
      layer.masks
        .filter((mask): mask is RasterMaskAttachmentV1 => mask.kind === 'raster-mask')
        .map((mask) => hydrateRasterMask(document, mask, loadMaskTile)),
    );
    let clippingBaseLayerId: string | undefined;
    if (layer.clipping !== null) {
      const base = document.layerTree.layers[layer.clipping.baseLayerId];
      if (base?.type !== 'raster' || !rootIds.has(base.id)) {
        throw new Error('baseline raster clipping requires a root Raster Layer base');
      }
      clippingBaseLayerId = base.id;
    }
    layers.push(
      Object.freeze({
        layerId: layer.id,
        visible: layer.visible,
        opacity: layer.opacity,
        ...(layer.roleFlags.draft ? { draft: true } : {}),
        ...(layer.roleFlags.reference ? { reference: true } : {}),
        ...(layer.blendMode === 'normal' ? {} : { blendMode: layer.blendMode }),
        ...(masks.length === 0 ? {} : { masks: Object.freeze(masks) }),
        ...(clippingBaseLayerId === undefined ? {} : { clippingBaseLayerId }),
      }),
    );
  }
  if (layers.length === 0) throw new Error('paint document requires a root raster layer');
  return Object.freeze(layers);
}
