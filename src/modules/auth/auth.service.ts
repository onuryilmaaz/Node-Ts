import { db } from "../../db";
import { and, eq, gt, is, isNull, lt, ne } from "drizzle-orm";
import { hashPassword, comparePassword } from "../../utils/hash";
import { signAccessToken } from "../../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../../utils/token";
import { sessions, users, roles, userRoles, otps } from "../../db/schema";
import { generateOtp, hashOtp, otpExpiresAt } from "../../utils/otp";
import { verifyEmailTemplate } from "../../templates/verify-email.template";
import { sendEmail } from "../../services/email.service";
import { resetPasswordTemplate } from "../../templates/reset-password.template";
import { changeEmailTemplate } from "../../templates/change-email.template";

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existing.length > 0) throw new Error("EMAIL_EXISTS");

  const passwordHash = await hashPassword(data.password);

  const result = await db
    .insert(users)
    .values({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      authProvider: "local",
    })
    .returning();

  const user = result[0];

  if (!user) throw new Error("USER_CREATE_FAILED");

  const roleResult = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "user"))
    .limit(1);

  const role = roleResult[0];
  if (!role) throw new Error("DEFAULT_ROLE_NOT_FOUND");

  await db.insert(userRoles).values({
    userId: user.id,
    roleId: role.id,
  });

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await db
    .update(otps)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_verify"),
        isNull(otps.usedAt)
      )
    );

  await db.insert(otps).values({
    userId: user.id,
    otpHash,
    type: "email_verify",
    expiresAt: otpExpiresAt(10),
  });

  console.log(`EMAIL OTP for ${user.email}: ${otp}`);
  const tpl = verifyEmailTemplate({ otp, minutes: 10 });

  await sendEmail({
    to: user.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  return result[0];
}

export async function loginUser(data: {
  email: string;
  password: string;
  userAgent: string | null;
}) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  const user = result[0];
  console.log("USER FROM DB:", user);

  if (!user || !user.passwordHash) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DEACTIVATED");

  const ok = await import("../../utils/hash").then((m) =>
    m.comparePassword(data.password, user.passwordHash!)
  );
  console.log("COMPARE RESULT:", ok);

  if (!ok) throw new Error("INVALID_CREDENTIALS");

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const rolesNames = roleRows.map((r) => r.name);

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    roles: rolesNames,
    emailVerified: user.emailVerified ?? false,
    isActive: true,
  });

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const refreshExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 Gün

  await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash,
    expiresAt: refreshExpiresAt,
    ipAddress: null,
    userAgent: data.userAgent,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified ?? false,
      roles: rolesNames,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshSession(data: {
  refreshToken: string;
  userAgent: string | null;
}) {
  const hash = hashRefreshToken(data.refreshToken);

  const sessionResult = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, hash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  const session = sessionResult[0];
  if (!session) throw new Error("INVALID_REFRESH");
  if (session.userAgent !== data.userAgent) throw new Error("SESSION_MISMATCH");

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, session.id));

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("INVALID_REFRESH");

  const roles = await getUserRoles(user.id);

  const newAccessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    roles,
    emailVerified: user.emailVerified ?? false,
    isActive: true,
  });

  const newRefreshToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRefreshToken);

  await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash: newHash,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    userAgent: data.userAgent,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(sessions.refreshTokenHash, hash), isNull(sessions.revokedAt))
    );
}

async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return rows.map((r) => r.name);
}

export async function verifyEmailOtp(data: { email: string; code: string }) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("INVALID_CODE");

  const otpHash = hashOtp(data.code);

  const otpResult = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_verify"),
        eq(otps.otpHash, otpHash),
        isNull(otps.usedAt),
        gt(otps.expiresAt, new Date())
      )
    )
    .limit(1);

  const otp = otpResult[0];
  if (!otp) throw new Error("INVALID_CODE");

  await db.update(otps).set({ usedAt: new Date() }).where(eq(otps.id, otp.id));

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, user.id));

  return { success: true };
}

