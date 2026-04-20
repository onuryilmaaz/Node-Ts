import { query } from "../../db";
import { hashPassword } from "../../utils/hash";
import { signAccessToken } from "../../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../../utils/token";
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
  const existing = await query(
    "SELECT id FROM app.users WHERE email = $1 LIMIT 1",
    [data.email],
  );

  if (existing.rowCount && existing.rowCount > 0)
    throw new Error("EMAIL_EXISTS");

  const passwordHash = await hashPassword(data.password);

  const result = await query(
    `
    INSERT INTO app.users (email, first_name, last_name, password_hash, auth_provider) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING id, email, first_name AS "firstName", last_name AS "lastName", email_verified AS "emailVerified"
    `,
    [data.email, data.firstName, data.lastName, passwordHash, "local"],
  );

  const user = result.rows[0];

  if (!user) throw new Error("USER_CREATE_FAILED");

  const roleResult = await query(
    "SELECT id FROM app.roles WHERE name = $1 LIMIT 1",
    ["user"],
  );

  const role = roleResult.rows[0];
  if (!role) throw new Error("DEFAULT_ROLE_NOT_FOUND");

  await query("INSERT INTO app.user_roles (user_id, role_id) VALUES ($1, $2)", [
    user.id,
    role.id,
  ]);

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await query(
    "UPDATE app.otps SET used_at = NOW() WHERE user_id = $1 AND type = $2 AND used_at IS NULL",
    [user.id, "email_verify"],
  );

  await query(
    "INSERT INTO app.otps (user_id, otp_hash, type, expires_at) VALUES ($1, $2, $3, $4)",
    [user.id, otpHash, "email_verify", otpExpiresAt(10)],
  );

  console.log(`EMAIL OTP for ${user.email}: ${otp}`);
  const tpl = verifyEmailTemplate({ otp, minutes: 10 });

  try {
    await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
  } catch (emailErr: any) {
    console.error(
      "[REGISTER] Email gönderilemedi, ama kayıt tamamlandı:",
      emailErr.message,
    );
  }

  return user;
}

export async function loginUser(data: {
  email: string;
  password: string;
  userAgent: string | null;
}) {
  const result = await query(
    `SELECT id, email, password_hash as "passwordHash", is_active as "isActive", email_verified as "emailVerified" 
     FROM app.users WHERE email = $1 LIMIT 1`,
    [data.email],
  );

  const user = result.rows[0];
  console.log("USER FROM DB:", user);

  if (!user || !user.passwordHash) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DEACTIVATED");

  const ok = await import("../../utils/hash").then((m) =>
    m.comparePassword(data.password, user.passwordHash!),
  );
  console.log("COMPARE RESULT:", ok);

  if (!ok) throw new Error("INVALID_CREDENTIALS");

  const roleRows = await query(
    "SELECT r.name FROM app.user_roles ur INNER JOIN app.roles r ON ur.role_id = r.id WHERE ur.user_id = $1",
    [user.id],
  );

  const rolesNames = roleRows.rows.map((r: any) => r.name);

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    roles: rolesNames,
    emailVerified: user.emailVerified ?? false,
    isActive: true,
  });

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const refreshExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await query(
    "INSERT INTO app.sessions (user_id, refresh_token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4)",
    [user.id, refreshTokenHash, refreshExpiresAt, data.userAgent],
  );

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

  const sessionResult = await query(
    'SELECT id, user_id as "userId" FROM app.sessions WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1',
    [hash],
  );

  const session = sessionResult.rows[0];
  if (!session) throw new Error("INVALID_REFRESH");

  await query("UPDATE app.sessions SET revoked_at = NOW() WHERE id = $1", [
    session.id,
  ]);

  const userResult = await query(
    'SELECT id, email, email_verified as "emailVerified" FROM app.users WHERE id = $1 LIMIT 1',
    [session.userId],
  );

  const user = userResult.rows[0];
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

  await query(
    "INSERT INTO app.sessions (user_id, refresh_token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4)",
    [
      user.id,
      newHash,
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      data.userAgent,
    ],
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);

  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1 AND revoked_at IS NULL",
    [hash],
  );
}

async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await query(
    "SELECT r.name FROM app.user_roles ur INNER JOIN app.roles r ON ur.role_id = r.id WHERE ur.user_id = $1",
    [userId],
  );

  return rows.rows.map((r: any) => r.name);
}

