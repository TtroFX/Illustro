import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`M3 inspection failed: ${label}`);
}

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`M3 inspection failed: required file missing: ${path}`);
  }
}

const progress = await read('IMPLEMENTATION_PROGRESS.md');
for (let index = 1; index <= 49; index += 1) {
  const id = `M3-${String(index).padStart(3, '0')}`;
  const line = progress.split('\n').find((entry) => entry.startsWith(`${id} `));
  if (line === undefined || !line.endsWith(':完了')) {
    throw new Error(`M3 inspection failed: ${id} is not closed`);
  }
}

const design = await read('ILLUSTRO_DESIGN_MEMO.md');
requireText(
  design,
  'superseded by a **128×128px canonical sparse Raster Tile**',
  'canonical 128px tile supersession missing',
);
requireText(design, '2048 × 2048 pixels', '2048px atlas-page contract missing');
requireText(design, '>= 50% of a tile core', '50% dirty promotion contract missing');
requireText(design, '4096 samples per active pointer stream', '4096-sample input bound missing');
requireText(design, '1024 pending command descriptors', '1024 render-command bound missing');
requireText(design, '1..32768 px', '32768px canvas bound missing');
requireText(design, '<= 268435456 pixels (2^28)', '2^28 logical-area bound missing');

const requiredTests = [
  'tests/unit/webgpu-capability.test.ts',
  'tests/unit/renderer-device-manager.test.ts',
  'tests/unit/renderer-controller.test.ts',
  'tests/unit/sparse-tile-model.test.ts',
  'tests/unit/tile-cache.test.ts',
  'tests/unit/gpu-atlas.test.ts',
  'tests/unit/renderer-tile-state.test.ts',
  'tests/unit/tile-transfer.test.ts',
  'tests/unit/transient-targets.test.ts',
  'tests/unit/render-scheduler.test.ts',
  'tests/unit/frame-compositor.test.ts',
  'tests/unit/pointer-input.test.ts',
  'tests/unit/pointer-input-controller.test.ts',
  'tests/unit/input-queue.test.ts',
  'tests/unit/input-transport.test.ts',
  'tests/unit/input-arbitration.test.ts',
  'tests/unit/hover-state.test.ts',
  'tests/unit/canvas-admission.test.ts',
];
await Promise.all(requiredTests.map(requireFile));

const [
  webgpu,
  deviceManager,
  rendererController,
  renderWorker,
  sparseTiles,
  atlas,
  tileState,
  tileTransfer,
  transientTargets,
  renderScheduler,
  compositor,
  pointerInput,
  pointerController,
  inputQueue,
  inputTransport,
  inputIngress,
  arbitration,
  hover,
  admission,
  admissionController,
  main,
] = await Promise.all([
  read('src/gpu/webgpu-capability.ts'),
  read('src/gpu/renderer-device-manager.ts'),
  read('src/app/renderer-controller.ts'),
  read('src/workers/render.worker.ts'),
  read('src/gpu/sparse-tile-model.ts'),
  read('src/gpu/gpu-atlas.ts'),
  read('src/gpu/renderer-tile-state.ts'),
  read('src/gpu/tile-transfer.ts'),
  read('src/gpu/transient-targets.ts'),
  read('src/gpu/render-scheduler.ts'),
  read('src/gpu/frame-compositor.ts'),
  read('src/input/pointer-input.ts'),
  read('src/app/pointer-input-controller.ts'),
  read('src/input/input-queue.ts'),
  read('src/input/input-transport.ts'),
  read('src/workers/input-ingress-extension.ts'),
  read('src/input/input-arbitration.ts'),
  read('src/input/hover-state.ts'),
  read('src/domain/canvas-admission.ts'),
  read('src/app/canvas-admission-controller.ts'),
  read('src/app/main.ts'),
]);

requireText(webgpu, "status: 'insecure-context'", 'secure-context gate missing');
requireText(webgpu, "status: 'api-unavailable'", 'navigator.gpu capability gate missing');
requireText(webgpu, 'requestAdapter', 'GPU adapter acquisition missing');
requireText(webgpu, 'requestDevice', 'GPU device acquisition missing');
requireText(webgpu, "adapter.features.has('shader-f16')", 'optional shader-f16 handling missing');
requireText(deviceManager, 'device.lost.then', 'GPU device-loss detection missing');
requireText(deviceManager, "this.#state = 'recovering'", 'GPU device reconstruction path missing');
requireText(
  rendererController,
  "if (input.workerDeviceReady && input.offscreenTransferAvailable) return 'worker';",
  'worker renderer ownership selection missing',
);
requireText(
  rendererController,
  "return input.mainDeviceReady === false ? 'compatibility' : 'main';",
  'main/compatibility renderer fallback selection missing',
);
requireText(
  rendererController,
  'transferControlToOffscreen',
  'OffscreenCanvas transfer gate missing',
);
requireText(rendererController, '#startMainFallback', 'main-context WebGPU fallback missing');
requireText(
  rendererController,
  '#startCompatibilityFallback',
  'WebGPU-independent compatibility renderer fallback missing',
);
requireText(renderWorker, 'RendererDeviceManagerV1', 'Render Worker device ownership missing');
requireText(renderWorker, 'installRenderInputIngressV1', 'Render Worker input ingress missing');

