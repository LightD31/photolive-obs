import { networkInterfaces } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

function isUsableHost(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v === '0.0.0.0' || v === '::' || v === '127.0.0.1' || v === '::1' || v === 'localhost') {
    return false;
  }
  return true;
}

function detectLanHost(): string | null {
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const info of list) {
      if (info.family !== 'IPv4' || info.internal) continue;
      return info.address;
    }
  }
  return null;
}

export async function networkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/network-info', async () => {
    const configured = isUsableHost(config.ftp.pasvUrl) ? config.ftp.pasvUrl : null;
    const ftpHost = configured ?? detectLanHost() ?? config.ftp.pasvUrl;
    return { ftpHost, ftpPort: config.ftp.port };
  });
}
