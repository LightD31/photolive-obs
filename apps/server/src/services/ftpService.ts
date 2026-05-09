import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { eventService } from './eventService.js';
import { photographerService } from './photographerService.js';
import { wsService } from './wsService.js';

// ftp-srv ships CJS-style `export = FtpSrv` which doesn't play nicely with our
// ESM + verbatimModuleSyntax setup. Use createRequire to load it as a value.
const require = createRequire(import.meta.url);
const FtpSrv = require('ftp-srv') as new (
  opts: Record<string, unknown>,
) => {
  on(event: string, handler: (...args: unknown[]) => void): void;
  listen(): Promise<void>;
  close(): Promise<void>;
};
type FtpServerInstance = InstanceType<typeof FtpSrv>;

/**
 * Multi-user FTP server. Each photographer's A7IV authenticates with their
 * issued username/password and is chroot-ed to `<photosDir>/<ftpUsername>/`.
 *
 * We don't hook STOR completion here — the file watcher service covers all
 * arrival paths uniformly (FTP, manual drops, future ingest sources) and
 * attributes images to the correct photographer based on their path.
 */
interface FtpLoginData {
  username: string;
  password: string;
}
interface FtpClientError {
  context: unknown;
  error: NodeJS.ErrnoException;
}
type FtpResolve = (info: { root: string; cwd: string }) => void;
type FtpReject = (err: Error) => void;

export class FtpService {
  private server: FtpServerInstance | null = null;
  private activeConnections = 0;
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    const url = `ftp://${config.ftp.host}:${config.ftp.port}`;
    const server = new FtpSrv({
      url,
      anonymous: false,
      pasv_url: config.ftp.pasvUrl,
      pasv_min: config.ftp.pasvMin,
      pasv_max: config.ftp.pasvMax,
      greeting: ['PhotoLive FTP. Use your photographer credentials.'],
    });

    server.on('login', async (...args: unknown[]) => {
      const { username, password } = args[0] as FtpLoginData;
      const resolveFn = args[1] as FtpResolve;
      const rejectFn = args[2] as FtpReject;

      const photographer = photographerService.authenticateFtp(username, password);
      if (!photographer) {
        logger.warn({ username }, 'ftp login rejected: bad credentials');
        rejectFn(new Error('Invalid credentials'));
        return;
      }

      const activeEvent = eventService.getActive();
      if (!activeEvent) {
        rejectFn(new Error('No active event'));
        return;
      }
      if (photographer.eventId !== activeEvent.id) {
        rejectFn(new Error('Photographer not assigned to active event'));
        return;
      }

      const root = resolve(activeEvent.photosDir, photographer.ftpUsername);
      await mkdir(root, { recursive: true });

      this.activeConnections++;
      this.broadcastStatus();
      logger.info({ ftpUsername: photographer.ftpUsername, root }, 'ftp login ok');
      resolveFn({ root, cwd: '/' });
    });

    server.on('disconnect', () => {
      this.activeConnections = Math.max(0, this.activeConnections - 1);
      this.broadcastStatus();
    });

    server.on('client-error', (...args: unknown[]) => {
      const { context, error } = args[0] as FtpClientError;
      const code = error?.code;
      if (code !== 'ECONNRESET' && code !== 'EPIPE') {
        logger.warn({ err: error, context }, 'ftp client-error');
      }
    });

    await server.listen();
    this.server = server;
    this.running = true;
    this.broadcastStatus();
    logger.info({ url }, 'ftp server listening');
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    this.running = false;
    this.activeConnections = 0;
    this.broadcastStatus();
    logger.info('ftp server stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private broadcastStatus(): void {
    wsService.broadcast('ftp.status', {
      running: this.running,
      activeConnections: this.activeConnections,
      totalUploads: 0, // see images table for authoritative counts
    });
  }
}

export const ftpService = new FtpService();
