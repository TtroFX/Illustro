import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`M5A document foundation missing ${label}: ${token}`);
};

const html = read('src/index.html');
const main = read('src/app/main.ts');
const workflow = read('src/app/document-workflow-controller.ts');
const session = read('src/app/paint-session-controller.ts');
const history = read('src/app/paint-history-controller.ts');
const persistence = read('src/app/paint-persistence-controller.ts');
const renderer = read('src/app/renderer-controller.ts');
const worker = read('src/workers/render.worker.ts');
const presets = read('src/domain/document-presets.ts');

for (const id of [
  'new-document',
  'document-settings',
  'document-width',
  'document-height',
  'document-ppi',
  'document-background-mode',
  'document-working-space',
  'document-precision',
])
  required(html, `id="${id}"`, `UI ${id}`);
required(main, 'installDocumentWorkflowControllerV1', 'production workflow installation');
required(workflow, 'canvasAdmission.preflight', 'create admission preflight');
required(workflow, 'createNewProject', 'persistent new-project path');
required(session, 'commitDocumentSettings', 'document metadata mutation');
required(history, "commandId: 'document.settings.update'", 'history transaction');
required(persistence, 'async createNewProject', 'new persistent project operation');
required(renderer, 'illustroRendererWorkingSpace', 'renderer working-space diagnostics');
required(renderer, 'illustroRendererPrecision', 'renderer precision diagnostics');
required(worker, 'isDocumentWorkingSpace', 'worker working-space validation');
required(worker, 'isDocumentPrecision', 'worker precision validation');
required(presets, 'a4-portrait-300', 'print preset');
required(presets, 'uhd-4k', 'screen preset');

console.log('M5A document foundation verification passed');
