import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
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

export type Logger = typeof logger;
