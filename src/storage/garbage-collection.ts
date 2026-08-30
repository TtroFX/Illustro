import type { JsonValue } from '../domain/serialization.js';
import { isSha256Hex } from '../domain/resources.js';
import type { HistoryTransactionV1 } from '../history/history.js';
import { ProjectHistoryStoreV1 } from './history-store.js';
import { hasImmutableObject, readImmutableObject } from './immutable-object-store.js';
import { scanJournalFrames } from './journal.js';
import type {
  DirectoryHandleLike,
  IllustroOpfsRootV1,
  ProjectDirectoryLayoutV1,
} from './opfs-layout.js';
import { readDualRecoveryState } from './recovery-head.js';

export interface GarbageCollectionRootSetV1 {
  readonly schema: 'illustro.gc-roots/1';
  readonly publishedHeads: readonly string[];
  readonly retainedCheckpoints: readonly string[];
  readonly retainedHistory: readonly string[];
  readonly activeJournal: readonly string[];
  readonly timelapseAndResources: readonly string[];
  readonly activeTransaction: readonly string[];
}

export interface GarbageCollectionPlanV1 {
  readonly schema: 'illustro.gc-plan/1';
  readonly destructive: false;
  readonly enumerationSupported: boolean;
  readonly roots: GarbageCollectionRootSetV1;
  readonly reachableObjectHashes: readonly string[];
  readonly unreachableCandidateHashes: readonly string[];
  readonly missingReferencedHashes: readonly string[];
  readonly inventoryObjectCount: number | null;
}

export interface AdditionalGarbageCollectionRootsV1 {
  readonly retainedCheckpoints?: readonly string[];
  readonly retainedHistory?: readonly string[];
  readonly timelapseAndResources?: readonly string[];
  readonly activeTransaction?: readonly string[];
}

type EnumerableDirectoryHandleLike = DirectoryHandleLike & {
  entries?: () => AsyncIterableIterator<[string, unknown]>;
};

function uniqueHashes(values: Iterable<string>): readonly string[] {
  const output = new Set<string>();
  for (const value of values) {
    if (!isSha256Hex(value)) throw new TypeError(`GC root is not a SHA-256 hash: ${value}`);
    output.add(value);
  }
  return Object.freeze([...output].sort());
}

function collectHashesFromUnknown(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectHashesFromUnknown(item, output);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.algorithm === 'sha256' && isSha256Hex(record.hash)) output.add(record.hash);
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string' && key.toLowerCase().endsWith('objecthash') && isSha256Hex(item)) {
      output.add(item);
      continue;
    }
    collectHashesFromUnknown(item, output);
  }
}

function collectTransactionHashes(transaction: HistoryTransactionV1, output: Set<string>): void {
  collectHashesFromUnknown(transaction.payload.before, output);
  collectHashesFromUnknown(transaction.payload.after, output);
}

