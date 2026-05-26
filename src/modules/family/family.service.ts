import bcrypt from "bcrypt";
import { db, query } from "../../db";
import { signChildToken } from "../../utils/jwt";
import { getUserPushToken, sendPushNotifications } from "../../services/push.service";
import { CHILD_LEVELS, CHILD_BADGE_DETAILS } from "./family.types";

function turkeyDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

// ── Child Profiles ─────────────────────────────────────────────────────────────

export async function createChild(
  parentId: string,
  data: { name: string; birth_year?: number; avatar_emoji?: string; gender?: string; pin_code?: string },
) {
  const pinHash = data.pin_code ? await bcrypt.hash(data.pin_code, 10) : null;

  const result = await db.execute(
    `INSERT INTO app.child_profiles (parent_id, name, birth_year, avatar_emoji, gender, pin_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, parent_id, name, birth_year, avatar_emoji, gender, is_active, created_at`,
    [parentId, data.name, data.birth_year ?? null, data.avatar_emoji ?? "🌙", data.gender ?? null, pinHash],
  );
  const child = result.rows[0];

  await db.execute(
    `INSERT INTO app.child_stats (child_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [child.id],
  );

  return child;
}

export async function getChildren(parentId: string) {
  const result = await db.execute(
    `SELECT cp.id, cp.name, cp.birth_year, cp.avatar_emoji, cp.gender, cp.is_active, cp.created_at,
            cs.total_stars, cs.current_streak, cs.level,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             WHERE ctc.child_id = cp.id AND ctc.status = 'pending') AS pending_approvals,
            (SELECT COUNT(*) FROM app.child_tasks ct
             WHERE ct.child_id = cp.id AND ct.is_active = true) AS task_count
     FROM app.child_profiles cp
     LEFT JOIN app.child_stats cs ON cs.child_id = cp.id
     WHERE cp.parent_id = $1 AND cp.is_active = true
     ORDER BY cp.created_at ASC`,
    [parentId],
  );
  return result.rows;
}

export async function getChildById(childId: string) {
  const result = await db.execute(
    `SELECT cp.id, cp.name, cp.birth_year, cp.avatar_emoji, cp.gender, cp.is_active, cp.created_at,
            cs.total_stars, cs.current_streak, cs.highest_streak, cs.level, cs.last_activity
     FROM app.child_profiles cp
     LEFT JOIN app.child_stats cs ON cs.child_id = cp.id
     WHERE cp.id = $1 AND cp.is_active = true`,
    [childId],
  );
  return result.rows[0] ?? null;
}

export async function updateChild(
  childId: string,
  data: { name?: string; birth_year?: number; avatar_emoji?: string; gender?: string },
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(data.name); }
  if (data.birth_year !== undefined) { setClauses.push(`birth_year = $${idx++}`); values.push(data.birth_year); }
  if (data.avatar_emoji !== undefined) { setClauses.push(`avatar_emoji = $${idx++}`); values.push(data.avatar_emoji); }
  if (data.gender !== undefined) { setClauses.push(`gender = $${idx++}`); values.push(data.gender); }

  if (!setClauses.length) return getChildById(childId);

  values.push(childId);
  const result = await db.execute(
    `UPDATE app.child_profiles SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteChild(childId: string) {
  await db.execute(
    `UPDATE app.child_profiles SET is_active = false WHERE id = $1`,
    [childId],
  );
}

// ── Child Session (PIN) ────────────────────────────────────────────────────────

export async function createChildSession(childId: string, parentId: string, pinCode: string) {
  const result = await db.execute(
    `SELECT pin_code FROM app.child_profiles WHERE id = $1 AND parent_id = $2 AND is_active = true`,
    [childId, parentId],
  );
  const child = result.rows[0];
  if (!child) throw new Error("CHILD_NOT_FOUND");
  if (!child.pin_code) throw new Error("PIN_NOT_SET");

  const valid = await bcrypt.compare(pinCode, child.pin_code);
  if (!valid) throw new Error("INVALID_PIN");

  return signChildToken({ childId, parentId, type: "child_session" });
}

export async function setChildPin(childId: string, pinCode: string) {
  const hash = await bcrypt.hash(pinCode, 10);
  await db.execute(
    `UPDATE app.child_profiles SET pin_code = $1 WHERE id = $2`,
    [hash, childId],
  );
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function createTask(
  childId: string,
  parentId: string,
  data: {
    task_type: string; title: string; description?: string; recurrence: string;
    scheduled_days?: number[]; due_time?: string; reward_stars: number;
    requires_proof: boolean; requires_approval: boolean;
  },
) {
  const result = await db.execute(
    `INSERT INTO app.child_tasks
       (child_id, parent_id, task_type, title, description, recurrence, scheduled_days, due_time, reward_stars, requires_proof, requires_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      childId, parentId, data.task_type, data.title, data.description ?? null,
      data.recurrence, data.scheduled_days ?? null, data.due_time ?? null,
      data.reward_stars, data.requires_proof, data.requires_approval,
    ],
  );
  return result.rows[0];
}

export async function getTasks(childId: string, activeOnly = true) {
  const result = await db.execute(
    `SELECT * FROM app.child_tasks WHERE child_id = $1 ${activeOnly ? "AND is_active = true" : ""} ORDER BY created_at ASC`,
    [childId],
  );
  return result.rows;
}

export async function updateTask(taskId: string, childId: string, data: Record<string, unknown>) {
  const allowed = ["title", "description", "recurrence", "scheduled_days", "due_time", "reward_stars", "requires_proof", "requires_approval", "is_active"];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (!setClauses.length) return null;
  values.push(taskId, childId);

  const result = await db.execute(
    `UPDATE app.child_tasks SET ${setClauses.join(", ")} WHERE id = $${idx++} AND child_id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteTask(taskId: string, childId: string) {
  await db.execute(
    `UPDATE app.child_tasks SET is_active = false WHERE id = $1 AND child_id = $2`,
    [taskId, childId],
  );
}

// ── Completions ────────────────────────────────────────────────────────────────

export async function getTodayTasksForChild(childId: string) {
  const today = turkeyDateStr();
  // Turkey timezone-aware day of week (0=Sunday ... 6=Saturday)
  const turkeyDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const dayOfWeek = turkeyDate.getDay();

  const result = await db.execute(
    `SELECT ct.*,
            ctc.id AS completion_id,
            ctc.status,
            ctc.stars_earned,
            ctc.completed_at
     FROM app.child_tasks ct
     LEFT JOIN app.child_task_completions ctc
       ON ctc.task_id = ct.id AND ctc.completion_date = $2
     WHERE ct.child_id = $1
       AND ct.is_active = true
       AND (
         ct.recurrence = 'daily'
         OR (ct.recurrence = 'weekly' AND (ct.scheduled_days IS NULL OR $3 = ANY(ct.scheduled_days)))
         OR (ct.recurrence = 'once' AND ctc.id IS NULL)
       )
     ORDER BY ct.created_at ASC`,
    [childId, today, dayOfWeek],
  );
  return result.rows;
}

export async function completeTask(
  taskId: string,
  childId: string,
  parentId: string,
  evidenceUrl?: string,
) {
  const today = turkeyDateStr();

  const taskResult = await db.execute(
    `SELECT * FROM app.child_tasks WHERE id = $1 AND child_id = $2 AND is_active = true`,
    [taskId, childId],
  );
  const task = taskResult.rows[0];
  if (!task) throw new Error("TASK_NOT_FOUND");

  const existing = await db.execute(
    `SELECT id FROM app.child_task_completions WHERE task_id = $1 AND completion_date = $2`,
    [taskId, today],
  );
  if (existing.rows[0]) throw new Error("ALREADY_COMPLETED");

  const status = task.requires_approval ? "pending" : "approved";
  const starsEarned = task.requires_approval ? 0 : task.reward_stars;

  const result = await db.execute(
    `INSERT INTO app.child_task_completions (task_id, child_id, completion_date, status, evidence_url, stars_earned)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [taskId, childId, today, status, evidenceUrl ?? null, starsEarned],
  );
  const completion = result.rows[0];

  if (!task.requires_approval) {
    await addStarsAndUpdateStats(childId, starsEarned);
    await checkAndAwardBadges(childId);
  } else {
    await notifyParentCompletion(parentId, task.title, childId);
  }

  return completion;
}

export async function getCompletions(childId: string, limit = 30) {
  const result = await db.execute(
    `SELECT ctc.*, ct.title, ct.task_type, ct.reward_stars
     FROM app.child_task_completions ctc
     JOIN app.child_tasks ct ON ct.id = ctc.task_id
     WHERE ctc.child_id = $1
     ORDER BY ctc.completion_date DESC, ctc.completed_at DESC
     LIMIT $2`,
    [childId, limit],
  );
  return result.rows;
}

export async function reviewCompletion(
  completionId: string,
  parentId: string,
  approved: boolean,
  parentNote?: string,
) {
  const result = await db.execute(
    `SELECT ctc.*, ct.reward_stars, ct.child_id
     FROM app.child_task_completions ctc
     JOIN app.child_tasks ct ON ct.id = ctc.task_id
     WHERE ctc.id = $1 AND ct.parent_id = $2 AND ctc.status = 'pending'`,
    [completionId, parentId],
  );
  const completion = result.rows[0];
  if (!completion) throw new Error("COMPLETION_NOT_FOUND");

  const newStatus = approved ? "approved" : "rejected";
  const starsEarned = approved ? completion.reward_stars : 0;

  await db.execute(
    `UPDATE app.child_task_completions
     SET status = $1, stars_earned = $2, parent_note = $3, reviewed_at = now()
     WHERE id = $4`,
    [newStatus, starsEarned, parentNote ?? null, completionId],
  );

  if (approved) {
    await addStarsAndUpdateStats(completion.child_id, starsEarned);
    await checkAndAwardBadges(completion.child_id);
  }

  return { completionId, status: newStatus, stars_earned: starsEarned };
}

export async function getPendingApprovals(parentId: string) {
  const result = await db.execute(
    `SELECT ctc.*, ct.title, ct.task_type, ct.reward_stars,
            cp.name AS child_name, cp.avatar_emoji
     FROM app.child_task_completions ctc
     JOIN app.child_tasks ct ON ct.id = ctc.task_id
     JOIN app.child_profiles cp ON cp.id = ctc.child_id
     WHERE ct.parent_id = $1 AND ctc.status = 'pending'
     ORDER BY ctc.completed_at DESC`,
    [parentId],
  );
  return result.rows;
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export async function getChildStats(childId: string) {
  const statsResult = await db.execute(
    `SELECT * FROM app.child_stats WHERE child_id = $1`,
    [childId],
  );
  const stats = statsResult.rows[0] ?? { total_stars: 0, current_streak: 0, highest_streak: 0, level: 1 };

  const badgesResult = await db.execute(
    `SELECT badge_type, earned_at FROM app.child_badges WHERE child_id = $1 ORDER BY earned_at DESC`,
    [childId],
  );

  const levelInfo = CHILD_LEVELS.find((l) => stats.level === l.level) ?? CHILD_LEVELS[0]!;
  const nextLevel = CHILD_LEVELS.find((l) => l.level === stats.level + 1);

  return {
    ...stats,
    level_name: levelInfo.name,
    next_level_stars: nextLevel?.min_stars ?? null,
    badges: badgesResult.rows.map((b) => ({
      ...b,
      ...CHILD_BADGE_DETAILS[b.badge_type],
    })),
  };
}

export async function getWeeklyReport(childId: string) {
  const result = await db.execute(
    `SELECT ct.task_type,
            COUNT(ct.id) AS assigned,
            COUNT(ctc.id) FILTER (WHERE ctc.status = 'approved') AS completed,
            COALESCE(SUM(ctc.stars_earned), 0) AS stars_earned
     FROM app.child_tasks ct
     LEFT JOIN app.child_task_completions ctc
       ON ctc.task_id = ct.id
       AND ctc.completion_date >= CURRENT_DATE - INTERVAL '6 days'
       AND ctc.completion_date <= CURRENT_DATE
     WHERE ct.child_id = $1 AND ct.is_active = true AND ct.recurrence = 'daily'
     GROUP BY ct.task_type`,
    [childId],
  );

  const newBadges = await db.execute(
    `SELECT badge_type, earned_at FROM app.child_badges
     WHERE child_id = $1 AND earned_at >= CURRENT_DATE - INTERVAL '7 days'`,
    [childId],
  );

  return {
    by_type: result.rows,
    badges_earned: newBadges.rows,
  };
}

export async function getMonthlyReport(childId: string, year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? (now.getMonth() + 1);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(y, m, 0).toISOString().split("T")[0];

  const result = await db.execute(
    `SELECT ctc.completion_date::text AS date,
            COUNT(*) FILTER (WHERE ctc.status = 'approved') AS completed,
            COUNT(ct.id) AS assigned,
            COALESCE(SUM(ctc.stars_earned), 0) AS stars
     FROM app.child_tasks ct
     LEFT JOIN app.child_task_completions ctc
       ON ctc.task_id = ct.id
       AND ctc.completion_date BETWEEN $2 AND $3
     WHERE ct.child_id = $1 AND ct.is_active = true
     GROUP BY ctc.completion_date
     ORDER BY ctc.completion_date ASC`,
    [childId, monthStart, monthEnd],
  );

  return { year: y, month: m, daily: result.rows };
}

// ── Rewards ────────────────────────────────────────────────────────────────────

export async function createReward(childId: string, title: string, costStars: number) {
  const result = await db.execute(
    `INSERT INTO app.child_rewards (child_id, title, cost_stars) VALUES ($1, $2, $3) RETURNING *`,
    [childId, title, costStars],
  );
  return result.rows[0];
}

export async function getRewards(childId: string) {
  const result = await db.execute(
    `SELECT * FROM app.child_rewards WHERE child_id = $1 ORDER BY is_redeemed ASC, created_at DESC`,
    [childId],
  );
  return result.rows;
}

export async function redeemReward(rewardId: string, childId: string) {
  const rewardResult = await db.execute(
    `SELECT * FROM app.child_rewards WHERE id = $1 AND child_id = $2 AND is_redeemed = false`,
    [rewardId, childId],
  );
  const reward = rewardResult.rows[0];
  if (!reward) throw new Error("REWARD_NOT_FOUND");

  const statsResult = await db.execute(
    `SELECT total_stars FROM app.child_stats WHERE child_id = $1`,
    [childId],
  );
  const stars = statsResult.rows[0]?.total_stars ?? 0;
  if (stars < reward.cost_stars) throw new Error("INSUFFICIENT_STARS");

  await db.execute(
    `UPDATE app.child_stats SET total_stars = total_stars - $1 WHERE child_id = $2`,
    [reward.cost_stars, childId],
  );
  await db.execute(
    `UPDATE app.child_rewards SET is_redeemed = true, redeemed_at = now() WHERE id = $1`,
    [rewardId],
  );

  return { rewardId, stars_spent: reward.cost_stars };
}

export async function deleteReward(rewardId: string, parentId: string) {
  await db.execute(
    `DELETE FROM app.child_rewards cr
     USING app.child_profiles cp
     WHERE cr.id = $1 AND cr.child_id = cp.id AND cp.parent_id = $2`,
    [rewardId, parentId],
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function addStarsAndUpdateStats(childId: string, stars: number) {
  if (stars <= 0) return;

  const today = turkeyDateStr();

  await db.execute(
    `INSERT INTO app.child_stats (child_id, total_stars, last_activity, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (child_id) DO UPDATE
       SET total_stars = app.child_stats.total_stars + $2,
           last_activity = $3,
           updated_at = now()`,
    [childId, stars, today],
  );

  await updateStreak(childId);
  await updateLevel(childId);
}

async function updateStreak(childId: string) {
  const result = await db.execute(
    `SELECT DISTINCT completion_date::text
     FROM app.child_task_completions
     WHERE child_id = $1 AND status = 'approved'
     ORDER BY completion_date DESC
     LIMIT 60`,
    [childId],
  );

  const dates = new Set(result.rows.map((r: any) => r.completion_date.substring(0, 10)));
  const today = turkeyDateStr();
  let streak = 0;
  let current = today;

  for (let i = 0; i < 60; i++) {
    if (dates.has(current)) {
      streak++;
      const d = new Date(current + "T12:00:00Z");
      d.setDate(d.getDate() - 1);
      current = d.toISOString().split("T")[0]!;
    } else {
      break;
    }
  }

  await db.execute(
    `UPDATE app.child_stats
     SET current_streak = $1,
         highest_streak = GREATEST(highest_streak, $1),
         updated_at = now()
     WHERE child_id = $2`,
    [streak, childId],
  );
}

async function updateLevel(childId: string) {
  const result = await db.execute(
    `SELECT total_stars FROM app.child_stats WHERE child_id = $1`,
    [childId],
  );
  const stars = result.rows[0]?.total_stars ?? 0;
  const level = CHILD_LEVELS.findLast((l) => stars >= l.min_stars)?.level ?? 1;

  await db.execute(
    `UPDATE app.child_stats SET level = $1, updated_at = now() WHERE child_id = $2`,
    [level, childId],
  );
}

async function checkAndAwardBadges(childId: string) {
  const statsResult = await db.execute(
    `SELECT cs.total_stars, cs.current_streak,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             WHERE ctc.child_id = $1 AND ctc.status = 'approved') AS total_completions,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             JOIN app.child_tasks ct ON ct.id = ctc.task_id
             WHERE ctc.child_id = $1 AND ctc.status = 'approved' AND ct.task_type = 'prayer'
               AND ct.title ILIKE '%sabah%') AS fajr_count,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             JOIN app.child_tasks ct ON ct.id = ctc.task_id
             WHERE ctc.child_id = $1 AND ctc.status = 'approved' AND ct.task_type = 'quran') AS quran_count,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             JOIN app.child_tasks ct ON ct.id = ctc.task_id
             WHERE ctc.child_id = $1 AND ctc.status = 'approved' AND ct.task_type = 'dua') AS dua_count,
            (SELECT COUNT(*) FROM app.child_task_completions ctc
             JOIN app.child_tasks ct ON ct.id = ctc.task_id
             WHERE ctc.child_id = $1 AND ctc.status = 'approved' AND ct.task_type = 'manners') AS manners_count
     FROM app.child_stats cs WHERE cs.child_id = $1`,
    [childId],
  );
  const s = statsResult.rows[0];
  if (!s) return;

  const badgesToCheck: Array<[string, boolean]> = [
    ["ilk_adim", Number(s.total_completions) >= 1],
    ["namaz_srk_3", Number(s.current_streak) >= 3],
    ["namaz_srk_7", Number(s.current_streak) >= 7],
    ["namaz_srk_30", Number(s.current_streak) >= 30],
    ["sabah_kusucugu", Number(s.fajr_count) >= 7],
    ["quran_coku", Number(s.quran_count) >= 50],
    ["dua_ustasi", Number(s.dua_count) >= 10],
    ["iyi_ahlak", Number(s.manners_count) >= 20],
  ];

  const existingResult = await db.execute(
    `SELECT badge_type FROM app.child_badges WHERE child_id = $1`,
    [childId],
  );
  const existing = new Set(existingResult.rows.map((r: any) => r.badge_type));

  for (const [badge, earned] of badgesToCheck) {
    if (earned && !existing.has(badge)) {
      await db.execute(
        `INSERT INTO app.child_badges (child_id, badge_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [childId, badge],
      );
    }
  }
}

async function notifyParentCompletion(parentId: string, taskTitle: string, childId: string) {
  const token = await getUserPushToken(parentId);
  if (!token) return;

  const childResult = await db.execute(
    `SELECT name FROM app.child_profiles WHERE id = $1`,
    [childId],
  );
  const childName = childResult.rows[0]?.name ?? "Çocuğun";

  await sendPushNotifications([{
    to: token,
    title: `${childName} bir görevi tamamladı! ✅`,
    body: `"${taskTitle}" — Onay bekliyor`,
    data: { type: "child_task_pending", childId },
  }]);
}
