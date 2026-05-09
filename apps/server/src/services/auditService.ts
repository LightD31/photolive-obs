import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  id: string;
  eventId: string | null;
  actor: string;
  action: string;
  payload: unknown;
  ts: string;
}

export class AuditService {
  log(input: { eventId?: string | null; actor: string; action: string; payload?: unknown }): void {
    db.insert(auditLog)
      .values({
        id: nanoid(),
        eventId: input.eventId ?? null,
        actor: input.actor,
        action: input.action,
        payload: input.payload === undefined ? null : JSON.stringify(input.payload),
        ts: new Date().toISOString(),
      })
      .run();
  }

  list(eventId: string, limit = 200): AuditEntry[] {
    const rows = db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, eventId))
      .orderBy(desc(auditLog.ts))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      actor: r.actor,
      action: r.action,
      payload: r.payload ? JSON.parse(r.payload) : null,
      ts: r.ts,
    }));
  }
}

export const auditService = new AuditService();
