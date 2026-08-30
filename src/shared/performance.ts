export interface PerformanceEntrySnapshot {
  readonly name: string;
  readonly entryType: string;
  readonly startTime: number;
  readonly duration: number;
}

export interface PerformanceDiagnostics {
  readonly counters: Readonly<Record<string, number>>;
  readonly entries: readonly PerformanceEntrySnapshot[];
}

const MAX_ENTRIES = 200;
const counters = new Map<string, number>();
const entries: PerformanceEntrySnapshot[] = [];
let observer: PerformanceObserver | undefined;

function rememberEntry(entry: PerformanceEntry): void {
  entries.push({
    name: entry.name,
    entryType: entry.entryType,
    startTime: entry.startTime,
    duration: entry.duration,
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function startPerformanceInstrumentation(): () => void {
  if (observer || typeof PerformanceObserver === 'undefined') return () => undefined;

  const entryTypes = ['measure'];
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) entryTypes.push('longtask');

  observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) rememberEntry(entry);
  });

  try {
    observer.observe({ entryTypes });
  } catch {
    observer.disconnect();
    observer = undefined;
  }

  return () => {
    observer?.disconnect();
    observer = undefined;
  };
}

export function incrementPerformanceCounter(name: string, delta = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function markPerformance(name: string): void {
  if (typeof performance !== 'undefined') performance.mark(name);
}

export function measurePerformance(name: string, startMark: string, endMark?: string): void {
  if (typeof performance === 'undefined') return;

  try {
    if (endMark === undefined) performance.measure(name, startMark);
    else performance.measure(name, startMark, endMark);
  } catch {
    incrementPerformanceCounter('performance.measure.failure');
  }
}

export function getPerformanceDiagnostics(): Readonly<PerformanceDiagnostics> {
  return Object.freeze({
    counters: Object.freeze(Object.fromEntries(counters.entries())),
    entries: entries.slice(),
  });
}
