import { describe, expect, it } from 'vitest';
import {
  buildFrameCompositePlanV1,
  enqueueFrameCompositePlanV1,
} from '../../src/gpu/frame-compositor.js';
import { RenderSchedulerV1 } from '../../src/gpu/render-scheduler.js';

describe('M3 frame compositor foundation', () => {
  it('builds deterministic visible-tile passes in canonical node order', () => {
    const plan = buildFrameCompositePlanV1({
      frameId: 'frame-1',
      visibleTiles: [
        { tx: 1, ty: 0 },
        { tx: 2, ty: 0 },
      ],
      nodes: [
        {
          nodeId: 'base',
          revision: 7,
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          dependencyRevisionKeys: ['mask@2'],
        },
        {
          nodeId: 'hidden',
          revision: 3,
          visible: false,
          opacity: 1,
          blendMode: 'multiply',
          dependencyRevisionKeys: [],
        },
        {
          nodeId: 'top',
          revision: 9,
          visible: true,
          opacity: 0.5,
          blendMode: 'screen',
          dependencyRevisionKeys: ['effect@4'],
        },
      ],
      quality: 'full',
      colorSpace: 'display-p3',
      precision: 'rgba16-float',
    });
    expect(plan.tiles).toHaveLength(2);
    expect(plan.tiles[0]?.passes.map((pass) => pass.nodeId)).toEqual(['base', 'top']);
    expect(plan.tiles[0]?.passes[0]?.cacheKey).toContain('tile=1:0');
    expect(plan.tiles[0]?.passes[0]?.cacheKey).toContain('rev=7');
    expect(plan.tiles[0]?.passes[0]?.cacheKey).toContain('color=display-p3');
  });

  it('schedules visible convergence as P1 and interaction-critical frame work as P0', () => {
    const plan = buildFrameCompositePlanV1({
      frameId: 'frame-2',
      visibleTiles: [{ tx: 0, ty: 0 }],
      nodes: [
        {
          nodeId: 'layer',
          revision: 1,
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          dependencyRevisionKeys: [],
        },
      ],
      quality: 'interactive',
      colorSpace: 'srgb',
      precision: 'rgba8-unorm',
    });
    const visibleScheduler = new RenderSchedulerV1<unknown>();
    expect(enqueueFrameCompositePlanV1(visibleScheduler, plan).accepted).toBe(true);
    expect(visibleScheduler.drain(2).map((task) => task.priority)).toEqual(['P1', 'P1']);

    const interactionScheduler = new RenderSchedulerV1<unknown>();
    expect(enqueueFrameCompositePlanV1(interactionScheduler, plan, true).accepted).toBe(true);
    expect(interactionScheduler.drain(2).map((task) => task.priority)).toEqual(['P0', 'P0']);
  });

  it('changes the revision-keyed pass cache key when a dependency revision changes', () => {
    const makePlan = (dependency: string) =>
      buildFrameCompositePlanV1({
        frameId: 'frame-3',
        visibleTiles: [{ tx: 0, ty: 0 }],
        nodes: [
          {
            nodeId: 'layer',
            revision: 2,
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            dependencyRevisionKeys: [dependency],
          },
        ],
        quality: 'full',
        colorSpace: 'srgb',
        precision: 'rgba8-unorm',
      });
    expect(makePlan('mask@1').tiles[0]?.passes[0]?.cacheKey).not.toBe(
      makePlan('mask@2').tiles[0]?.passes[0]?.cacheKey,
    );
  });
});
