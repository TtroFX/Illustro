import { buildIdentity } from '../generated/build-info.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly scope: string;
  readonly event: string;
  readonly buildSha: string;
  readonly data?: unknown;
}

const MAX_LOG_RECORDS = 200;
const records: StructuredLogRecord[] = [];

function normalizeData(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }

  if (data === undefined) return undefined;

  try {
    JSON.stringify(data);
    return data;
  } catch {
    return String(data);
  }
}

function emit(level: LogLevel, scope: string, event: string, data?: unknown): void {
  const normalized = normalizeData(data);
  const record: StructuredLogRecord = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    buildSha: buildIdentity.buildSha,
    ...(normalized === undefined ? {} : { data: normalized }),
  };

  records.push(record);
  if (records.length > MAX_LOG_RECORDS) records.splice(0, records.length - MAX_LOG_RECORDS);

  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') console.debug(line);
  else console.info(line);
}

export interface StructuredLogger {
  debug(event: string, data?: unknown): void;
  info(event: string, data?: unknown): void;
  warn(event: string, data?: unknown): void;
  error(event: string, data?: unknown): void;
}

export function createLogger(scope: string): StructuredLogger {
  return {
    debug: (event, data) => emit('debug', scope, event, data),
    info: (event, data) => emit('info', scope, event, data),
    warn: (event, data) => emit('warn', scope, event, data),
    error: (event, data) => emit('error', scope, event, data),
  };
}

export function getRecentLogRecords(): readonly StructuredLogRecord[] {
  return records.slice();
}
