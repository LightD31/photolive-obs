import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database, { type Database as BetterSqlite3Db } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

const sqlite: BetterSqlite3Db = new Database(config.databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });
export const sqliteConnection: BetterSqlite3Db = sqlite;
export { schema };
export type Db = typeof db;
