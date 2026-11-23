import pg from "pg";
import { config } from "./config.js";

// NUMERIC comes back as a string by default; parse it so prices are numbers in JSON.
pg.types.setTypeParser(1700, (v) => Number(v));
// COUNT(*) is BIGINT
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: config.dbPoolSize });

export type Queryable = Pick<pg.PoolClient, "query">;

/** Run fn inside a transaction; rolls back on any thrown error. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
