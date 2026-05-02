import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type UserRow } from "@workspace/db";

export const SESSION_COOKIE = "derp_session";
const SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string): Promise<UserRow | null> {
  const rows = await db
    .select()
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  if (r.users.isActive === false) return null;
  return r.users;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    phone: u.phone ?? null,
    designation: u.designation ?? null,
    department: u.department ?? null,
    employeeCode: u.employeeCode ?? null,
    isActive: u.isActive,
    staffId: u.staffId ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
