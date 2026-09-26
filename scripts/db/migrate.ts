import { migrateQuestDatabase } from '../../src/server/db/migrate.js';
import { createDatabasePool } from '../../src/server/db/pool.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = createDatabasePool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });

try {
  const count = await migrateQuestDatabase(pool, process.env.QUEST_MIGRATIONS_DIR);
  process.stdout.write(`Applied ${count} migration file(s)\n`);
} finally {
  await pool.end();
}