export async function resendEmailOtp(data: { email: string }) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  const user = userResult[0];
  if (!user) return;

  if (user.emailVerified) return;

  const recentOtp = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_verify"),
        isNull(otps.usedAt),
        gt(otps.createdAt, new Date(Date.now() - 60_000))
      )
    )
    .limit(1);

  if (recentOtp[0]) throw new Error("OTP_RATE_LIMIT");

  const todayCount = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_verify"),
        gt(otps.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    );

  if (todayCount.length >= 5) throw new Error("OTP_DAILY_LIMIT");

  await db
    .update(otps)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_verify"),
        isNull(otps.usedAt)
      )
    );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await db.insert(otps).values({
    userId: user.id,
    otpHash,
    type: "email_verify",
    expiresAt: otpExpiresAt(10),
  });

  console.log(`RESEND OTP for ${user.email}: ${otp}`);
  const tpl = verifyEmailTemplate({ otp, minutes: 10 });

  await sendEmail({
    to: user.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

export async function forgotPassword(data: { email: string }) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  const user = userResult[0];
  if (!user) return;

  const recent = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "password_reset"),
        isNull(otps.usedAt),
        gt(otps.createdAt, new Date(Date.now() - 60_000))
      )
    )
    .limit(1);

  if (recent[0]) throw new Error("OTP_RATE_LIMIT");

  const today = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "password_reset"),
        gt(otps.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    );

  if (today.length >= 5) throw new Error("OTP_DAILY_LIMIT");

  await db
    .update(otps)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "password_reset"),
        isNull(otps.usedAt)
      )
    );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await db.insert(otps).values({
    userId: user.id,
    otpHash,
    type: "password_reset",
    expiresAt: otpExpiresAt(10),
  });

  const tpl = resetPasswordTemplate({ otp, minutes: 10 });

  await sendEmail({
    to: user.email,
    subject: "Şifre sıfırlama kodunuz",
    html: tpl.html,
    text: tpl.text,
  });
}

export async function resetPassword(data: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("INVALID_OTP");

  const otpHash = hashOtp(data.otp);

  const otpResult = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "password_reset"),
        eq(otps.otpHash, otpHash),
        isNull(otps.usedAt),
        gt(otps.expiresAt, new Date())
      )
    )
    .limit(1);

  const otp = otpResult[0];
  if (!otp) throw new Error("INVALID_OTP");

  const newHash = await hashPassword(data.newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  await db.update(otps).set({ usedAt: new Date() }).where(eq(otps.id, otp.id));

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, user.id));

  return { success: true };
}

export async function requestChangeEmail(userId: string, newEmail: string) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);

  if (existing[0]) throw new Error("EMAIL_IN_USE");

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];
  if (!user) throw new Error("USER_NOT_FOUND");

  await db
    .update(otps)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(otps.userId, user.id),
        eq(otps.type, "email_change"),
        isNull(otps.usedAt)
      )
    );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await db.insert(otps).values({
    userId: user.id,
    otpHash,
    type: "email_change",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const tpl = changeEmailTemplate({ otp, minutes: 10 });

  await sendEmail({
    to: user.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

export async function confirmChangeEmail(
  userId: string,
  otpCode: string,
  newEmail: string
) {
  const otpHash = hashOtp(otpCode);

  const otpResult = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.userId, userId),
        eq(otps.type, "email_change"),
        eq(otps.otpHash, otpHash),
        isNull(otps.usedAt),
        gt(otps.expiresAt, new Date())
      )
    )
    .limit(1);

  const otp = otpResult[0];
  if (!otp) throw new Error("INVALID_OTP");

  await db.update(otps).set({ usedAt: new Date() }).where(eq(otps.id, otp.id));

  await db
    .update(users)
    .set({
      email: newEmail,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await revokeAllUserSessions(userId);
}

export async function revokeAllUserSessions(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function listUserSessions(userId: string) {
  return await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .orderBy(sessions.createdAt);
}

export async function revokeSession(userId: string, sessionId: string) {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    );

  if (result.rowCount === 0) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return { success: true };
}

export async function revokeOtherSessions(
  userId: string,
  currentRefreshToken: string
) {
  const currentHash = hashRefreshToken(currentRefreshToken);

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        ne(sessions.refreshTokenHash, currentHash)
      )
    );

  return { success: true };
}

export async function cleanupExpiredSessions() {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(lt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt)));
}
