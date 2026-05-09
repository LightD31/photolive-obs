import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { logger } from '../logger.js';
import { db } from './index.js';

logger.info('Running database migrations...');
migrate(db, { migrationsFolder: './drizzle' });
logger.info('Migrations complete.');
