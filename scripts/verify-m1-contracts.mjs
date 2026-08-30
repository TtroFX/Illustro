import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const progress = read('IMPLEMENTATION_PROGRESS.md');
for (let index = 1; index <= 47; index += 1) {
  const id = `M1-${String(index).padStart(3, '0')}`;
  const line = progress.split('\n').find((entry) => entry.startsWith(`${id} `));
  assert(line !== undefined, `missing progress entry: ${id}`);
  assert(line.endsWith(':完了'), `M1 contract is not closed: ${id}`);
}

const sourceContracts = new Map([
  ['src/domain/identity.ts', ['DocumentId', 'LayerId', 'ResourceId', 'ObjectId', 'NodeId']],
  ['src/domain/document.ts', ['DocumentV1', 'CanvasSpec']],
  [
    'src/domain/state-boundaries.ts',
    ['createProjectMetadataState', 'createWorkspaceSessionStore', 'createDefaultWorkspaceStateV1'],
  ],
  ['src/domain/layers.ts', ['RasterLayerV1', 'FolderLayerV1']],
  ['src/domain/special-layers.ts', ['LineartGroupLayerV1', 'LineartBoundaryLayerV1']],
  ['src/domain/brush-schema.ts', ['BRUSH_SCHEMA_ID']],
  ['src/domain/resources.ts', ['ResourceProvenanceV1']],
  [
    'src/domain/command-registry.ts',
    ['CommandRegistryV1', 'CommandTransactionId', 'parseCommandId'],
  ],
  [
    'src/domain/serialization.ts',
    ['serializeJson', 'deserializeJson', 'validateValueSchema', 'classifyVersionCompatibility'],
  ],
  ['src/domain/migration.ts', ['MigrationRegistryV1', 'createMigrationStep']],
  [
    'src/domain/reports.ts',
    ['createCompatibilityReport', 'createFidelityReport', 'createStructuredErrorRecord'],
  ],
  [
    'src/app/runtime-profile.ts',
    ['createRuntimeCapabilityProfile', 'probeArrayBufferTransferSupport'],
  ],
  [
    'src/domain/workspace-settings.ts',
    ['createDefaultWorkspaceStateV1', 'createDefaultUserSettingsV1', 'createUserSettingsStoreV1'],
  ],
  ['src/domain/internal-id.ts', ['parseInternalId', 'isLocaleNeutralInternalId']],
]);

const forbiddenStubPattern = /\b(?:TODO|FIXME|NotImplemented)\b|not implemented/iu;
for (const [relativePath, requiredTokens] of sourceContracts) {
  const content = read(relativePath);
  assert(content.trim().length > 0, `empty M1 contract source: ${relativePath}`);
  assert(
    !forbiddenStubPattern.test(content),
    `stub marker remains in M1 contract source: ${relativePath}`,
  );
  for (const token of requiredTokens) {
    assert(content.includes(token), `missing M1 contract token ${token} in ${relativePath}`);
  }
}

const requiredTests = [
  'tests/unit/identity.test.ts',
  'tests/unit/document-contract.test.ts',
  'tests/unit/state-boundaries.test.ts',
  'tests/unit/layers.test.ts',
  'tests/unit/special-layers.test.ts',
  'tests/unit/resources.test.ts',
  'tests/unit/command-registry.test.ts',
  'tests/unit/serialization.test.ts',
  'tests/unit/m1-contracts.test.ts',
  'tests/unit/runtime-profile.test.ts',
  'tests/unit/workspace-settings.test.ts',
];
for (const relativePath of requiredTests) {
  assert(fs.existsSync(path.join(root, relativePath)), `missing M1 unit test: ${relativePath}`);
}

const main = read('src/app/main.ts');
assert(
  main.includes("from './runtime-profile.js'"),
  'runtime capability profile is not wired into app bootstrap',
);
assert(
  main.includes('createRuntimeCapabilityProfile('),
  'runtime capability profile is not evaluated in production bootstrap',
);

const stateBoundaries = read('src/domain/state-boundaries.ts');
assert(
  stateBoundaries.includes("from './workspace-settings.js'"),
  'workspace persistence schema is not connected to workspace/session state',
);
assert(
  stateBoundaries.includes('normalizeWorkspaceStateV1('),
  'workspace/session store does not normalize persistent workspace state',
);

const commandRegistry = read('src/domain/command-registry.ts');
assert(
  commandRegistry.includes('document-transaction'),
  'command registry lacks document transaction semantics',
);
assert(
  commandRegistry.includes('unavailable') && commandRegistry.includes('disabled'),
  'command availability and disabled states are not distinct',
);

const memo = read('ILLUSTRO_DESIGN_MEMO.md');
assert(
  memo.includes('canonical Command Registry') || memo.includes('Canonical Command Registry'),
  'canonical design memo no longer contains the command registry contract',
);

console.log(
  JSON.stringify({
    event: 'm1.contracts.verified',
    progressItems: 47,
    sourceContracts: sourceContracts.size,
    unitTestFiles: requiredTests.length,
  }),
);
