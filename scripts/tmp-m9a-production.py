from pathlib import Path

# Document workflow: notify Library host after explicit Create succeeds.
p = Path('src/app/document-workflow-controller.ts')
s = p.read_text()
s = s.replace(
    "  readonly onHistoryChanged: () => void;\n}",
    "  readonly onHistoryChanged: () => void;\n  readonly onProjectCreated?: (document: DocumentV1) => void;\n}",
    1,
)
s = s.replace(
    "          options.onDocumentChanged(current);\n          options.onHistoryChanged();\n        }\n        status.value = '';",
    "          options.onDocumentChanged(current);\n          options.onHistoryChanged();\n          options.onProjectCreated?.(current);\n        }\n        status.value = '';",
    1,
)
p.write_text(s)

# Persistence: closing from Library startup without a selected project is a valid no-op.
p = Path('src/app/paint-persistence-controller.ts')
s = p.read_text()
close_marker = "  async persistRasterTile(input: {\n"
# Locate public close through a narrow textual replacement if present.
s = s.replace(
    "  async close(): Promise<void> {\n    this.#assertNotDisposed();\n    const projectId = this.#requireProject();",
    "  async close(): Promise<void> {\n    this.#assertNotDisposed();\n    if (this.#projectId === null) return;\n    const projectId = this.#projectId;",
    1,
)
p.write_text(s)

