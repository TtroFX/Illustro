import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`M9A verification failed: ${label}`);
}

const main = read('src/app/main.ts');
const surface = read('src/app/m9a-library-surface.ts');
const controller = read('src/app/local-project-library-controller.ts');
const preview = read('src/app/project-preview-store.ts');
const css = read('public/m9a-library.css');
const canonicalAssets = JSON.parse(read('verification/m8a-canonical-assets.json'));

for (const [text, label] of [
  ['data-section="projects"', 'Projects navigation'],
  ['data-section="recent"', 'Recent navigation'],
  ['data-section="recovery"', 'Recovery navigation'],
  ['data-section="recently-deleted"', 'Recently Deleted navigation'],
  ['data-section="import"', 'Import navigation'],
  ['data-m9a-search', 'project search'],
  ['data-m9a-sort', 'project sorting'],
  ['data-m9a-view="grid"', 'grid view'],
  ['data-m9a-view="list"', 'list view'],
]) requireText(surface, text, label);

requireText(controller, "section === 'recovery'", 'recovery query');
requireText(controller, "section === 'recently-deleted'", 'Recently Deleted query');
requireText(controller, 'normalizeSearch', 'search normalization');
requireText(controller, 'compareCards', 'sorting policy');
requireText(controller, 'async rename(', 'rename organization action');
requireText(controller, 'async duplicate(', 'duplicate organization action');
requireText(controller, 'async restore(', 'restore action');

requireText(preview, 'ProjectPreviewStoreV1', 'persistent preview store');
requireText(preview, 'directories.previews.getFileHandle', 'OPFS preview directory');
requireText(main, 'openIllustroOpfsRoot()', 'Library OPFS startup');
requireText(main, 'installM9aLibrarySurfaceV1', 'production Library surface install');
requireText(main, 'documentWorkflow.openNewDocument()', 'create from Library');
requireText(main, 'paintPersistence.openProject(projectId)', 'open from Library');
requireText(main, "openNamedTaskSurface('import-report')", 'Import staging route');
requireText(main, "localLibrarySurface.show('projects')", 'Library-first startup');
requireText(main, 'createProjectThumbnailPngV1(png)', 'thumbnail generation');
requireText(
  main,
  'controller.updatePreview(current.projectId, resourceId)',
  'thumbnail metadata publication',
);
requireText(main, 'previousPreview ?? undefined', 'stable preview resource reuse');
if (main.includes("name: 'Untitled',\n      document:")) {
  throw new Error('M9A verification failed: startup still auto-creates Untitled project');
}

requireText(surface, 'controller.trash(card.projectId)', 'reversible delete');
requireText(surface, 'controller.restore(card.projectId)', 'restore from Recently Deleted');
requireText(surface, "recovery.textContent = 'Recovery'", 'non-colour recovery label');
requireText(surface, 'if (!isActiveProject)', 'active-project delete protection');
requireText(css, '.m9a-project-card', 'project card styling');
requireText(css, '@media(max-width:599px)', 'compact Library layout');

const canonical = canonicalAssets?.canonicalUiVisualTarget;
if (canonical?.primaryFileName !== 'ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png') {
  throw new Error('M9A verification failed: canonical visual reference file changed');
}
if (canonical?.sha256 !== '32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13') {
  throw new Error('M9A verification failed: canonical visual reference SHA changed');
}

console.log(
  JSON.stringify({
    event: 'm9a.local-project-library.verified',
    canonicalSha256: canonical.sha256,
  }),
);