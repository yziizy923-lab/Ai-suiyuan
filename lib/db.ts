import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function queryWithFallback<T>(
  dbQuery: () => Promise<{ rows: T[] }>
): Promise<{ rows: T[]; fromBackup: boolean }> {
  try {
    const result = await dbQuery();
    return { rows: result.rows, fromBackup: false };
  } catch (err) {
    console.error('[DB] Database query failed:', err);
    return { rows: [], fromBackup: true };
  }
}

export async function querySingleWithFallback<T>(
  dbQuery: () => Promise<{ rows: T[] }>
): Promise<{ row: T | null; fromBackup: boolean }> {
  try {
    const result = await dbQuery();
    if (result.rows.length > 0) {
      return { row: result.rows[0], fromBackup: false };
    }
    return { row: null, fromBackup: false };
  } catch (err) {
    console.error('[DB] Database query failed:', err);
    return { row: null, fromBackup: true };
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.error('[DB] Connection test failed:', err);
    return false;
  }
}

export { pool };
