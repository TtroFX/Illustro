import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const librarySource = readFileSync(
  new URL('../../src/app/m9a-library-surface.ts', import.meta.url),
  'utf8',
);
const mainSource = readFileSync(new URL('../../src/app/main.ts', import.meta.url), 'utf8');
const previewSource = readFileSync(
  new URL('../../src/app/project-preview-store.ts', import.meta.url),
  'utf8',
);
const libraryCss = readFileSync(new URL('../../public/m9a-library.css', import.meta.url), 'utf8');

describe('M9A production Local Project Library', () => {
  it('exposes the frozen Library navigation and organization controls', () => {
    for (const label of ['Projects', 'Recent', 'Recovery', 'Recently Deleted', 'Import']) {
      expect(librarySource).toContain(`>${label}<`);
    }
    expect(librarySource).toContain('data-m9a-search');
    expect(librarySource).toContain('data-m9a-sort');
    expect(librarySource).toContain('data-m9a-view="grid"');
    expect(librarySource).toContain('data-m9a-view="list"');
    expect(libraryCss).toContain('.m9a-projects[data-view="list"]');
  });

  it('routes New and Open through canonical production persistence rather than mock state', () => {
    expect(mainSource).toContain('onNewProject: () => documentWorkflow.openNewDocument()');
    expect(mainSource).toContain('await paintPersistence.openProject(projectId)');
    expect(mainSource).toContain("await localLibrarySurface.show('projects')");
    expect(mainSource).not.toContain("name: 'Untitled',\n      document:");
  });

  it('persists real preview PNGs and publishes their resource IDs into Library metadata', () => {
    expect(previewSource).toContain('layout.directories.previews.getFileHandle');
    expect(mainSource).toContain('createProjectThumbnailPngV1(png)');
    expect(mainSource).toContain('const resourceId = await previews.write(');
    expect(mainSource).toContain('previousPreview ?? undefined');
    expect(mainSource).toContain('await controller.updatePreview(current.projectId, resourceId)');
    expect(mainSource).toContain('previousPreview ?? undefined');
  });

  it('keeps import as an explicit staging route until format milestones provide parsers', () => {
    expect(librarySource).toContain('Import Project');
    expect(librarySource).toContain('onImport');
    expect(mainSource).toContain("openNamedTaskSurface('import-report')");
    expect(mainSource).not.toContain('importProject(source)');
  });

  it('keeps Recently Deleted reversible and Recovery visible without colour-only state', () => {
    expect(librarySource).toContain('await options.controller.restore(card.projectId)');
    expect(librarySource).toContain('await options.controller.trash(card.projectId)');
    expect(librarySource).toContain("recovery.textContent = 'Recovery'");
    expect(librarySource).toContain("recovery.title = '復元可能なcheckpointがあります'");
    expect(librarySource).toContain('if (!isActiveProject)');
    expect(librarySource).toContain('if (!isActiveProject)');
  });
});
