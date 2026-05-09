import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { fileWatcherService } from './services/fileWatcherService.js';
import { ftpService } from './services/ftpService.js';
import { ingestService } from './services/ingestService.js';
import { obsService } from './services/obsService.js';
import { slideshowService } from './services/slideshowService.js';

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port, host: config.host }, 'http server listening');

  // Start subsystems. None of these should crash the server if they fail —
  // they degrade gracefully instead.
  try {
    await ftpService.start();
  } catch (err) {
    logger.error({ err }, 'failed to start ftp server');
  }

  try {
    await fileWatcherService.watchActiveEvent();
  } catch (err) {
    logger.error({ err }, 'failed to start file watcher');
  }

  try {
    await obsService.connect();
  } catch (err) {
    logger.error({ err }, 'failed to connect to obs');
  }

  // Initial slideshow state from DB
  slideshowService.reload();

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    try {
      await fileWatcherService.stop();
      await ftpService.stop();
      await obsService.disconnect();
      slideshowService.shutdown();
      await ingestService.shutdown();
      await app.close();
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