async function readFileTextIfPresent(
  directory: DirectoryHandleLike,
  filename: string,
): Promise<string | null> {
  try {
    return await (await directory.getFileHandle(filename)).getFile().then((file) => file.text());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function collectCheckpointRoots(
  project: ProjectDirectoryLayoutV1,
): Promise<readonly string[]> {
  const hashes = new Set<string>();
  const directory = project.directories.checkpoints as EnumerableDirectoryHandleLike;
  if (typeof directory.entries !== 'function') return Object.freeze([]);
  for await (const [name] of directory.entries.call(directory)) {
    if (!name.endsWith('.json')) continue;
    const text = await readFileTextIfPresent(project.directories.checkpoints, name);
    if (text === null) continue;
    try {
      collectHashesFromUnknown(JSON.parse(text) as unknown, hashes);
    } catch {
      // A corrupt retained checkpoint is not trusted as a GC root; recovery inspection handles it separately.
    }
  }
  return uniqueHashes(hashes);
}

async function collectJournalRoots(project: ProjectDirectoryLayoutV1): Promise<readonly string[]> {
  try {
    const file = await project.directories.journal.getFileHandle('main.ilj');
    const bytes = new Uint8Array(await (await file.getFile()).arrayBuffer());
    const scan = await scanJournalFrames(bytes);
    const hashes = new Set<string>();
    for (const frame of scan.frames) collectHashesFromUnknown(frame.payload, hashes);
    return uniqueHashes(hashes);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return Object.freeze([]);
    throw error;
  }
}

async function collectHistoryRoots(project: ProjectDirectoryLayoutV1): Promise<readonly string[]> {
  const store = new ProjectHistoryStoreV1(project);
  const loaded = await store.loadState();
  if (loaded.status !== 'ok') return Object.freeze([]);
  const hashes = new Set<string>();
  for (const entry of loaded.state.entries) {
    if (entry.storage === 'resident') {
      collectTransactionHashes(entry.transaction, hashes);
    } else {
      collectTransactionHashes(await store.loadTransaction(entry.reference), hashes);
    }
  }
  return uniqueHashes(hashes);
}

export async function collectProjectGarbageCollectionRootsV1(
  project: ProjectDirectoryLayoutV1,
  additional: AdditionalGarbageCollectionRootsV1 = {},
): Promise<GarbageCollectionRootSetV1> {
  const recovery = await readDualRecoveryState(project);
  const publishedHeads = uniqueHashes(
    [recovery.a?.checkpointObject.hash, recovery.b?.checkpointObject.hash].filter(
      (value): value is string => value !== undefined,
    ),
  );
  const [checkpointRoots, journalRoots, historyRoots] = await Promise.all([
    collectCheckpointRoots(project),
    collectJournalRoots(project),
    collectHistoryRoots(project),
  ]);
  return Object.freeze({
    schema: 'illustro.gc-roots/1',
    publishedHeads,
    retainedCheckpoints: uniqueHashes([
      ...checkpointRoots,
      ...(additional.retainedCheckpoints ?? []),
    ]),
    retainedHistory: uniqueHashes([...historyRoots, ...(additional.retainedHistory ?? [])]),
    activeJournal: uniqueHashes(journalRoots),
    timelapseAndResources: uniqueHashes(additional.timelapseAndResources ?? []),
    activeTransaction: uniqueHashes(additional.activeTransaction ?? []),
  });
}

function allRoots(roots: GarbageCollectionRootSetV1): readonly string[] {
  return uniqueHashes([
    ...roots.publishedHeads,
    ...roots.retainedCheckpoints,
    ...roots.retainedHistory,
    ...roots.activeJournal,
    ...roots.timelapseAndResources,
    ...roots.activeTransaction,
  ]);
}

function outgoingHashes(bytes: Uint8Array): readonly string[] {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as JsonValue;
    const hashes = new Set<string>();
    collectHashesFromUnknown(value, hashes);
    return uniqueHashes(hashes);
  } catch {
    return Object.freeze([]);
  }
}

async function markReachable(
  root: IllustroOpfsRootV1,
  roots: GarbageCollectionRootSetV1,
): Promise<{ readonly reachable: readonly string[]; readonly missing: readonly string[] }> {
  const reachable = new Set<string>();
  const missing = new Set<string>();
  const queue = [...allRoots(roots)];
  while (queue.length > 0) {
    const hash = queue.shift();
    if (hash === undefined || reachable.has(hash) || missing.has(hash)) continue;
    try {
      if (!(await hasImmutableObject(root.sha256Objects, hash))) {
        missing.add(hash);
        continue;
      }
      const bytes = await readImmutableObject(root.sha256Objects, hash);
      reachable.add(hash);
      for (const dependency of outgoingHashes(bytes)) {
        if (!reachable.has(dependency) && !missing.has(dependency)) queue.push(dependency);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        missing.add(hash);
        continue;
      }
      throw error;
    }
  }
  return Object.freeze({
    reachable: uniqueHashes(reachable),
    missing: uniqueHashes(missing),
  });
}

async function enumerateImmutableObjects(
  directory: DirectoryHandleLike,
): Promise<readonly string[] | null> {
  const root = directory as EnumerableDirectoryHandleLike;
  if (typeof root.entries !== 'function') return null;
  const hashes = new Set<string>();
  for await (const [prefix] of root.entries.call(root)) {
    if (!/^[0-9a-f]{2}$/.test(prefix)) continue;
    let prefixDirectory: DirectoryHandleLike;
    try {
      prefixDirectory = await directory.getDirectoryHandle(prefix);
    } catch {
      continue;
    }
    const enumerablePrefix = prefixDirectory as EnumerableDirectoryHandleLike;
    if (typeof enumerablePrefix.entries !== 'function') return null;
    for await (const [suffix] of enumerablePrefix.entries.call(enumerablePrefix)) {
      const hash = isSha256Hex(suffix) ? suffix : `${prefix}${suffix}`;
      if (isSha256Hex(hash) && hash.startsWith(prefix)) hashes.add(hash);
    }
  }
  return uniqueHashes(hashes);
}

export async function planGarbageCollectionV1(
  root: IllustroOpfsRootV1,
  roots: GarbageCollectionRootSetV1,
): Promise<GarbageCollectionPlanV1> {
  const marked = await markReachable(root, roots);
  const inventory = await enumerateImmutableObjects(root.sha256Objects);
  const reachable = new Set(marked.reachable);
  const candidates =
    inventory === null
      ? []
      : inventory.filter((hash) => !reachable.has(hash) && !marked.missing.includes(hash));
  return Object.freeze({
    schema: 'illustro.gc-plan/1',
    destructive: false,
    enumerationSupported: inventory !== null,
    roots,
    reachableObjectHashes: marked.reachable,
    unreachableCandidateHashes: Object.freeze(candidates),
    missingReferencedHashes: marked.missing,
    inventoryObjectCount: inventory?.length ?? null,
  });
}
