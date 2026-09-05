from pathlib import Path

p = Path('src/app/paint-persistence-controller.ts')
s = p.read_text()
marker = "  async createNewProject(input: {\n"
assert marker in s
method = r'''  async openProject(projectIdValue: ProjectId | string): Promise<PaintPersistenceInitializeResultV1> {
    this.#assertNotDisposed();
    if (this.#status === 'initializing' || this.#status === 'saving') {
      throw new Error('paint persistence is busy');
    }
    const projectId = parseProjectId(projectIdValue);
    const previousProjectId = this.#projectId;
    try {
      if (previousProjectId !== null) {
        await this.#flush('autosave');
        await this.#request({ type: 'storage.project.close', projectId: previousProjectId });
      }
      this.#setStatus('initializing');
      const opened = parseStorageProjectState(
        await this.#request({ type: 'storage.project.open', projectId }),
      );
      const durable = parsePaintPersistenceProjectSnapshotV1(opened.snapshot);
      if (durable.paint.document.projectId !== opened.projectId) {
        throw new Error('opened paint snapshot belongs to another project');
      }
      if (durable.paint.document.revision !== opened.documentRevision) {
        throw new Error('opened paint revision disagrees with checkpoint metadata');
      }
      this.#adoptProject(opened);
      this.#resetRasterPersistenceState();
      if (durable.raster === undefined) {
        await this.#session.restoreProjectSnapshot(durable.paint);
        this.#history.reset();
        this.#rasterStateEnabled = true;
        await this.#migrateLegacyRasterSnapshot();
        await this.markDirty(crypto.randomUUID());
        await this.#flush('autosave');
      } else {
        this.#rasterStateEnabled = true;
        this.#indexDurableRasterState(durable);
        const tiles = await this.#loadCurrentRasterTiles(durable.paint);
        await this.#session.restoreCanonicalProjectSnapshot(durable.paint, tiles);
        this.#history.hydrate(durable.history, durable.revisionHighWater);
      }
      this.#rememberProject(opened.projectId);
      this.#setStatus('ready');
      return Object.freeze({
        schema: 'illustro.paint-persistence-initialize/1' as const,
        mode: 'recovered' as const,
        projectId: opened.projectId,
        sequence: this.#sequence,
        recoveryGeneration: this.#recoveryGeneration,
        documentRevision: this.#session.currentDocument()?.revision ?? opened.documentRevision,
      });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

'''
s = s.replace(marker, method + marker, 1)
s = s.replace("  async flushRecovery(): Promise<void> {\n    await this.#flush('recovery');\n  }", "  async flushRecovery(): Promise<void> {\n    if (this.#projectId === null) return;\n    await this.#flush('recovery');\n  }")
s = s.replace("  async flushCheckpoint(): Promise<void> {\n    await this.#flush('autosave');\n  }", "  async flushCheckpoint(): Promise<void> {\n    if (this.#projectId === null) return;\n    await this.#flush('autosave');\n  }")
p.write_text(s)

p = Path('src/app/local-project-library-controller.ts')
s = p.read_text()
marker = "  async trash(projectId: ProjectId | string, now?: Date): Promise<LocalProjectMetadataV1> {\n"
assert marker in s
methods = r'''  async rename(
    projectId: ProjectId | string,
    name: string,
    now?: Date,
  ): Promise<LocalProjectMetadataV1> {
    return now === undefined
      ? this.#library.rename(projectId, name)
      : this.#library.rename(projectId, name, now);
  }

  async duplicate(
    projectId: ProjectId | string,
    options: { readonly name?: string; readonly now?: Date } = {},
  ): Promise<LocalProjectCreateResultV1> {
    return this.#library.duplicate(projectId, options);
  }

  async updatePreview(
    projectId: ProjectId | string,
    previewResourceId: ResourceId | null,
  ): Promise<LocalProjectMetadataV1> {
    return this.#library.updatePreview(projectId, previewResourceId);
  }

'''
s = s.replace(marker, methods + marker, 1)
p.write_text(s)

p = Path('src/app/shell.ts')
s = p.read_text()
s = s.replace("import { installM8ProductShellV1 } from './m8-product-shell.js';", "import {\n  installM8ProductShellV1,\n  type M8ProductShellHandleV1,\n} from './m8-product-shell.js';")
s = s.replace("export interface FoundationShell {\n  readonly canvas: HTMLCanvasElement;", "export interface FoundationShell {\n  readonly canvas: HTMLCanvasElement;\n  readonly productShell: M8ProductShellHandleV1;")
s = s.replace("  return {\n    canvas,", "  return {\n    canvas,\n    productShell: m8ProductShell,")
p.write_text(s)
