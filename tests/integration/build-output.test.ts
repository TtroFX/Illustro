import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function readDist(path: string): Promise<string> {
  return readFile(new URL(`../../dist/${path}`, import.meta.url), 'utf8');
}

describe('production build output', () => {
  it('contains the application shell, PWA assets, workers, and build identity', async () => {
    const [html, manifest, serviceWorker, main, renderWorker, storageWorker, buildInfo] =
      await Promise.all([
        readDist('index.html'),
        readDist('manifest.webmanifest'),
        readDist('service-worker.js'),
        readDist('app/main.js'),
        readDist('workers/render.worker.js'),
        readDist('workers/storage.worker.js'),
        readDist('build-info.json'),
      ]);

    expect(html).toContain('manifest.webmanifest');
    expect(manifest).toContain('Illustro');
    expect(serviceWorker).toContain('APP_SHELL');
    expect(serviceWorker).toContain('cache.addAll(APP_SHELL)');
    expect(main).toContain('illustroRuntime');
    expect(renderWorker).toContain('worker.render.ready');
    expect(storageWorker).toContain('worker.storage.ready');

    const identity = JSON.parse(buildInfo) as { buildSha?: string; buildMode?: string };
    expect(identity.buildSha?.length).toBeGreaterThan(0);
    expect(identity.buildMode).toBe('production');
  });

  it('ships the M3 renderer cache, atlas, and viewport wiring in the production bundle', async () => {
    const [renderWorker, tileCache, atlas, viewport] = await Promise.all([
      readDist('workers/render.worker.js'),
      readDist('gpu/tile-cache.js'),
      readDist('gpu/gpu-atlas.js'),
      readDist('gpu/viewport-tiles.js'),
    ]);

    expect(renderWorker).toContain('renderer.tiles.reserveGpu');
    expect(renderWorker).toContain('renderer.tiles.cacheCpu');
    expect(renderWorker).toContain('renderer.tiles.viewport');
    expect(renderWorker).toContain('renderer.provisional.discarded');
    expect(tileCache).toContain('class GpuTileCacheV1');
    expect(atlas).toContain('GPU_ATLAS_PAGE_SIZE_PX = 2048');
    expect(viewport).toContain('resolveViewportTilesV1');
  });
});
