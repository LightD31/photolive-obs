import type { SettingsDto } from '@photolive/shared';
import { DEFAULT_SETTINGS } from '@photolive/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { auditService } from './auditService.js';

const SETTINGS_KEY = 'slideshow';

export class SettingsService {
  getForEvent(eventId: string): SettingsDto {
    const row = db
      .select()
      .from(settings)
      .where(and(eq(settings.eventId, eventId), eq(settings.key, SETTINGS_KEY)))
      .get();
    if (!row) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<SettingsDto>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  updateForEvent(eventId: string, patch: Partial<SettingsDto>): SettingsDto {
    const current = this.getForEvent(eventId);
    const next: SettingsDto = { ...current, ...patch };
    const value = JSON.stringify(next);
    const existing = db
      .select()
      .from(settings)
      .where(and(eq(settings.eventId, eventId), eq(settings.key, SETTINGS_KEY)))
      .get();
    if (existing) {
      db.update(settings)
        .set({ value })
        .where(and(eq(settings.eventId, eventId), eq(settings.key, SETTINGS_KEY)))
        .run();
    } else {
      db.insert(settings).values({ eventId, key: SETTINGS_KEY, value }).run();
    }
    auditService.log({
      eventId,
      actor: 'operator',
      action: 'settings.updated',
      payload: patch,
    });
    return next;
  }
}

export const settingsService = new SettingsService();
