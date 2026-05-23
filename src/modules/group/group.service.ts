import { db } from "../../db";
import { calculatePoints } from "../tracker/tracker.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import cloudinary from "../../utils/cloudinary";
import {
  notifyGroupJoin,
  notifyGoalSuggestion,
  notifySuggestionReviewed,
  notifyNewGoal,
} from "../../services/push.service";

const DEFAULT_ACTIVITY_TYPES = [
  { name: "Kuran Okuma",   base_type: "quran",        unit: "sayfa"  },
  { name: "Zikir",         base_type: "dhikr",        unit: "adet"   },
  { name: "Nafile Namaz",  base_type: "nafile",       unit: "rekât"  },
  { name: "Oruç",          base_type: "fasting",      unit: "gün"    },
  { name: "Sadaka",        base_type: "sadaka",       unit: "adet"   },
  { name: "Dua",           base_type: "dua",          unit: "dakika" },
  { name: "Hıfz",          base_type: "memorization", unit: "ayet"   },
];

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function extractValue(baseType: string, value: Record<string, unknown>): number {
  switch (baseType) {
    case "quran":       return Number(value.pages) || 0;
    case "dhikr":       return Number(value.count) || 0;
    case "nafile":      return Number(value.rakaat) || 0;
    case "fasting":     return 1;
    case "sadaka":      return Number(value.amount) || 0;
    case "dua":         return Number(value.minutes) || 0;
    case "memorization":
      return (Number(value.new_ayets) || 0) + (Number(value.revision_ayets) || 0);
    default:            return 1;
  }
}

