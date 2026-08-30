import { parseInternalId, type InternalId } from './internal-id.js';
import { toJsonValue, type JsonValue } from './serialization.js';

export type ReportIssueSeverityV1 = 'info' | 'warning' | 'lossy' | 'unsupported' | 'error';
export type FidelityMappingV1 =
  | 'exact'
  | 'converted'
  | 'approximated'
  | 'rasterized'
  | 'flattened'
  | 'ignored'
  | 'rejected';

export interface StructuredReportIssueV1 {
  readonly code: InternalId;
  readonly severity: ReportIssueSeverityV1;
  readonly sourcePath: string | null;
  readonly sourceFeature: string;
  readonly mapping: FidelityMappingV1;
  readonly resultingPath: string | null;
  readonly messageKey: InternalId;
  readonly details: JsonValue | null;
}

export interface StructuredCompatibilityReportV1 {
  readonly schema: 'illustro.compatibility-report/1';
  readonly sourceFormat: string;
  readonly sourceVersion: string | null;
  readonly issues: readonly StructuredReportIssueV1[];
  readonly writable: boolean;
  readonly requiresUserAcceptance: boolean;
}

export interface StructuredFidelityReportV1 {
  readonly schema: 'illustro.fidelity-report/1';
  readonly direction: 'import' | 'export';
  readonly format: string;
  readonly issues: readonly StructuredReportIssueV1[];
  readonly exact: boolean;
  readonly hasLoss: boolean;
}

export type StructuredErrorSeverityV1 = 'warning' | 'error' | 'fatal';
export type StructuredErrorRecoverabilityV1 = 'retryable' | 'recoverable' | 'fatal';

export interface StructuredErrorRecordV1 {
  readonly schema: 'illustro.error/1';
  readonly code: InternalId;
  readonly severity: StructuredErrorSeverityV1;
  readonly operation: InternalId;
  readonly messageKey: InternalId;
  readonly recoverability: StructuredErrorRecoverabilityV1;
  readonly details: JsonValue | null;
  readonly causeCode: InternalId | null;
}

export function createStructuredReportIssue(input: {
  code: string;
  severity: ReportIssueSeverityV1;
  sourcePath?: string | null;
  sourceFeature: string;
  mapping: FidelityMappingV1;
  resultingPath?: string | null;
  messageKey: string;
  details?: unknown;
}): StructuredReportIssueV1 {
  if (input.sourceFeature.length === 0) throw new TypeError('source feature must not be empty');
  return Object.freeze({
    code: parseInternalId(input.code, 'report issue code'),
    severity: input.severity,
    sourcePath: input.sourcePath ?? null,
    sourceFeature: input.sourceFeature,
    mapping: input.mapping,
    resultingPath: input.resultingPath ?? null,
    messageKey: parseInternalId(input.messageKey, 'report message key'),
    details: input.details === undefined ? null : toJsonValue(input.details),
  });
}

export function createCompatibilityReport(input: {
  sourceFormat: string;
  sourceVersion?: string | null;
  issues?: readonly StructuredReportIssueV1[];
}): StructuredCompatibilityReportV1 {
  if (input.sourceFormat.length === 0) throw new TypeError('source format must not be empty');
  const issues = Object.freeze([...(input.issues ?? [])]);
  const writable = !issues.some(
    (entry) =>
      entry.severity === 'unsupported' ||
      entry.severity === 'error' ||
      entry.mapping === 'rejected',
  );
  const requiresUserAcceptance = issues.some(
    (entry) =>
      entry.severity === 'lossy' ||
      entry.mapping === 'approximated' ||
      entry.mapping === 'rasterized' ||
      entry.mapping === 'flattened' ||
      entry.mapping === 'ignored',
  );
  return Object.freeze({
    schema: 'illustro.compatibility-report/1',
    sourceFormat: input.sourceFormat,
    sourceVersion: input.sourceVersion ?? null,
    issues,
    writable,
    requiresUserAcceptance,
  });
}

export function createFidelityReport(input: {
  direction: 'import' | 'export';
  format: string;
  issues?: readonly StructuredReportIssueV1[];
}): StructuredFidelityReportV1 {
  if (input.format.length === 0) throw new TypeError('fidelity format must not be empty');
  const issues = Object.freeze([...(input.issues ?? [])]);
  const hasLoss = issues.some(
    (entry) =>
      entry.severity === 'lossy' ||
      entry.severity === 'unsupported' ||
      entry.severity === 'error' ||
      entry.mapping === 'approximated' ||
      entry.mapping === 'rasterized' ||
      entry.mapping === 'flattened' ||
      entry.mapping === 'ignored' ||
      entry.mapping === 'rejected',
  );
  return Object.freeze({
    schema: 'illustro.fidelity-report/1',
    direction: input.direction,
    format: input.format,
    issues,
    exact: !hasLoss,
    hasLoss,
  });
}

export function createStructuredErrorRecord(input: {
  code: string;
  severity: StructuredErrorSeverityV1;
  operation: string;
  messageKey: string;
  recoverability: StructuredErrorRecoverabilityV1;
  details?: unknown;
  causeCode?: string | null;
}): StructuredErrorRecordV1 {
  if (input.severity === 'fatal' && input.recoverability !== 'fatal') {
    throw new TypeError('fatal errors must use fatal recoverability');
  }
  return Object.freeze({
    schema: 'illustro.error/1',
    code: parseInternalId(input.code, 'error code'),
    severity: input.severity,
    operation: parseInternalId(input.operation, 'error operation'),
    messageKey: parseInternalId(input.messageKey, 'error message key'),
    recoverability: input.recoverability,
    details: input.details === undefined ? null : toJsonValue(input.details),
    causeCode:
      input.causeCode === undefined || input.causeCode === null
        ? null
        : parseInternalId(input.causeCode, 'cause code'),
  });
}
