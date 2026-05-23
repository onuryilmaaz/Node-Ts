import Expo from "expo-server-sdk";
import type { ExpoPushMessage } from "expo-server-sdk";
import { query } from "../db";

const expo = new Expo();

export async function getUserPushToken(userId: string): Promise<string | null> {
  const res = await query(
    `SELECT expo_push_token FROM app.users WHERE id = $1`,
    [userId],
  );
  return res.rows[0]?.expo_push_token ?? null;
}

export async function getGroupMemberTokens(
  groupId: string,
  excludeUserId?: string,
): Promise<{ userId: string; token: string }[]> {
  const res = await query(
    `SELECT u.id AS user_id, u.expo_push_token
     FROM app.group_members gm
     JOIN app.users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
       AND u.expo_push_token IS NOT NULL
       ${excludeUserId ? "AND gm.user_id != $2" : ""}`,
    excludeUserId ? [groupId, excludeUserId] : [groupId],
  );
  return res.rows.map((r) => ({ userId: r.user_id, token: r.expo_push_token }));
}

export async function getGroupAdminTokens(
  groupId: string,
): Promise<{ userId: string; token: string }[]> {
  const res = await query(
    `SELECT u.id AS user_id, u.expo_push_token
     FROM app.group_members gm
     JOIN app.users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
       AND gm.role IN ('owner', 'moderator')
       AND u.expo_push_token IS NOT NULL`,
    [groupId],
  );
  return res.rows.map((r) => ({ userId: r.user_id, token: r.expo_push_token }));
}

export async function sendPushNotifications(messages: ExpoPushMessage[]) {
  const valid = messages.filter((m) =>
    typeof m.to === "string" && Expo.isExpoPushToken(m.to),
  );
  if (!valid.length) return;

  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("push send error:", err);
    }
  }
}

// ── Notification helpers ───────────────────────────────────────────────────────

export async function notifyGroupJoin(
  groupId: string,
  groupName: string,
  joinerName: string,
  joinerId: string,
) {
  const recipients = await getGroupAdminTokens(groupId);
  const filtered = recipients.filter((r) => r.userId !== joinerId);
  if (!filtered.length) return;

  await sendPushNotifications(
    filtered.map((r) => ({
      to: r.token,
      title: groupName,
      body: `${joinerName} gruba katıldı 🎉`,
      data: { type: "group_join", groupId },
    })),
  );
}

export async function notifyGoalSuggestion(
  groupId: string,
  groupName: string,
  suggesterName: string,
  goalTitle: string,
) {
  const admins = await getGroupAdminTokens(groupId);
  if (!admins.length) return;

  await sendPushNotifications(
    admins.map((r) => ({
      to: r.token,
      title: `${groupName} — Yeni Hedef Önerisi`,
      body: `${suggesterName}: "${goalTitle}"`,
      data: { type: "goal_suggestion", groupId },
    })),
  );
}

export async function notifySuggestionReviewed(
  userId: string,
  groupName: string,
  goalTitle: string,
  approved: boolean,
) {
  const token = await getUserPushToken(userId);
  if (!token || !Expo.isExpoPushToken(token)) return;

  await sendPushNotifications([
    {
      to: token,
      title: approved ? "Önerin onaylandı ✅" : "Önerin reddedildi",
      body: `"${goalTitle}" — ${groupName}`,
      data: { type: "suggestion_reviewed", approved },
    },
  ]);
}

export async function notifyNewGoal(
  groupId: string,
  groupName: string,
  goalTitle: string,
  creatorId: string,
) {
  const members = await getGroupMemberTokens(groupId, creatorId);
  if (!members.length) return;

  await sendPushNotifications(
    members.map((r) => ({
      to: r.token,
      title: `${groupName} — Yeni Hedef`,
      body: goalTitle,
      data: { type: "new_goal", groupId },
    })),
  );
}