export async function verifyEmailOtp(data: { email: string; code: string }) {
  const userResult = await query(
    "SELECT id FROM app.users WHERE email = $1 LIMIT 1",
    [data.email],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("INVALID_CODE");

  const otpHash = hashOtp(data.code);

  const otpResult = await query(
    `SELECT id FROM app.otps 
     WHERE user_id = $1 AND type = $2 AND otp_hash = $3 AND used_at IS NULL AND expires_at > NOW() 
     LIMIT 1`,
    [user.id, "email_verify", otpHash],
  );

  const otp = otpResult.rows[0];
  if (!otp) throw new Error("INVALID_CODE");

  await query("UPDATE app.otps SET used_at = NOW() WHERE id = $1", [otp.id]);

  await query("UPDATE app.users SET email_verified = true WHERE id = $1", [
    user.id,
  ]);

  return { success: true };
}

export async function resendEmailOtp(data: { email: string }) {
  const userResult = await query(
    'SELECT id, email, email_verified as "emailVerified" FROM app.users WHERE email = $1 LIMIT 1',
    [data.email],
  );

  const user = userResult.rows[0];
  if (!user) return;

  if (user.emailVerified) return;

  const recentOtp = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND used_at IS NULL AND created_at > NOW() - INTERVAL '1 minute' LIMIT 1",
    [user.id, "email_verify"],
  );

  if (recentOtp.rowCount && recentOtp.rowCount > 0)
    throw new Error("OTP_RATE_LIMIT");

  const todayCount = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 day'",
    [user.id, "email_verify"],
  );

  if (todayCount.rowCount && todayCount.rowCount >= 5)
    throw new Error("OTP_DAILY_LIMIT");

  await query(
    "UPDATE app.otps SET used_at = NOW() WHERE user_id = $1 AND type = $2 AND used_at IS NULL",
    [user.id, "email_verify"],
  );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await query(
    "INSERT INTO app.otps (user_id, otp_hash, type, expires_at) VALUES ($1, $2, $3, $4)",
    [user.id, otpHash, "email_verify", otpExpiresAt(10)],
  );

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
  const userResult = await query(
    "SELECT id, email FROM app.users WHERE email = $1 LIMIT 1",
    [data.email],
  );

  const user = userResult.rows[0];
  if (!user) return;

  const recent = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND used_at IS NULL AND created_at > NOW() - INTERVAL '1 minute' LIMIT 1",
    [user.id, "password_reset"],
  );

  if (recent.rowCount && recent.rowCount > 0) throw new Error("OTP_RATE_LIMIT");

  const today = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 day'",
    [user.id, "password_reset"],
  );

  if (today.rowCount && today.rowCount >= 5) throw new Error("OTP_DAILY_LIMIT");

  await query(
    "UPDATE app.otps SET used_at = NOW() WHERE user_id = $1 AND type = $2 AND used_at IS NULL",
    [user.id, "password_reset"],
  );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await query(
    "INSERT INTO app.otps (user_id, otp_hash, type, expires_at) VALUES ($1, $2, $3, $4)",
    [user.id, otpHash, "password_reset", otpExpiresAt(10)],
  );

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
  const userResult = await query(
    "SELECT id FROM app.users WHERE email = $1 LIMIT 1",
    [data.email],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("INVALID_OTP");

  const otpHash = hashOtp(data.otp);

  const otpResult = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND otp_hash = $3 AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
    [user.id, "password_reset", otpHash],
  );

  const otp = otpResult.rows[0];
  if (!otp) throw new Error("INVALID_OTP");

  const newHash = await hashPassword(data.newPassword);

  await query("UPDATE app.users SET password_hash = $1 WHERE id = $2", [
    newHash,
    user.id,
  ]);

  await query("UPDATE app.otps SET used_at = NOW() WHERE id = $1", [otp.id]);

  await query("UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1", [
    user.id,
  ]);

  return { success: true };
}

export async function requestChangeEmail(userId: string, newEmail: string) {
  const existing = await query(
    "SELECT id FROM app.users WHERE email = $1 LIMIT 1",
    [newEmail],
  );

  if (existing.rowCount && existing.rowCount > 0)
    throw new Error("EMAIL_IN_USE");

  const userResult = await query(
    "SELECT id, email FROM app.users WHERE id = $1 LIMIT 1",
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");

  await query(
    "UPDATE app.otps SET used_at = NOW() WHERE user_id = $1 AND type = $2 AND used_at IS NULL",
    [user.id, "email_change"],
  );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await query(
    "INSERT INTO app.otps (user_id, otp_hash, type, expires_at) VALUES ($1, $2, $3, $4)",
    [user.id, otpHash, "email_change", new Date(Date.now() + 10 * 60 * 1000)],
  );

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
  newEmail: string,
) {
  const otpHash = hashOtp(otpCode);

  const otpResult = await query(
    "SELECT id FROM app.otps WHERE user_id = $1 AND type = $2 AND otp_hash = $3 AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
    [userId, "email_change", otpHash],
  );

  const otp = otpResult.rows[0];
  if (!otp) throw new Error("INVALID_OTP");

  await query("UPDATE app.otps SET used_at = NOW() WHERE id = $1", [otp.id]);

  await query(
    "UPDATE app.users SET email = $1, email_verified = true, updated_at = NOW() WHERE id = $2",
    [newEmail, userId],
  );

  await revokeAllUserSessions(userId);
}

export async function revokeAllUserSessions(userId: string) {
  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
}

export async function listUserSessions(userId: string) {
  const result = await query(
    `SELECT id, created_at as "createdAt", expires_at as "expiresAt", user_agent as "userAgent", revoked_at as "revokedAt" 
     FROM app.sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at`,
    [userId],
  );
  return result.rows;
}

export async function revokeSession(userId: string, sessionId: string) {
  const result = await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [sessionId, userId],
  );

  if (result.rowCount === 0) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return { success: true };
}

export async function revokeOtherSessions(
  userId: string,
  currentRefreshToken: string,
) {
  const currentHash = hashRefreshToken(currentRefreshToken);

  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL AND refresh_token_hash != $2",
    [userId, currentHash],
  );

  return { success: true };
}

export async function cleanupExpiredSessions() {
  await query(
    "UPDATE app.sessions SET revoked_at = NOW() WHERE expires_at < NOW() AND revoked_at IS NULL",
  );
}
