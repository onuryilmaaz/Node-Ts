import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";

export async function adminListUsers() {
  return await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      authProvider: users.authProvider,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(users.createdAt);
}

export async function adminGetUserDetail(userId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = result[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

export async function adminActivateUser(userId: string) {
  const result = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");

  return { success: true };
}

export async function adminDeactivateUser(userId: string) {
  const result = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return { success: true, sessionsRevoked: true };
}

export async function adminListUserSessions(userId: string) {
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user[0]) throw new Error("USER_NOT_FOUND");

  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(sessions.createdAt);
}

export async function adminRevokeAllUserSessions(userId: string) {
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user[0]) throw new Error("USER_NOT_FOUND");

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return { success: true };
}
