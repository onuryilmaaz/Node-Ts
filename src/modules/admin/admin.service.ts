import { query } from "../../db";

export async function adminListUsers() {
  const result = await query(
    `
    SELECT
      u.id AS "userId",
      u.email,
      u.email_verified AS "emailVerified",
      u.first_name AS "firstName",
      u.last_name AS "lastName",
      u.phone,
      u.avatar_url AS "avatarUrl",
      u.auth_provider AS "authProvider",
      u.provider_id AS "providerId",
      u.is_active AS "isActive",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      r.name AS "role"
    FROM app.users u
    LEFT JOIN app.user_roles ur 
      ON u.id = ur.user_id
    LEFT JOIN app.roles r 
      ON ur.role_id = r.id
    ORDER BY u.created_at
    `,
  );

  const usersMap = new Map<string, any>();

  for (const row of result.rows) {
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
  const userResult = await query(
    `SELECT
      id,
      email,
      email_verified AS "emailVerified",
      first_name AS "firstName",
      last_name AS "lastName",
      phone,
      avatar_url AS "avatarUrl",
      auth_provider AS "authProvider",
      provider_id AS "providerId",
      is_active AS "isActive",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM app.users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");

  const roleRows = await query(
    "SELECT r.name FROM app.user_roles ur INNER JOIN app.roles r ON ur.role_id = r.id WHERE ur.user_id = $1",
    [userId],
  );

  return {
    ...user,
    roles: roleRows.rows.map((r: any) => r.name),
  };
}

export async function adminActivateUser(userId: string) {
  const result = await query(
    `
    UPDATE app.users
    SET is_active = TRUE, updated_at = NOW()
    WHERE id = $1
    `,
    [userId],
  );

  if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");

  return { success: true };
}

export async function adminDeactivateUser(userId: string) {
  const result = await query(
    `
    UPDATE app.users
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1
    `,
    [userId],
  );

  if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");

  await query(
    "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );

  return { success: true, sessionsRevoked: true };
}

export async function adminListUserSessions(userId: string) {
  const user = await query("SELECT id FROM app.users WHERE id = $1 LIMIT 1", [
    userId,
  ]);
  if (!user.rowCount) throw new Error("USER_NOT_FOUND");

  const result = await query(
    `
    SELECT
      id,
      user_agent AS "userAgent",
      created_at AS "createdAt",
      expires_at AS "expiresAt",
      revoked_at AS "revokedAt"
    FROM app.sessions
    WHERE user_id = $1
    ORDER BY created_at
    `,
    [userId],
  );
  return result.rows;
}

export async function adminRevokeAllUserSessions(userId: string) {
  const user = await query("SELECT id FROM app.users WHERE id = $1 LIMIT 1", [
    userId,
  ]);
  if (!user.rowCount) throw new Error("USER_NOT_FOUND");

  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );

  return { success: true };
}

export async function getAllRoles() {
  const result = await query("SELECT id, name FROM app.roles ORDER BY name");
  return result.rows;
}

export async function createRole(name: string) {
  const existing = await query("SELECT id FROM app.roles WHERE name = $1 LIMIT 1", [
    name,
  ]);

  if (existing.rowCount && existing.rowCount > 0)
    throw new Error("ROLE_EXISTS");

  const result = await query(
    "INSERT INTO app.roles (name) VALUES ($1) RETURNING id, name",
    [name],
  );

  return result.rows[0];
}

export async function updateRoleById(roleId: string, name: string) {
  const roleResult = await query(
    "SELECT id, name FROM app.roles WHERE id = $1 LIMIT 1",
    [roleId],
  );

  const role = roleResult.rows[0];
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.name === "admin") throw new Error("ROLE_PROTECTED");

  const nameExists = await query(
    "SELECT id FROM app.roles WHERE name = $1 AND id != $2 LIMIT 1",
    [name, roleId],
  );

  if (nameExists.rowCount && nameExists.rowCount > 0)
    throw new Error("ROLE_EXISTS");

  const updated = await query(
    "UPDATE app.roles SET name = $1 WHERE id = $2 RETURNING id, name",
    [name, roleId],
  );

  return updated.rows[0];
}

export async function deleteRoleById(roleId: string) {
  const existing = await query(
    "SELECT id, name FROM app.roles WHERE id = $1 LIMIT 1",
    [roleId],
  );

  const role = existing.rows[0];
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.name === "admin") throw new Error("ROLE_PROTECTED");

  const usage = await query(
    "SELECT user_id FROM app.user_roles WHERE role_id = $1 LIMIT 1",
    [roleId],
  );

  if (usage.rowCount && usage.rowCount > 0) throw new Error("ROLE_IN_USE");

  await query("DELETE FROM app.roles WHERE id = $1", [roleId]);
}

export async function assignRoleToUser(userId: string, roleId: string) {
  const userResult = await query(
    'SELECT id, is_active as "isActive" FROM app.users WHERE id = $1 LIMIT 1',
    [userId],
  );
  const user = userResult.rows[0];

  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.isActive) throw new Error("USER_INACTIVE");

  const roleResult = await query("SELECT id FROM app.roles WHERE id = $1 LIMIT 1", [
    roleId,
  ]);
  const role = roleResult.rows[0];

  if (!role) throw new Error("ROLE_NOT_FOUND");

  const existing = await query(
    "SELECT role_id FROM app.user_roles WHERE user_id = $1 AND role_id = $2 LIMIT 1",
    [userId, roleId],
  );

  if (existing.rowCount && existing.rowCount > 0)
    throw new Error("ROLE_ALREADY_ASSIGNED");

  await query("INSERT INTO app.user_roles (user_id, role_id) VALUES ($1, $2)", [
    userId,
    roleId,
  ]);

  return { success: true };
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  const roleResult = await query(
    "SELECT id, name FROM app.roles WHERE id = $1 LIMIT 1",
    [roleId],
  );
  const role = roleResult.rows[0];

  if (!role) throw new Error("ROLE_NOT_FOUND");

  if (role.name === "admin") {
    throw new Error("ROLE_PROTECTED");
  }

  const result = await query(
    "DELETE FROM app.user_roles WHERE user_id = $1 AND role_id = $2",
    [userId, roleId],
  );

  if (result.rowCount === 0) {
    throw new Error("ROLE_NOT_ASSIGNED");
  }

  return { success: true };
}

export async function adminDashboardStats() {
  const queries = [
    query("SELECT COUNT(*) FROM app.users"),
    query("SELECT COUNT(*) FROM app.users WHERE is_active = true"),
    query("SELECT COUNT(*) FROM app.users WHERE is_active = false"),
    query("SELECT COUNT(*) FROM app.users WHERE email_verified = true"),
    query(
      "SELECT COUNT(*) FROM app.users WHERE created_at > NOW() - INTERVAL '24 hours'",
    ),
    query("SELECT COUNT(*) FROM app.sessions WHERE revoked_at IS NULL"),
  ];

  const results = await Promise.all(queries);

  return {
    users: {
      total: parseInt(results[0]?.rows[0].count || "0"),
      active: parseInt(results[1]?.rows[0].count || "0"),
      inactive: parseInt(results[2]?.rows[0].count || "0"),
      emailVerified: parseInt(results[3]?.rows[0].count || "0"),
      last24h: parseInt(results[4]?.rows[0].count || "0"),
    },
    sessions: {
      active: parseInt(results[5]?.rows[0].count || "0"),
    },
  };
}
