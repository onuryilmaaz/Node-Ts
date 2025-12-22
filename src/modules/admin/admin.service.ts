import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../db";
import { roles, sessions, userRoles, users } from "../../db/schema";

export async function adminListUsers() {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      authProvider: users.authProvider,
      providerId: users.providerId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      role: roles.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(users.createdAt);

  const usersMap = new Map<string, any>();

  for (const row of rows) {
    if (!usersMap.has(row.userId)) {
      usersMap.set(row.userId, {
        id: row.userId,
        email: row.email,
        emailVerified: row.emailVerified,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        avatarUrl: row.avatarUrl,
        isActive: row.isActive,
        authProvider: row.authProvider,
        providerId: row.providerId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        roles: [],
      });
    }

    if (row.role) {
      usersMap.get(row.userId).roles.push(row.role);
    }
  }

  return Array.from(usersMap.values());
}

export async function adminGetUserDetail(userId: string) {
  const userResult = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      authProvider: users.authProvider,
      providerId: users.providerId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("USER_NOT_FOUND");

  const roleRows = await db
    .select({
      name: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return {
    ...user,
    roles: roleRows.map((r) => r.name),
  };
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

export async function getAllRoles() {
  return await db
    .select({
      id: roles.id,
      name: roles.name,
    })
    .from(roles)
    .orderBy(roles.name);
}

export async function createRole(name: string) {
  const existing = await db
    .select()
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (existing[0]) throw new Error("ROLE_EXISTS");

  const result = await db.insert(roles).values({ name }).returning();

  return result[0];
}

export async function updateRoleById(roleId: string, name: string) {
  const roleResult = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  const role = roleResult[0];
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.name === "admin") throw new Error("ROLE_PROTECTED");

  const nameExists = await db
    .select()
    .from(roles)
    .where(and(eq(roles.name, name), ne(roles.id, roleId)))
    .limit(1);

  if (nameExists[0]) throw new Error("ROLE_EXISTS");

  const updated = await db
    .update(roles)
    .set({ name })
    .where(eq(roles.id, roleId))
    .returning();

  return updated[0];
}

export async function deleteRoleById(roleId: string) {
  const existing = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  const role = existing[0];
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.name === "admin") throw new Error("ROLE_PROTECTED");

  const usage = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId))
    .limit(1);

  if (usage[0]) throw new Error("ROLE_IN_USE");

  await db.delete(roles).where(eq(roles.id, roleId));
}

export async function assignRoleToUser(userId: string, roleId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((r) => r[0]);

  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.isActive) throw new Error("USER_INACTIVE");

  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .then((r) => r[0]);

  if (!role) throw new Error("ROLE_NOT_FOUND");

  const existing = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
    .limit(1);

  if (existing[0]) throw new Error("ROLE_ALREADY_ASSIGNED");

  await db.insert(userRoles).values({
    userId,
    roleId,
  });

  return { success: true };
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .then((r) => r[0]);

  if (!role) throw new Error("ROLE_NOT_FOUND");

  if (role.name === "admin") {
    throw new Error("ROLE_PROTECTED");
  }

  const result = await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

  if (result.rowCount === 0) {
    throw new Error("ROLE_NOT_ASSIGNED");
  }

  return { success: true };
}