async function isMember(groupId: string, userId: string) {
  const res = await db.execute(
    `SELECT role FROM app.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  return res.rows[0] ?? null;
}

// ─── GROUP CRUD ───────────────────────────────────────────────────────────────

export async function createGroup(
  userId: string,
  data: { name: string; description?: string; max_members?: number },
) {
  let inviteCode: string;
  do {
    inviteCode = generateInviteCode();
    const check = await db.execute(
      `SELECT id FROM app.groups WHERE invite_code = $1`,
      [inviteCode],
    );
    if (!check.rows.length) break;
  } while (true);

  const result = await db.execute(
    `INSERT INTO app.groups (owner_id, name, description, invite_code, max_members)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, data.name, data.description ?? null, inviteCode, data.max_members ?? 20],
  );
  const group = result.rows[0];

  await db.execute(
    `INSERT INTO app.group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [group.id, userId],
  );

  // Tüm standart ibadet tipleri otomatik oluşturulur
  await Promise.all(
    DEFAULT_ACTIVITY_TYPES.map((t) =>
      db.execute(
        `INSERT INTO app.group_activity_types (group_id, name, base_type, unit)
         VALUES ($1, $2, $3, $4)`,
        [group.id, t.name, t.base_type, t.unit],
      ),
    ),
  );

  return group;
}

export async function getUserGroups(userId: string) {
  const result = await db.execute(
    `SELECT g.*, gm.role, gm.joined_at,
            (SELECT COUNT(*) FROM app.group_members WHERE group_id = g.id)::int AS member_count
     FROM app.groups g
     JOIN app.group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     ORDER BY gm.joined_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getGroupById(groupId: string, userId: string) {
  const groupRes = await db.execute(
    `SELECT g.*, gm.role AS my_role
     FROM app.groups g
     LEFT JOIN app.group_members gm ON gm.group_id = g.id AND gm.user_id = $2
     WHERE g.id = $1`,
    [groupId, userId],
  );
  if (!groupRes.rows.length) return null;

  const [membersRes, typesRes] = await Promise.all([
    db.execute(
      `SELECT gm.user_id, gm.role, gm.joined_at,
              u.first_name, u.last_name, u.avatar_url
       FROM app.group_members gm
       JOIN app.users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [groupId],
    ),
    db.execute(
      `SELECT * FROM app.group_activity_types WHERE group_id = $1 ORDER BY created_at ASC`,
      [groupId],
    ),
  ]);

  return {
    ...groupRes.rows[0],
    members: membersRes.rows,
    activity_types: typesRes.rows,
  };
}

export async function updateGroup(
  groupId: string,
  userId: string,
  data: { name?: string; description?: string; max_members?: number; avatar_url?: string },
) {
  const member = await isMember(groupId, userId);
  if (!member || member.role !== "owner") return { error: "forbidden" };

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (data.name !== undefined)        { sets.push(`name = $${i++}`);        params.push(data.name); }
  if (data.description !== undefined) { sets.push(`description = $${i++}`); params.push(data.description); }
  if (data.max_members !== undefined) { sets.push(`max_members = $${i++}`); params.push(data.max_members); }
  if (data.avatar_url !== undefined)  { sets.push(`avatar_url = $${i++}`);  params.push(data.avatar_url); }
  if (!sets.length) return { error: "no_changes" };

  sets.push(`updated_at = NOW()`);
  params.push(groupId);

  const result = await db.execute(
    `UPDATE app.groups SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    params,
  );
  return { data: result.rows[0] };
}

export async function deleteGroup(groupId: string, userId: string) {
  const member = await isMember(groupId, userId);
  if (!member || member.role !== "owner") return { error: "forbidden" };

  const avatarRes = await db.execute(
    `SELECT avatar_public_id FROM app.groups WHERE id = $1`,
    [groupId],
  );
  const publicId = avatarRes.rows[0]?.avatar_public_id;
  if (publicId) {
    cloudinary.uploader.destroy(publicId).catch(() => {});
  }

  await db.execute(`DELETE FROM app.groups WHERE id = $1`, [groupId]);
  return { success: true };
}

// ─── MEMBERSHIP ───────────────────────────────────────────────────────────────

export async function joinGroupByCode(userId: string, inviteCode: string) {
  const groupRes = await db.execute(
    `SELECT * FROM app.groups WHERE invite_code = $1`,
    [inviteCode.toUpperCase()],
  );
  if (!groupRes.rows.length) return { error: "not_found" };
  const group = groupRes.rows[0];

  const countRes = await db.execute(
    `SELECT COUNT(*)::int AS cnt FROM app.group_members WHERE group_id = $1`,
    [group.id],
  );
  if (countRes.rows[0].cnt >= group.max_members) return { error: "full" };

  const existing = await isMember(group.id, userId);
  if (existing) return { error: "already_member" };

  await db.execute(
    `INSERT INTO app.group_members (group_id, user_id, role) VALUES ($1, $2, 'member')`,
    [group.id, userId],
  );

  const userRes = await db.execute(
    `SELECT first_name, last_name FROM app.users WHERE id = $1`,
    [userId],
  );
  const joiner = userRes.rows[0];
  if (joiner) {
    notifyGroupJoin(group.id, group.name, `${joiner.first_name} ${joiner.last_name}`, userId)
      .catch(() => {});
  }

  return { data: group };
}

export async function leaveGroup(userId: string, groupId: string) {
  const member = await isMember(groupId, userId);
  if (!member) return { error: "not_member" };
  if (member.role === "owner") return { error: "owner_cannot_leave" };
  await db.execute(
    `DELETE FROM app.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  return { success: true };
}

export async function removeMember(
  groupId: string,
  requesterId: string,
  targetUserId: string,
) {
  const requester = await isMember(groupId, requesterId);
  if (!requester || !["owner", "moderator"].includes(requester.role)) {
    return { error: "forbidden" };
  }
  const target = await isMember(groupId, targetUserId);
  if (!target) return { error: "not_member" };
  if (target.role === "owner") return { error: "cannot_remove_owner" };

  await db.execute(
    `DELETE FROM app.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, targetUserId],
  );
  return { success: true };
}

export async function uploadGroupAvatar(
  groupId: string,
  userId: string,
  file: Express.Multer.File,
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }

  const oldRes = await db.execute(
    `SELECT avatar_public_id FROM app.groups WHERE id = $1`,
    [groupId],
  );
  const oldPublicId = oldRes.rows[0]?.avatar_public_id;

  const uploaded = await uploadToCloudinary(file.buffer, "group_avatars");

  if (oldPublicId) {
    cloudinary.uploader.destroy(oldPublicId).catch(() => {});
  }

  await db.execute(
    `UPDATE app.groups SET avatar_url = $1, avatar_public_id = $2, updated_at = NOW() WHERE id = $3`,
    [uploaded.url, uploaded.publicId, groupId],
  );

  return { data: { avatar_url: uploaded.url } };
}

export async function updateMemberRole(
  groupId: string,
  requesterId: string,
  targetUserId: string,
  role: "moderator" | "member",
) {
  const requester = await isMember(groupId, requesterId);
  if (!requester || requester.role !== "owner") return { error: "forbidden" };

  const target = await isMember(groupId, targetUserId);
  if (!target) return { error: "not_member" };
  if (target.role === "owner") return { error: "cannot_change_owner" };

  await db.execute(
    `UPDATE app.group_members SET role = $1 WHERE group_id = $2 AND user_id = $3`,
    [role, groupId, targetUserId],
  );
  return { success: true };
}

// ─── ACTIVITY TYPES ──────────────────────────────────────────────────────────

export async function addActivityType(
  groupId: string,
  userId: string,
  data: { name: string; base_type?: string; unit: string },
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }
  const result = await db.execute(
    `INSERT INTO app.group_activity_types (group_id, name, base_type, unit)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [groupId, data.name, data.base_type ?? null, data.unit],
  );
  return { data: result.rows[0] };
}

export async function deleteActivityType(
  groupId: string,
  userId: string,
  typeId: string,
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }
  await db.execute(
    `DELETE FROM app.group_activity_types WHERE id = $1 AND group_id = $2`,
    [typeId, groupId],
  );
  return { success: true };
}

// ─── GOALS ────────────────────────────────────────────────────────────────────

export async function createGoal(
  groupId: string,
  userId: string,
  data: {
    title: string;
    goal_type: "group_total" | "per_person" | "streak";
    target_value: number;
    activity_type_id?: string;
    start_date: string;
    end_date?: string;
  },
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }
  const result = await db.execute(
    `INSERT INTO app.group_goals
       (group_id, activity_type_id, title, goal_type, target_value, start_date, end_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
     RETURNING *`,
    [
      groupId,
      data.activity_type_id ?? null,
      data.title,
      data.goal_type,
      data.target_value,
      data.start_date,
      data.end_date ?? null,
      userId,
    ],
  );

  const groupRes = await db.execute(`SELECT name FROM app.groups WHERE id = $1`, [groupId]);
  const groupName = groupRes.rows[0]?.name ?? "";
  notifyNewGoal(groupId, groupName, data.title, userId).catch(() => {});

  return { data: result.rows[0] };
}

export async function getGoals(groupId: string) {
  const goalsRes = await db.execute(
    `SELECT g.*, at.name AS activity_type_name, at.unit, at.base_type
     FROM app.group_goals g
     LEFT JOIN app.group_activity_types at ON at.id = g.activity_type_id
     WHERE g.group_id = $1
     ORDER BY g.created_at DESC`,
    [groupId],
  );

  const goals = [];
  for (const goal of goalsRes.rows) {
    let progress: Record<string, unknown> = {};

    if (goal.goal_type === "group_total") {
      const res = await db.execute(
        `SELECT COALESCE(SUM(value), 0)::float AS total
         FROM app.group_activity_logs
         WHERE group_id = $1 AND activity_type_id = $2 AND logged_at::date >= $3`,
        [groupId, goal.activity_type_id, goal.start_date],
      );
      progress = { total: res.rows[0].total, target: parseFloat(goal.target_value) };
    } else if (goal.goal_type === "per_person") {
      const res = await db.execute(
        `SELECT gm.user_id, u.first_name, u.last_name, u.avatar_url,
                COALESCE(SUM(al.value), 0)::float AS total
         FROM app.group_members gm
         JOIN app.users u ON u.id = gm.user_id
         LEFT JOIN app.group_activity_logs al
           ON al.user_id = gm.user_id
          AND al.group_id = $1
          AND al.activity_type_id = $2
          AND al.logged_at::date >= $3
         WHERE gm.group_id = $1
         GROUP BY gm.user_id, u.first_name, u.last_name, u.avatar_url`,
        [groupId, goal.activity_type_id, goal.start_date],
      );
      progress = {
        per_person: res.rows.map((r) => ({ ...r, target: parseFloat(goal.target_value) })),
      };
    } else if (goal.goal_type === "streak") {
      const res = await db.execute(
        `SELECT user_id, COUNT(DISTINCT logged_at::date)::int AS days
         FROM app.group_activity_logs
         WHERE group_id = $1 AND activity_type_id = $2 AND logged_at::date >= $3
         GROUP BY user_id`,
        [groupId, goal.activity_type_id, goal.start_date],
      );
      progress = {
        per_person_days: res.rows.map((r) => ({
          user_id: r.user_id,
          days: r.days,
          target: parseFloat(goal.target_value),
        })),
      };
    }

    goals.push({ ...goal, progress });
  }
  return goals;
}

export async function updateGoalStatus(
  groupId: string,
  userId: string,
  goalId: string,
  status: string,
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }
  const result = await db.execute(
    `UPDATE app.group_goals SET status = $1 WHERE id = $2 AND group_id = $3 RETURNING *`,
    [status, goalId, groupId],
  );
  if (!result.rows.length) return { error: "not_found" };
  return { data: result.rows[0] };
}

// ─── GOAL SUGGESTIONS ────────────────────────────────────────────────────────

export async function suggestGoal(
  groupId: string,
  userId: string,
  data: {
    title: string;
    goal_type: string;
    target_value: number;
    activity_type_id?: string;
    start_date?: string;
    end_date?: string;
    note?: string;
  },
) {
  const member = await isMember(groupId, userId);
  if (!member) return { error: "not_member" };

  const result = await db.execute(
    `INSERT INTO app.group_goal_suggestions
       (group_id, suggested_by, activity_type_id, title, goal_type, target_value, start_date, end_date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      groupId,
      userId,
      data.activity_type_id ?? null,
      data.title,
      data.goal_type,
      data.target_value,
      data.start_date ?? null,
      data.end_date ?? null,
      data.note ?? null,
    ],
  );

  const [userRes, groupRes] = await Promise.all([
    db.execute(`SELECT first_name, last_name FROM app.users WHERE id = $1`, [userId]),
    db.execute(`SELECT name FROM app.groups WHERE id = $1`, [groupId]),
  ]);
  const suggester = userRes.rows[0];
  const group = groupRes.rows[0];
  if (suggester && group) {
    notifyGoalSuggestion(groupId, group.name, `${suggester.first_name} ${suggester.last_name}`, data.title)
      .catch(() => {});
  }

  return { data: result.rows[0] };
}

export async function getGoalSuggestions(groupId: string, userId: string) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }
  const result = await db.execute(
    `SELECT gs.*, u.first_name, u.last_name, u.avatar_url
     FROM app.group_goal_suggestions gs
     JOIN app.users u ON u.id = gs.suggested_by
     WHERE gs.group_id = $1
     ORDER BY gs.created_at DESC`,
    [groupId],
  );
  return { data: result.rows };
}

