import { randomBytes } from 'node:crypto';
import type { UserDto } from '@photolive/shared';
import { eq, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { userService } from './userService.js';

/** Operator sessions live 30 days; each validation slides the window forward. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class SessionService {
  /** Mint a new session for `userId`; the returned id is the cookie value. */
  create(userId: string): { id: string; expiresAt: Date } {
    const id = randomBytes(32).toString('base64url');
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_TTL_MS);
    const nowIso = new Date(now).toISOString();
    db.insert(sessions)
      .values({
        id,
        userId,
        createdAt: nowIso,
        expiresAt: expiresAt.toISOString(),
        lastSeenAt: nowIso,
      })
      .run();
    return { id, expiresAt };
  }

  /** Resolve a cookie value to its user, or null if missing/expired/orphaned. */
  validate(id: string | undefined | null): UserDto | null {
    if (!id) return null;
    const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!row) return null;
    if (Date.parse(row.expiresAt) <= Date.now()) {
      db.delete(sessions).where(eq(sessions.id, id)).run();
      return null;
    }
    const user = userService.getById(row.userId);
    if (!user) {
      // User deleted out from under the session — treat as revoked.
      db.delete(sessions).where(eq(sessions.id, id)).run();
      return null;
    }
    // Sliding expiry: bump last-seen and push the window out.
    const now = Date.now();
    db.update(sessions)
      .set({
        lastSeenAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      })
      .where(eq(sessions.id, id))
      .run();
    return user;
  }

  revoke(id: string | undefined | null): void {
    if (!id) return;
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  /** Drop sessions past their expiry. Called at boot. */
  sweepExpired(): void {
    db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
  }
}

export const sessionService = new SessionService();
export { SESSION_TTL_MS };
