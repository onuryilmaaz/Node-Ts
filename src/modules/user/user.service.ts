import { query } from "../../db";
import { comparePassword, hashPassword } from "../../utils/hash";
import cloudinary from "../../utils/cloudinary";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import type { UpdateProfileInput } from "./user.schema";

export async function getUserProfile(userId: string) {
  const userResult = await query(
    `
    SELECT
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

export async function changePassword(
  userId: string,
  data: {
    currentPassword: string;
    newPassword: string;
  },
) {
  const userResult = await query(
    'SELECT id, password_hash as "passwordHash" FROM app.users WHERE id = $1 LIMIT 1',
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.passwordHash) throw new Error("PASSWORD_NOT_SET");

  const isValid = await comparePassword(
    data.currentPassword,
    user.passwordHash,
  );
  if (!isValid) throw new Error("INVALID_CURRENT_PASSWORD");

  const sameAsOld = await comparePassword(data.newPassword, user.passwordHash);
  if (sameAsOld) throw new Error("PASSWORD_SAME_AS_OLD");

  const newHash = await hashPassword(data.newPassword);

  await query(
    "UPDATE app.users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [newHash, userId],
  );

  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );

  return { success: true, reloginRequired: true };
}

export async function updateUserProfile(
  userId: string,
  data: UpdateProfileInput,
) {
  const entries = Object.entries(data);
  if (entries.length === 0) throw new Error("NO_FIELDS_TO_UPDATE");

  const columnMapping: Record<string, string> = {
    firstName: "first_name",
    lastName: "last_name",
    phone: "phone",
  };

  const setClauses: string[] = [];
  const values: any[] = [];

  entries.forEach(([key, value], index) => {
    const colName = columnMapping[key] || key;
    setClauses.push(`${colName} = $${index + 1}`);
    values.push(value);
  });

  values.push(userId);
  const sql = `UPDATE app.users SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`;

  await query(sql, values);
}

export async function uploadAvatarService(
  userId: string,
  file: Express.Multer.File,
) {
  const userResult = await query(
    'SELECT avatar_public_id as "avatarPublicId" FROM app.users WHERE id = $1 LIMIT 1',
    [userId],
  );

  const oldAvatarPublicId = userResult.rows[0]?.avatarPublicId;

  const uploadResult = await uploadToCloudinary(file.buffer, "avatars");

  if (oldAvatarPublicId) {
    try {
      await cloudinary.uploader.destroy(oldAvatarPublicId);
    } catch (err) {
      console.error("Old avatar delete failed:", err);
    }
  }

  await query(
    "UPDATE app.users SET avatar_url = $1, avatar_public_id = $2, updated_at = NOW() WHERE id = $3",
    [uploadResult.url, uploadResult.publicId, userId],
  );

  return uploadResult.url;
}

export async function deactivateAccount(userId: string) {
  await query(
    "UPDATE app.users SET is_active = false, updated_at = NOW() WHERE id = $1",
    [userId],
  );

  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );

  return { success: true };
}
