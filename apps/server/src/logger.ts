import pino, { type Logger } from 'pino';
import { config } from './config.js';

let _logger: Logger | null = null;

function ensureLogger(): Logger {
  if (_logger) return _logger;
  _logger = pino({
    level: config.logLevel,
    ...(config.isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss.l' },
          },
        }
      : {}),
  });
  return _logger;
}

/** Eagerly construct the logger; call once at boot after setConfig. */
export function initLogger(): Logger {
  return ensureLogger();
}

/**
 * Backward-compat export. The Proxy delegates every read (and writes to
 * `level`) to the lazily-initialised pino instance, so the existing
 * `import { logger } from '../logger.js'` callers stay byte-identical.
 */
export const logger: Logger = new Proxy({} as Logger, {
  get(_, prop, receiver) {
    const inner = ensureLogger();
    const value = Reflect.get(inner, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
  set(_, prop, value, receiver) {
    return Reflect.set(ensureLogger(), prop, value, receiver);
  },
}) as Logger;

export type { Logger };