export async function reviewSuggestion(
  groupId: string,
  userId: string,
  suggestionId: string,
  approved: boolean,
) {
  const member = await isMember(groupId, userId);
  if (!member || !["owner", "moderator"].includes(member.role)) {
    return { error: "forbidden" };
  }

  const status = approved ? "approved" : "rejected";
  const result = await db.execute(
    `UPDATE app.group_goal_suggestions
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 AND group_id = $4
     RETURNING *`,
    [status, userId, suggestionId, groupId],
  );
  if (!result.rows.length) return { error: "not_found" };

  const suggestion = result.rows[0];

  if (approved) {
    const s = suggestion;
    await db.execute(
      `INSERT INTO app.group_goals
         (group_id, activity_type_id, title, goal_type, target_value, start_date, end_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
      [
        groupId,
        s.activity_type_id,
        s.title,
        s.goal_type,
        s.target_value,
        s.start_date ?? new Date().toISOString().split("T")[0],
        s.end_date,
        userId,
      ],
    );
  }

  const groupRes = await db.execute(`SELECT name FROM app.groups WHERE id = $1`, [groupId]);
  const groupName = groupRes.rows[0]?.name ?? "";
  notifySuggestionReviewed(suggestion.suggested_by, groupName, suggestion.title, approved)
    .catch(() => {});

  return { data: suggestion };
}

// ─── MANUAL ACTIVITY LOG ─────────────────────────────────────────────────────

export async function logManualActivity(
  groupId: string,
  userId: string,
  data: { activity_type_id: string; value: number; notes?: string },
) {
  const member = await isMember(groupId, userId);
  if (!member) return { error: "not_member" };

  const typeRes = await db.execute(
    `SELECT * FROM app.group_activity_types WHERE id = $1 AND group_id = $2`,
    [data.activity_type_id, groupId],
  );
  if (!typeRes.rows.length) return { error: "not_found" };

  const goalRes = await db.execute(
    `SELECT id FROM app.group_goals
     WHERE group_id = $1 AND activity_type_id = $2 AND status = 'active'
       AND start_date <= CURRENT_DATE
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     LIMIT 1`,
    [groupId, data.activity_type_id],
  );
  const goalId = goalRes.rows[0]?.id ?? null;

  const result = await db.execute(
    `INSERT INTO app.group_activity_logs
       (group_id, user_id, goal_id, activity_type_id, value, points)
     VALUES ($1, $2, $3, $4, $5, 0)
     RETURNING *`,
    [groupId, userId, goalId, data.activity_type_id, data.value],
  );
  return { data: result.rows[0] };
}

// ─── FEED ─────────────────────────────────────────────────────────────────────

export async function getFeed(groupId: string, limit = 20, offset = 0) {
  const result = await db.execute(
    `SELECT al.id, al.value, al.points, al.logged_at,
            u.first_name, u.last_name, u.avatar_url,
            at.name AS activity_name, at.unit
     FROM app.group_activity_logs al
     JOIN app.users u ON u.id = al.user_id
     JOIN app.group_activity_types at ON at.id = al.activity_type_id
     WHERE al.group_id = $1
     ORDER BY al.logged_at DESC
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset],
  );
  return result.rows;
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

export async function getLeaderboard(
  groupId: string,
  period: "all" | "week" | "month" | "custom",
  customStart?: string,
  customEnd?: string,
) {
  if (period === "all") {
    const result = await db.execute(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_url, gm.role,
              COALESCE(s.total_points, 0) AS total_points,
              COALESCE(s.current_streak, 0) AS current_streak
       FROM app.group_members gm
       JOIN app.users u ON u.id = gm.user_id
       LEFT JOIN app.user_stats s ON s.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY total_points DESC`,
      [groupId],
    );
    return result.rows;
  }

  let dateFilter: string;
  const params: unknown[] = [groupId];

  if (period === "week") {
    dateFilter = `AND al.logged_at >= NOW() - INTERVAL '7 days'`;
  } else if (period === "month") {
    dateFilter = `AND al.logged_at >= NOW() - INTERVAL '30 days'`;
  } else {
    dateFilter = `AND al.logged_at >= $2 AND al.logged_at <= $3`;
    params.push(customStart, customEnd);
  }

  const result = await db.execute(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_url, gm.role,
            COALESCE(SUM(al.points), 0)::int AS period_points
     FROM app.group_members gm
     JOIN app.users u ON u.id = gm.user_id
     LEFT JOIN app.group_activity_logs al
       ON al.user_id = gm.user_id AND al.group_id = $1 ${dateFilter}
     WHERE gm.group_id = $1
     GROUP BY u.id, u.first_name, u.last_name, u.avatar_url, gm.role
     ORDER BY period_points DESC`,
    params,
  );
  return result.rows;
}

// ─── TRACKER HOOK ─────────────────────────────────────────────────────────────

export async function reflectToGroups(
  userId: string,
  trackerLogId: string,
  activityType: string,
  value: Record<string, unknown>,
) {
  const groupsRes = await db.execute(
    `SELECT group_id FROM app.group_members WHERE user_id = $1`,
    [userId],
  );
  if (!groupsRes.rows.length) return;

  const groupIds = groupsRes.rows.map((r: any) => r.group_id);

  const actTypesRes = await db.execute(
    `SELECT * FROM app.group_activity_types WHERE group_id = ANY($1) AND base_type = $2`,
    [groupIds, activityType],
  );
  if (!actTypesRes.rows.length) {
    console.log(`reflectToGroups: ${activityType} için grup aktivite tipi bulunamadı (groupIds: ${groupIds.join(",")})`);
    return;
  }

  const numericValue = extractValue(activityType, value);
  const points = calculatePoints(activityType, value);

  await Promise.all(
    actTypesRes.rows.map(async (at: any) => {
      const goalRes = await db.execute(
        `SELECT id FROM app.group_goals
         WHERE group_id = $1 AND activity_type_id = $2 AND status = 'active'
           AND start_date <= CURRENT_DATE
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         LIMIT 1`,
        [at.group_id, at.id],
      );
      const goalId = goalRes.rows[0]?.id ?? null;

      await db.execute(
        `INSERT INTO app.group_activity_logs
           (group_id, user_id, goal_id, activity_type_id, tracker_log_id, value, points)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [at.group_id, userId, goalId, at.id, trackerLogId, numericValue, points],
      );
    }),
  );
}
