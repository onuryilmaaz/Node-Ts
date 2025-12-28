import { db } from "../../db";
import { and, eq, isNull } from "drizzle-orm";
import { users, roles, userRoles, sessions } from "../../db/schema";
import { comparePassword, hashPassword } from "../../utils/hash";
import { buildFileUrl, deleteLocalFile } from "../../services/file.service";
import type { UpdateProfileInput } from "./user.schema";
import cloudinary from "../../utils/cloudinary";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

export async function getUserProfile(userId: string) {
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

export async function changePassword(
  userId: string,
  data: {
    currentPassword: string;
    newPassword: string;
  }
) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.passwordHash) throw new Error("PASSWORD_NOT_SET");

  const isValid = await comparePassword(
    data.currentPassword,
    user.passwordHash
  );
  if (!isValid) throw new Error("INVALID_CURRENT_PASSWORD");

  const sameAsOld = await comparePassword(data.newPassword, user.passwordHash);
  if (sameAsOld) throw new Error("PASSWORD_SAME_AS_OLD");

  const newHash = await hashPassword(data.newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return { success: true, reloginRequired: true };
}

export async function updateUserProfile(
  userId: string,
  data: UpdateProfileInput
) {
  if (Object.keys(data).length === 0) throw new Error("NO_FIELDS_TO_UPDATE");

  await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function uploadAvatarService(
  userId: string,
  file: Express.Multer.File
) {
  // Kullanıcıyı al
  const userResult = await db
    .select({
      avatarPublicId: users.avatarPublicId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const oldAvatarPublicId = userResult[0]?.avatarPublicId;

  // Cloudinary upload
  const uploadResult = await uploadToCloudinary(file.buffer, "avatars");

  // Eski avatar varsa sil
  if (oldAvatarPublicId) {
    await cloudinary.uploader.destroy(oldAvatarPublicId);
  }

  // DB update
  await db
    .update(users)
    .set({
      avatarUrl: uploadResult.url,
      avatarPublicId: uploadResult.publicId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return uploadResult.url;
}

export async function deactivateAccount(userId: string) {
  await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return { success: true };
}
