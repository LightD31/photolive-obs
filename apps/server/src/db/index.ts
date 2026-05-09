import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database, { type Database as BetterSqlite3Db } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _sqlite: BetterSqlite3Db | null = null;
let _db: DrizzleDb | null = null;

function ensureDb(): { db: DrizzleDb; sqlite: BetterSqlite3Db } {
  if (_db && _sqlite) return { db: _db, sqlite: _sqlite };
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return { db: _db, sqlite: _sqlite };
}

/** Eagerly open the database; call once at server boot after setConfig. */
export function initDb(): DrizzleDb {
  return ensureDb().db;
}

/**
 * Backward-compat exports. Both `db` and `sqliteConnection` are Proxies that
 * lazily call `ensureDb()` on first access, so existing callers like
 * `db.select().from(...)` keep working.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop, receiver) {
    const inner = ensureDb().db as unknown as object;
    const value = Reflect.get(inner, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
}) as DrizzleDb;

export const sqliteConnection: BetterSqlite3Db = new Proxy({} as BetterSqlite3Db, {
  get(_, prop, receiver) {
    const inner = ensureDb().sqlite as unknown as object;
    const value = Reflect.get(inner, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
}) as BetterSqlite3Db;

export { schema };
export type Db = DrizzleDb;
