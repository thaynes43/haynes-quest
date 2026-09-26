import { Pool, type PoolConfig } from 'pg';
import {
  classifyError,
  emitSafeDiagnostic,
  writeSafeDiagnostic,
  type DiagnosticSink,
} from '../diagnostics.js';

/**
 * Every process-owned pg Pool is built here. A connection can fail at any
 * time (a CNPG switchover terminates it with 57P01), and pg then emits `error`
 * on the client and, for an idle client, on the pool as well. An EventEmitter
 * with no `error` listener throws, which crashes the process and prints the raw
 * client to stderr, bypassing the safe diagnostic contract.
 *
 * - The pool listener reports one fixed diagnostic for an idle client; pg has
 *   already discarded that client, and the next query opens a fresh one.
 * - pg removes its own listener while a client is checked out (a transaction,
 *   or a Better Auth query), so each client also gets a permanent listener. The
 *   failure then reaches the caller as a rejected query, which reports it.
 */
export function createDatabasePool(
  config: PoolConfig,
  sink: DiagnosticSink = writeSafeDiagnostic,
): Pool {
  const pool = new Pool(config);
  pool.on('error', (error) => {
    emitSafeDiagnostic(sink, { event: 'database_connection_lost', errorClass: classifyError(error) });
  });
  pool.on('connect', (client) => {
    client.on('error', ignoreClientError);
  });
  return pool;
}

function ignoreClientError(): void {
  // Deliberately empty: see createDatabasePool.
}
