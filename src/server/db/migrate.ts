import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';

const MIGRATION_LOCK_ID = 730_204_004;

export async function migrateQuestDatabase(pool: Pool, directory = 'migrations'): Promise<number> {
  const migrationsDirectory = resolve(directory);
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS quest_schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const name of names) await applyMigration(client, migrationsDirectory, name);
    return names.length;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

async function applyMigration(client: PoolClient, directory: string, name: string): Promise<void> {
  const sql = await readFile(resolve(directory, name), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const existing = await client.query<{ checksum: string }>(
    'SELECT checksum FROM quest_schema_migrations WHERE name = $1',
    [name],
  );
  if (existing.rowCount) {
    if (existing.rows[0]?.checksum !== checksum) throw new Error(`Migration checksum mismatch: ${name}`);
    return;
  }
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO quest_schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
