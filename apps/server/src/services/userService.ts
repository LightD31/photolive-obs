import type { UserDto, UserRole } from '@photolive/shared';
import bcrypt from 'bcryptjs';
import { asc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { type UserRow, users } from '../db/schema.js';

function rowToDto(row: UserRow): UserDto {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt,
  };
}

/** Usernames are matched case-insensitively; store + look up lowercased. */
function normalize(username: string): string {
  return username.trim().toLowerCase();
}

class UserService {
  /** Number of operator accounts. 0 ⇒ first-run setup required. */
  count(): number {
    const row = db.select({ value: sql<number>`count(*)` }).from(users).get();
    return Number(row?.value ?? 0);
  }

  getById(id: string): UserDto | null {
    const row = db.select().from(users).where(eq(users.id, id)).get();
    return row ? rowToDto(row) : null;
  }

  /**
   * The "owner" account the desktop app auto-logs-in as: the earliest-created
   * admin. With the current single-admin model this is unambiguous; ordering by
   * id breaks ties when several rows share a second-granularity createdAt.
   */
  getOwner(): UserDto | null {
    const row = db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)).limit(1).get();
    return row ? rowToDto(row) : null;
  }

  create(input: { username: string; password: string; role?: UserRole }): UserDto {
    const id = nanoid();
    const username = normalize(input.username);
    const passwordHash = bcrypt.hashSync(input.password, 10);
    db.insert(users)
      .values({ id, username, passwordHash, role: input.role ?? 'admin' })
      .run();
    const row = db.select().from(users).where(eq(users.id, id)).get();
    if (!row) throw new Error('user insert failed');
    return rowToDto(row);
  }

  /** Verify a (username, password) pair; returns the user when valid. */
  verify(username: string, password: string): UserDto | null {
    const row = db
      .select()
      .from(users)
      .where(eq(users.username, normalize(username)))
      .get();
    if (!row) return null;
    if (!bcrypt.compareSync(password, row.passwordHash)) return null;
    return rowToDto(row);
  }
}

export const userService = new UserService();
