import { tileKeyV1, type TileCoordinateV1 } from './sparse-tile-model.js';
import {
  RenderSchedulerV1,
  type RenderPriorityV1,
  type RenderScheduleEnqueueResultV1,
} from './render-scheduler.js';

export type FrameCompositeQualityV1 = 'interactive' | 'full';
export type FrameCompositeColorSpaceV1 = 'srgb' | 'display-p3';
export type FrameCompositePrecisionV1 = 'rgba8-unorm' | 'rgba16-float';

export interface FrameCompositeNodeV1 {
  readonly nodeId: string;
  readonly revision: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly blendMode: string;
  readonly dependencyRevisionKeys: readonly string[];
}

export interface FrameCompositePassV1 {
  readonly taskId: string;
  readonly tile: TileCoordinateV1;
  readonly nodeId: string;
  readonly revision: number;
  readonly opacity: number;
  readonly blendMode: string;
  readonly cacheKey: string;
}

export interface FrameCompositeTilePlanV1 {
  readonly coordinate: TileCoordinateV1;
  readonly passes: readonly FrameCompositePassV1[];
  readonly compositeTaskId: string;
}

export interface FrameCompositePlanV1 {
  readonly schema: 'illustro.frame-composite-plan/1';
  readonly frameId: string;
  readonly quality: FrameCompositeQualityV1;
  readonly colorSpace: FrameCompositeColorSpaceV1;
  readonly precision: FrameCompositePrecisionV1;
  readonly tiles: readonly FrameCompositeTilePlanV1[];
}

export interface FrameCompositeScheduleResultV1 {
  readonly accepted: boolean;
  readonly scheduledTaskCount: number;
  readonly rejectedTaskIds: readonly string[];
  readonly enqueueResults: readonly RenderScheduleEnqueueResultV1[];
}

function validateNode(node: FrameCompositeNodeV1): void {
  if (node.nodeId.length === 0) throw new TypeError('compositor nodeId must not be empty');
  if (!Number.isSafeInteger(node.revision) || node.revision < 0) {
    throw new RangeError('compositor node revision must be a non-negative safe integer');
  }
  if (!Number.isFinite(node.opacity) || node.opacity < 0 || node.opacity > 1) {
    throw new RangeError('compositor node opacity must be within 0..1');
  }
  if (node.blendMode.length === 0) throw new TypeError('compositor blendMode must not be empty');
  for (const dependency of node.dependencyRevisionKeys) {
    if (dependency.length === 0) throw new TypeError('dependency revision key must not be empty');
  }
}

function cacheKeyForPass(
  node: FrameCompositeNodeV1,
  tile: TileCoordinateV1,
  quality: FrameCompositeQualityV1,
  colorSpace: FrameCompositeColorSpaceV1,
  precision: FrameCompositePrecisionV1,
): string {
  const dependencyKey = node.dependencyRevisionKeys.map(encodeURIComponent).join(',');
  return [
    `node=${encodeURIComponent(node.nodeId)}`,
    `rev=${node.revision}`,
    `tile=${tileKeyV1(tile)}`,
    `quality=${quality}`,
    `color=${colorSpace}`,
    `precision=${precision}`,
    `deps=${dependencyKey}`,
  ].join('|');
}

export function buildFrameCompositePlanV1(input: {
  readonly frameId: string;
  readonly visibleTiles: readonly TileCoordinateV1[];
  readonly nodes: readonly FrameCompositeNodeV1[];
  readonly quality: FrameCompositeQualityV1;
  readonly colorSpace: FrameCompositeColorSpaceV1;
  readonly precision: FrameCompositePrecisionV1;
}): FrameCompositePlanV1 {
  if (input.frameId.length === 0) throw new TypeError('frameId must not be empty');
  for (const node of input.nodes) validateNode(node);
  const activeNodes = input.nodes.filter((node) => node.visible && node.opacity > 0);
  const tiles = input.visibleTiles.map((tile) => {
    const tileKey = tileKeyV1(tile);
    const passes = activeNodes.map((node, index) =>
      Object.freeze({
        taskId: `frame:${input.frameId}:tile:${tileKey}:pass:${index}:${node.nodeId}`,
        tile: Object.freeze({ tx: tile.tx, ty: tile.ty }),
        nodeId: node.nodeId,
        revision: node.revision,
        opacity: node.opacity,
        blendMode: node.blendMode,
        cacheKey: cacheKeyForPass(node, tile, input.quality, input.colorSpace, input.precision),
      }),
    );
    return Object.freeze({
      coordinate: Object.freeze({ tx: tile.tx, ty: tile.ty }),
      passes: Object.freeze(passes),
      compositeTaskId: `frame:${input.frameId}:tile:${tileKey}:composite`,
    });
  });
  return Object.freeze({
    schema: 'illustro.frame-composite-plan/1',
    frameId: input.frameId,
    quality: input.quality,
    colorSpace: input.colorSpace,
    precision: input.precision,
    tiles: Object.freeze(tiles),
  });
}

export function enqueueFrameCompositePlanV1(
  scheduler: RenderSchedulerV1<unknown>,
  plan: FrameCompositePlanV1,
  interactionCritical = false,
): FrameCompositeScheduleResultV1 {
  const priority: RenderPriorityV1 = interactionCritical ? 'P0' : 'P1';
  const rejectedTaskIds: string[] = [];
  const enqueueResults: RenderScheduleEnqueueResultV1[] = [];
  let scheduledTaskCount = 0;

  for (const tile of plan.tiles) {
    for (const pass of tile.passes) {
      const result = scheduler.enqueue({
        id: pass.taskId,
        priority,
        kind: 'frame.composite-node',
        payload: pass,
      });
      enqueueResults.push(result);
      if (result.accepted) scheduledTaskCount += 1;
      else rejectedTaskIds.push(pass.taskId);
    }
    const result = scheduler.enqueue({
      id: tile.compositeTaskId,
      priority,
      kind: 'frame.composite-tile',
      payload: tile,
    });
    enqueueResults.push(result);
    if (result.accepted) scheduledTaskCount += 1;
    else rejectedTaskIds.push(tile.compositeTaskId);
  }

  return Object.freeze({
    accepted: rejectedTaskIds.length === 0,
    scheduledTaskCount,
    rejectedTaskIds: Object.freeze(rejectedTaskIds),
    enqueueResults: Object.freeze(enqueueResults),
  });
}
