/**
 * Safe server diagnostics: fixed identifiers only, never request bodies, ids,
 * dates, names or exception text. Kept free of the HTTP app so the database
 * layer and the operator CLI can report through the same contract.
 */
import { AppError } from './errors.js';

export type SafeErrorClass =
  | 'app-error'
  | 'aggregate-error'
  | 'eval-error'
  | 'range-error'
  | 'reference-error'
  | 'syntax-error'
  | 'type-error'
  | 'uri-error'
  | 'error'
  | 'non-error';

export interface SafeDiagnostic {
  event:
    | 'api_request_failed'
    | 'auto_pick_failed'
    | 'database_connection_lost'
    | 'maintenance_failed'
    | 'shutdown_failed'
    | 'startup_failed'
    | 'template_upgrade_failed';
  errorClass: SafeErrorClass;
  method?: string;
  route?: string;
  phase?: 'scheduled' | 'startup';
  /** Fixed application error code (never request-derived), for server-side AppError failures. */
  code?: string;
  status?: number;
}

export type DiagnosticSink = (diagnostic: SafeDiagnostic) => void;

export function classifyError(error: unknown): SafeErrorClass {
  if (error instanceof AppError) return 'app-error';
  if (error instanceof AggregateError) return 'aggregate-error';
  if (error instanceof EvalError) return 'eval-error';
  if (error instanceof RangeError) return 'range-error';
  if (error instanceof ReferenceError) return 'reference-error';
  if (error instanceof SyntaxError) return 'syntax-error';
  if (error instanceof TypeError) return 'type-error';
  if (error instanceof URIError) return 'uri-error';
  if (error instanceof Error) return 'error';
  return 'non-error';
}

export function writeSafeDiagnostic(diagnostic: SafeDiagnostic): void {
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
}

export function emitSafeDiagnostic(sink: DiagnosticSink, diagnostic: SafeDiagnostic): void {
  try {
    sink(diagnostic);
  } catch {
    // Diagnostics must not change the response or expose the original failure.
  }
}
