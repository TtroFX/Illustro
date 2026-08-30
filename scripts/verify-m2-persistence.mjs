import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`M2 inspection failed: ${label}`);
}

const progress = await read('IMPLEMENTATION_PROGRESS.md');
for (let index = 1; index <= 44; index += 1) {
  const id = `M2-${String(index).padStart(3, '0')}`;
  const line = progress.split('\n').find((entry) => entry.startsWith(`${id} `));
  if (line === undefined || !line.endsWith(':完了')) {
    throw new Error(`M2 inspection failed: ${id} is not closed`);
  }
}

const [
  storageWorker,
  transaction,
  recoveryHead,
  history,
  historyStore,
  coordination,
  quota,
  growthGuard,
  maintenance,
  garbageCollection,
  projectWorker,
  historyWorker,
] = await Promise.all([
  read('src/workers/storage.worker.ts'),
  read('src/storage/transaction.ts'),
  read('src/storage/recovery-head.ts'),
  read('src/history/history.ts'),
  read('src/storage/history-store.ts'),
  read('src/storage/project-coordination.ts'),
  read('src/storage/storage-quota.ts'),
  read('src/storage/storage-growth-guard.ts'),
  read('src/storage/storage-maintenance-worker-extension.ts'),
  read('src/storage/garbage-collection.ts'),
  read('src/storage/project-worker-extension.ts'),
  read('src/storage/history-worker-extension.ts'),
]);

requireText(
  storageWorker,
  'storage-maintenance-worker-extension.js',
  'maintenance extension is not in the production worker',
);
requireText(
  storageWorker,
  'storageGrowthGuard.assertRawGrowth',
  'raw object/tile growth is not quota-gated',
);
requireText(
  storageWorker,
  'storageGrowthGuard.assertJsonGrowth',
  'transaction/entity growth is not quota-gated',
);
requireText(
  storageWorker,
  'storage.quota.unsafeGrowth',
  'quota failures are not surfaced as data-safety errors',
);
requireText(transaction, "kind: 'prepare'", 'transaction prepare journal frame missing');
requireText(transaction, "kind: 'commit'", 'transaction commit journal frame missing');
requireText(transaction, 'publishCheckpoint', 'checkpoint publication missing');
requireText(transaction, 'publishRecoveryHead', 'recovery-head publication missing');
requireText(recoveryHead, 'generation', 'dual-head recovery generation missing');
requireText(
  history,
  'DEFAULT_HISTORY_RETENTION_TRANSACTIONS = 1_000',
  '1000-transaction retention target missing',
);
requireText(historyStore, 'illustro.history-segment-envelope/1', 'history spill envelope missing');
requireText(
  coordination,
  "mode: 'exclusive', ifAvailable: true",
  'exclusive Web Lock acquisition missing',
);
requireText(coordination, 'BroadcastChannel', 'BroadcastChannel propagation missing');
requireText(
  coordination,
  "mode: 'read-only', reason: 'locked-elsewhere'",
  'second-tab read-only fallback missing',
);
requireText(quota, 'QUOTA_WARNING_MIN_BYTES = 512 * MEBIBYTE', 'warning reserve minimum missing');
requireText(quota, 'QUOTA_CRITICAL_MIN_BYTES = 256 * MEBIBYTE', 'critical reserve minimum missing');
requireText(quota, 'QUOTA_HARD_MIN_BYTES = 128 * MEBIBYTE', 'hard reserve minimum missing');
requireText(
  quota,
  'reserve(quota, QUOTA_WARNING_MIN_BYTES, 0.15)',
  'warning reserve ratio missing',
);
requireText(
  quota,
  'reserve(quota, QUOTA_CRITICAL_MIN_BYTES, 0.08)',
  'critical reserve ratio missing',
);
requireText(quota, 'reserve(quota, QUOTA_HARD_MIN_BYTES, 0.05)', 'hard reserve ratio missing');
requireText(quota, "'QuotaExceededError'", 'hard-reserve breach does not raise QuotaExceededError');
requireText(
  growthGuard,
  'STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES',
  'transaction growth overhead missing',
);
requireText(maintenance, "type: 'storage.gc.plan'", 'production GC planning request missing');
requireText(maintenance, 'requestPersistence()', 'persistent-storage request plumbing missing');
requireText(
  garbageCollection,
  'destructive: false',
  'M2 GC foundation must remain non-destructive',
);
requireText(garbageCollection, 'publishedHeads', 'published-head GC roots missing');
requireText(garbageCollection, 'retainedHistory', 'history GC roots missing');
requireText(garbageCollection, 'activeJournal', 'journal GC roots missing');
requireText(garbageCollection, 'activeTransaction', 'active-transaction GC roots missing');
requireText(
  projectWorker,
  'storageGrowthGuard.assertJsonGrowth',
  'project lifecycle writes are not quota-gated',
);
requireText(
  historyWorker,
  'storageGrowthGuard.assertJsonGrowth',
  'history writes are not quota-gated',
);

console.log(JSON.stringify({ event: 'm2.persistence.inspection.pass', closedItems: 44 }));