requireText(sparseTiles, 'CANONICAL_TILE_SIZE_PX = 128', '128px sparse tile constant missing');
requireText(sparseTiles, 'validWidth', 'edge-tile valid bounds missing');
requireText(sparseTiles, 'addressDocumentPixelV1', 'tile addressing missing');
requireText(sparseTiles, 'DirtyTileTrackerV1', 'dirty-tile tracker missing');
requireText(sparseTiles, 'WHOLE_TILE_DIRTY_PROMOTION_RATIO = 0.5', '50% dirty promotion missing');
requireText(sparseTiles, 'allocate(', 'sparse tile allocation missing');
requireText(sparseTiles, 'deallocate(', 'sparse tile deallocation missing');
requireText(atlas, 'GPU_ATLAS_PAGE_SIZE_PX = 2_048', '2048px GPU atlas page missing');
requireText(atlas, 'GpuAtlasPageManagerV1', 'GPU atlas slot allocator missing');
requireText(tileState, 'GpuTileCacheV1', 'GPU tile cache integration missing');
requireText(tileState, 'CpuBackingTileCacheV1', 'CPU tile cache integration missing');
requireText(tileState, 'resolveViewport', 'viewport tile resolver integration missing');
requireText(tileTransfer, 'uploadTileToAtlasV1', 'tile upload path missing');
requireText(tileTransfer, 'readbackTileFromAtlasV1', 'tile readback path missing');
requireText(
  transientTargets,
  'TransientTargetManagerV1',
  'transient halo/filter target foundation missing',
);
requireText(
  renderScheduler,
  'RENDER_COMMAND_QUEUE_SOFT_BOUND = 1_024',
  '1024 render queue bound missing',
);
requireText(renderScheduler, "'P0' | 'P1' | 'P2' | 'P3'", 'render priority classes missing');
requireText(compositor, 'buildFrameCompositePlanV1', 'frame compositor foundation missing');

requireText(pointerInput, 'getCoalescedEvents', 'coalesced Pointer Events ingestion missing');
requireText(pointerInput, 'getPredictedEvents', 'predicted Pointer Events path missing');
requireText(pointerInput, "'pointerrawupdate'", 'pointerrawupdate ingestion missing');
requireText(pointerInput, 'tangentialPressure', 'pressure/orientation payload incomplete');
requireText(pointerInput, 'altitudeAngle', 'altitude orientation ingestion missing');
requireText(pointerInput, 'azimuthAngle', 'azimuth orientation ingestion missing');
requireText(pointerController, "'pointerrawupdate'", 'production raw-update listener missing');
requireText(
  inputQueue,
  'DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1 = 4_096',
  '4096 fallback input queue bound missing',
);
requireText(inputQueue, 'isNonDroppable', 'non-droppable pointer boundary policy missing');
requireText(
  inputQueue,
  'reductionImportance',
  'time/geometry-aware motion reduction foundation missing',
);
requireText(
  inputTransport,
  'DEFAULT_POINTER_SHARED_RING_CAPACITY_V1 = DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1',
  'SAB/fallback logical bounds diverge',
);
requireText(inputTransport, 'SharedArrayBuffer', 'SAB fast path missing');
requireText(inputTransport, 'Atomics.', 'Atomics coordination missing');
requireText(inputTransport, '[buffer]', 'Transferable ArrayBuffer path missing');
requireText(
  inputIngress,
  'DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1',
  'worker ingress does not share frozen input bound',
);
requireText(arbitration, "sample.source === 'pen'", 'pen source arbitration missing');
requireText(arbitration, "sample.source === 'touch'", 'touch source arbitration missing');
requireText(arbitration, "sample.source === 'mouse'", 'mouse source arbitration missing');
requireText(arbitration, "'rejected-palm'", 'application-side palm rejection missing');
requireText(hover, 'PointerHoverTrackerV1', 'hover state foundation missing');

requireText(admission, 'MAX_CANVAS_DIMENSION', 'maximum canvas dimension admission check missing');
requireText(admission, 'MAX_CANVAS_AREA', 'logical-area admission check missing');
requireText(
  admission,
  'bytesPerPixelForDocumentPrecisionV1',
  'precision-aware admission estimate missing',
);
requireText(admission, 'projectedTouchedTiles', 'sparse touched-tile estimate missing');
requireText(admission, 'operationScratchBytes', 'operation scratch estimate missing');
requireText(admission, 'hardReserveBytes', 'storage safety reserve integration missing');
requireText(
  admissionController,
  'getStorageQuotaMonitor',
  'runtime storage quota preflight missing',
);
requireText(
  admissionController,
  'DEFAULT_CANVAS_CHECKPOINT_JOURNAL_HEADROOM_BYTES_V1',
  'checkpoint/journal headroom estimate missing',
);
requireText(
  main,
  'getCanvasAdmissionControllerV1',
  'canvas admission controller not connected to production bootstrap',
);
requireText(
  main,
  'pointerArbitration.route(batch)',
  'pointer arbitration not connected to production path',
);
requireText(
  main,
  'pointerTransport.enqueueBatch(arbitration.forwardBatch)',
  'accepted pointer input not connected to render transport',
);

const productionSources = [
  webgpu,
  deviceManager,
  rendererController,
  renderWorker,
  sparseTiles,
  atlas,
  tileState,
  tileTransfer,
  transientTargets,
  renderScheduler,
  compositor,
  pointerInput,
  pointerController,
  inputQueue,
  inputTransport,
  inputIngress,
  arbitration,
  hover,
  admission,
  admissionController,
  main,
];
for (const source of productionSources) {
  if (/\b(?:TODO|FIXME|STUB)\b/i.test(source)) {
    throw new Error('M3 inspection failed: TODO/FIXME/STUB remains in an M3 production source');
  }
}

console.log(JSON.stringify({ event: 'm3.foundation.inspection.pass', closedItems: 49 }));
