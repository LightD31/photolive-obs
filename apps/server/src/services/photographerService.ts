import type { PhotographerDto, PhotographerWithSecretDto } from '@photolive/shared';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { photographers } from '../db/schema.js';
import { logger } from '../logger.js';
import { auditService } from './auditService.js';

function rowToDto(row: typeof photographers.$inferSelect): PhotographerDto {
  return {
    id: row.id,
    eventId: row.eventId,
    displayName: row.displayName,
    color: row.color,
    ftpUsername: row.ftpUsername,
    isActive: row.isActive,
  };
}

function generateFtpUsername(eventSlug: string, displayName: string): string {
  const cleanName =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 8) || 'shooter';
  const suffix = nanoid(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${eventSlug.replace(/[^a-z0-9]/g, '').slice(0, 12)}-${cleanName}-${suffix}`;
}

function generateFtpPassword(): string {
  // 16 chars, no ambiguous symbols (Sony's FTP setup UI gets cranky with some)
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export class PhotographerService {
  listForEvent(eventId: string): PhotographerDto[] {
    return db
      .select()
      .from(photographers)
      .where(eq(photographers.eventId, eventId))
      .all()
      .map(rowToDto);
  }

  listActiveForEvent(eventId: string): PhotographerDto[] {
    return db
      .select()
      .from(photographers)
      .where(and(eq(photographers.eventId, eventId), eq(photographers.isActive, true)))
      .all()
      .map(rowToDto);
  }

  get(id: string): PhotographerDto | null {
    const row = db.select().from(photographers).where(eq(photographers.id, id)).get();
    return row ? rowToDto(row) : null;
  }

  /** Verify a (username, password) pair and return the photographer if valid + active. */
  authenticateFtp(username: string, password: string): PhotographerDto | null {
    const row = db
      .select()
      .from(photographers)
      .where(and(eq(photographers.ftpUsername, username), eq(photographers.isActive, true)))
      .get();
    if (!row) return null;
    if (!bcrypt.compareSync(password, row.ftpPasswordHash)) return null;
    return rowToDto(row);
  }

  /** Create a new photographer and return DTO INCLUDING the plaintext FTP password (only time we ever expose it). */
  create(input: {
    eventId: string;
    eventSlug: string;
    displayName: string;
    color: string;
  }): PhotographerWithSecretDto {
    const id = nanoid();
    const ftpUsername = generateFtpUsername(input.eventSlug, input.displayName);
    const ftpPassword = generateFtpPassword();
    const ftpPasswordHash = bcrypt.hashSync(ftpPassword, 10);

    db.insert(photographers)
      .values({
        id,
        eventId: input.eventId,
        displayName: input.displayName,
        color: input.color,
        ftpUsername,
        ftpPasswordHash,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      .run();

    auditService.log({
      eventId: input.eventId,
      actor: 'operator',
      action: 'photographer.created',
      payload: { id, displayName: input.displayName, ftpUsername },
    });
    logger.info({ photographerId: id, ftpUsername }, 'photographer created');

    return {
      id,
      eventId: input.eventId,
      displayName: input.displayName,
      color: input.color,
      ftpUsername,
      ftpPassword,
      isActive: true,
    };
  }

  update(
    id: string,
    patch: Partial<{ displayName: string; color: string; isActive: boolean }>,
  ): PhotographerDto | null {
    const existing = db.select().from(photographers).where(eq(photographers.id, id)).get();
    if (!existing) return null;
    db.update(photographers).set(patch).where(eq(photographers.id, id)).run();
    auditService.log({
      eventId: existing.eventId,
      actor: 'operator',
      action: 'photographer.updated',
      payload: { id, patch },
    });
    return this.get(id);
  }

  rotatePassword(id: string): PhotographerWithSecretDto | null {
    const existing = db.select().from(photographers).where(eq(photographers.id, id)).get();
    if (!existing) return null;
    const ftpPassword = generateFtpPassword();
    const ftpPasswordHash = bcrypt.hashSync(ftpPassword, 10);
    db.update(photographers).set({ ftpPasswordHash }).where(eq(photographers.id, id)).run();
    auditService.log({
      eventId: existing.eventId,
      actor: 'operator',
      action: 'photographer.password.rotated',
      payload: { id },
    });
    return {
      ...rowToDto(existing),
      ftpPassword,
    };
  }

  delete(id: string): boolean {
    const existing = db.select().from(photographers).where(eq(photographers.id, id)).get();
    if (!existing) return false;
    db.delete(photographers).where(eq(photographers.id, id)).run();
    auditService.log({
      eventId: existing.eventId,
      actor: 'operator',
      action: 'photographer.deleted',
      payload: { id },
    });
    return true;
  }
}

export const photographerService = new PhotographerService();
