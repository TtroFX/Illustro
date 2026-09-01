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
    expect(serviceWorker).toContain('PRECACHE_MANIFEST');
    expect(serviceWorker).toContain('"./app/main.js"');
    expect(serviceWorker).toContain('"./workers/render.worker.js"');
    expect(serviceWorker).toContain('networkFirst(request)');
    expect(serviceWorker).toContain("fetch(request, { cache: 'no-cache' })");
    expect(serviceWorker).not.toContain('__ILLUSTRO_BUILD_SHA__');
    expect(serviceWorker).not.toContain('__ILLUSTRO_PRECACHE_MANIFEST__');
    expect(main).toContain('illustroRuntime');
    expect(renderWorker).toContain('worker.render.ready');
    expect(storageWorker).toContain('worker.storage.ready');

    const identity = JSON.parse(buildInfo) as { buildSha?: string; buildMode?: string };
    expect(identity.buildSha?.length).toBeGreaterThan(0);
    expect(identity.buildMode).toBe('production');
    expect(serviceWorker).toContain(`const BUILD_SHA = ${JSON.stringify(identity.buildSha)};`);
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
    expect(atlas).toContain('GPU_ATLAS_PAGE_SIZE_PX = 2_048');
    expect(atlas).toContain('GPU_ATLAS_SLOTS_PER_PAGE');
    expect(viewport).toContain('resolveViewportTilesV1');
  });

  it('ships the M3 tile upload and aligned readback path in the production bundle', async () => {
    const [renderWorker, tileTransfer, rendererTileState] = await Promise.all([
      readDist('workers/render.worker.js'),
      readDist('gpu/tile-transfer.js'),
      readDist('gpu/renderer-tile-state.js'),
    ]);

    expect(renderWorker).toContain('renderer.tiles.upload');
    expect(renderWorker).toContain('renderer.tiles.readback');
    expect(tileTransfer).toContain('GPU_COPY_BYTES_PER_ROW_ALIGNMENT = 256');
    expect(tileTransfer).toContain('writeTexture');
    expect(tileTransfer).toContain('copyTextureToBuffer');
    expect(rendererTileState).toContain('uploadCpuBackingToGpu');
    expect(rendererTileState).toContain('readbackGpuToCpu');
  });
});