# Main: connect OPFS Library, production surface, explicit New/Open, and persisted previews.
p = Path('src/app/main.ts')
s = p.read_text()
s = s.replace(
    "import { downloadPngBlobV1, encodeCompositeRasterTilesToPngV1 } from '../export/png-export.js';",
    "import { downloadPngBlobV1, encodeCompositeRasterTilesToPngV1 } from '../export/png-export.js';\nimport { openIllustroOpfsRoot } from '../storage/opfs-layout.js';",
    1,
)
s = s.replace(
    "import { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';",
    "import { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';\nimport { LocalProjectLibraryControllerV1 } from './local-project-library-controller.js';\nimport { installM9aLibrarySurfaceV1, type M9aLibrarySurfaceHandleV1 } from './m9a-library-surface.js';\nimport {\n  createProjectThumbnailPngV1,\n  ProjectPreviewStoreV1,\n} from './project-preview-store.js';",
    1,
)
# State holders after persistence construction.
needle = "const colorMatch = installColorMatchControllerV1({\n"
assert needle in s
insert = "let localLibraryController: LocalProjectLibraryControllerV1 | null = null;\nlet localLibrarySurface: M9aLibrarySurfaceHandleV1 | null = null;\nlet projectPreviewStore: ProjectPreviewStoreV1 | null = null;\nlet libraryVisibilityObserver: MutationObserver | null = null;\nlet previewCaptureTask: Promise<void> | null = null;\n\n"
s = s.replace(needle, insert + needle, 1)
# Add active-document helper before document workflow installation.
needle = "const documentWorkflow = installDocumentWorkflowControllerV1({\n"
assert needle in s
helper = r'''function activatePaintDocument(
  documentValue: DocumentV1,
  mode: 'created' | 'recovered',
): void {
  root.dataset.illustroPaintRecovery = mode;
  root.dataset.illustroPaintSession = 'ready';
  publishDocumentState(documentValue);
  root.dataset.illustroActiveLayerId = String(documentValue.layerTree.rootLayerIds[0] ?? '');
  root.dataset.illustroPaintStroke = 'idle';
  root.dataset.illustroPaintStrokeSamples = '0';
  syncPngExportAvailability();
  publishPaintHistory();
}

async function captureActiveProjectPreview(): Promise<void> {
  if (previewCaptureTask !== null) return previewCaptureTask;
  const controller = localLibraryController;
  const previews = projectPreviewStore;
  const documentValue = paintSession.currentDocument();
  if (controller === null || previews === null || documentValue === null) return;
  previewCaptureTask = (async () => {
    await paintRenderTask;
    await paintPersistence.flushCheckpoint();
    const current = paintSession.currentDocument();
    if (current === null || current.projectId !== documentValue.projectId) return;
    const tiles = await paintSession.exportCompositeRasterTiles();
    const png = await encodeCompositeRasterTilesToPngV1(current, tiles);
    const thumbnail = await createProjectThumbnailPngV1(png);
    const resourceId = await previews.write(current.projectId, thumbnail);
    await controller.updatePreview(current.projectId, resourceId);
    root.dataset.illustroProjectPreview = resourceId;
  })()
    .catch((error: unknown) => {
      root.dataset.illustroProjectPreview = 'error';
      logger.error('library.preview-capture-failed', error);
    })
    .finally(() => {
      previewCaptureTask = null;
    });
  return previewCaptureTask;
}

'''
s = s.replace(needle, helper + needle, 1)
# Explicit-create callback returns from Library to Editor only after successful Create.
s = s.replace(
    "  onHistoryChanged: publishPaintHistory,\n});\n\nconst documentGeometryWorkflow",
    "  onHistoryChanged: publishPaintHistory,\n  onProjectCreated(documentValue) {\n    activatePaintDocument(documentValue, 'created');\n    shell.productShell.hideLibrary();\n  },\n});\n\nconst documentGeometryWorkflow",
    1,
)
# Replace auto-create startup with Library-first production setup.
old = r'''void renderer
  .start()
  .then(async (snapshot) => {
    logger.info('renderer.runtime-ready', { snapshot });
    if (snapshot.deviceState !== 'ready') return;
    const surfaceSize = shell.currentRenderSurfaceSize();
    const persistence = await paintPersistence.initialize({
      name: 'Untitled',
      document: {
        width: Math.max(1, Math.round(surfaceSize.width / surfaceSize.pixelRatio)),
        height: Math.max(1, Math.round(surfaceSize.height / surfaceSize.pixelRatio)),
      },
    });
    const document = paintSession.currentDocument();
    if (document === null) throw new Error('paint persistence initialized without a document');
    root.dataset.illustroPaintRecovery = persistence.mode;
    root.dataset.illustroPaintSession = 'ready';
    publishDocumentState(document);
    root.dataset.illustroActiveLayerId = String(document.layerTree.rootLayerIds[0] ?? '');
    root.dataset.illustroPaintStroke = 'idle';
    root.dataset.illustroPaintStrokeSamples = '0';
    syncPngExportAvailability();
    publishPaintHistory();
    logger.info('paint-session.document-ready', {
      documentId: document.documentId,
      activeLayerId: document.layerTree.rootLayerIds[0] ?? null,
      width: document.canvas.width,
      height: document.canvas.height,
    });
  })
'''
new = r'''void renderer
  .start()
  .then(async (snapshot) => {
    logger.info('renderer.runtime-ready', { snapshot });
    if (snapshot.deviceState !== 'ready') return;
    const opfsRoot = await openIllustroOpfsRoot();
    localLibraryController = new LocalProjectLibraryControllerV1(opfsRoot);
    projectPreviewStore = new ProjectPreviewStoreV1(opfsRoot);
    localLibrarySurface = installM9aLibrarySurfaceV1({
      root,
      controller: localLibraryController,
      previews: projectPreviewStore,
      productShell: shell.productShell,
      onNewProject: () => documentWorkflow.openNewDocument(),
      async onOpenProject(projectId) {
        const persistence = await paintPersistence.openProject(projectId);
        const documentValue = paintSession.currentDocument();
        if (documentValue === null) throw new Error('Library open lost the active document');
        activatePaintDocument(documentValue, persistence.mode);
        shell.productShell.hideLibrary();
        logger.info('paint-session.document-ready', {
          documentId: documentValue.documentId,
          activeLayerId: documentValue.layerTree.rootLayerIds[0] ?? null,
          width: documentValue.canvas.width,
          height: documentValue.canvas.height,
        });
      },
      onImport: () => shell.productShell.openNamedTaskSurface('import-report'),
      canReturnToEditor: () => paintSession.currentDocument() !== null,
    });
    const libraryHost = document.querySelector<HTMLElement>('#m8-library-surface');
    if (libraryHost === null) throw new Error('Library host disappeared during M9A startup');
    libraryVisibilityObserver = new MutationObserver(() => {
      if (libraryHost.hidden) return;
      void captureActiveProjectPreview().then(() => localLibrarySurface?.refresh());
    });
    libraryVisibilityObserver.observe(libraryHost, {
      attributes: true,
      attributeFilter: ['hidden'],
    });
    root.dataset.illustroPaintSession = 'library';
    root.dataset.illustroPaintRecovery = 'library';
    await localLibrarySurface.show('projects');
    logger.info('library.production-ready');
  })
'''
assert old in s, 'startup block changed unexpectedly'
s = s.replace(old, new, 1)
# Cleanup Library resources before shell disposal.
s = s.replace(
    "    document.removeEventListener('visibilitychange', onPaintVisibilityChange);\n    layerComps.dispose();",
    "    document.removeEventListener('visibilitychange', onPaintVisibilityChange);\n    libraryVisibilityObserver?.disconnect();\n    localLibrarySurface?.dispose();\n    layerComps.dispose();",
    1,
)
p.write_text(s)
