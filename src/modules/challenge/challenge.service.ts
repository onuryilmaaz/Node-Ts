import { db } from "../../db";

// ─────────────────────────────────────────────
// GET ACTIVE CHALLENGES (with user progress)
// ─────────────────────────────────────────────
export async function getActiveChallenges(userId: string) {
  const result = await db.execute(
    `SELECT 
       c.*,
       uc.id AS user_challenge_id,
       uc.progress,
       uc.is_completed,
       uc.completed_at,
       uc.joined_at
     FROM app.challenges c
     LEFT JOIN app.user_challenges uc 
       ON uc.challenge_id = c.id AND uc.user_id = $1
     WHERE c.is_active = TRUE AND c.ends_at > NOW()
     ORDER BY c.ends_at ASC`,
    [userId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────
// JOIN CHALLENGE
// ─────────────────────────────────────────────
export async function joinChallenge(userId: string, challengeId: string) {
  const existing = await db.execute(
    `SELECT id FROM app.user_challenges WHERE user_id = $1 AND challenge_id = $2`,
    [userId, challengeId]
  );
  if (existing.rows.length > 0) {
    return { alreadyJoined: true, row: existing.rows[0] };
  }

  const result = await db.execute(
    `INSERT INTO app.user_challenges (user_id, challenge_id) VALUES ($1, $2) RETURNING *`,
    [userId, challengeId]
  );
  return { alreadyJoined: false, row: result.rows[0] };
}

// ─────────────────────────────────────────────
// UPDATE CHALLENGE PROGRESS (called after prayer log)
// ─────────────────────────────────────────────
export async function updateChallengeProgress(userId: string) {
  // Get all active, non-completed challenges user has joined
  const userChallenges = await db.execute(
    `SELECT uc.id, uc.challenge_id, c.goal_type, c.goal_value, c.goal_prayer, c.bonus_points, c.badge_id
     FROM app.user_challenges uc
     JOIN app.challenges c ON c.id = uc.challenge_id
     WHERE uc.user_id = $1 AND uc.is_completed = FALSE 
       AND c.is_active = TRUE AND c.ends_at > NOW()`,
    [userId]
  );

  const newlyCompleted: string[] = [];

  for (const uc of userChallenges.rows) {
    let progress = 0;

    if (uc.goal_type === 'prayer_count') {
      // Count total prayers since challenge start
      const challengeStart = await db.execute(
        `SELECT starts_at FROM app.challenges WHERE id = $1`, [uc.challenge_id]
      );
      const start = challengeStart.rows[0]?.starts_at;
      const countRes = await db.execute(
        `SELECT COUNT(*) as cnt FROM app.prayer_logs 
         WHERE user_id = $1 AND created_at >= $2`,
        [userId, start]
      );
      progress = parseInt(countRes.rows[0].cnt);
    }

    if (uc.goal_type === 'prayer_time' && uc.goal_prayer) {
      const challengeStart = await db.execute(
        `SELECT starts_at FROM app.challenges WHERE id = $1`, [uc.challenge_id]
      );
      const start = challengeStart.rows[0]?.starts_at;
      const countRes = await db.execute(
        `SELECT COUNT(DISTINCT date) as cnt FROM app.prayer_logs 
         WHERE user_id = $1 AND prayer_time = $2 AND created_at >= $3`,
        [userId, uc.goal_prayer, start]
      );
      progress = parseInt(countRes.rows[0].cnt);
    }

    if (uc.goal_type === 'streak') {
      const statsRes = await db.execute(
        `SELECT current_streak FROM app.user_stats WHERE user_id = $1`, [userId]
      );
      progress = parseInt(statsRes.rows[0]?.current_streak || '0');
    }

    if (uc.goal_type === 'kaza_complete') {
      const kazaRes = await db.execute(
        `SELECT COUNT(*) as cnt FROM app.kaza_queue 
         WHERE user_id = $1 AND completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '7 days'`,
        [userId]
      );
      progress = parseInt(kazaRes.rows[0].cnt);
    }

    // Update progress
    await db.execute(
      `UPDATE app.user_challenges SET progress = $1 WHERE id = $2`,
      [progress, uc.id]
    );

    // Check completion
    if (progress >= uc.goal_value) {
      await db.execute(
        `UPDATE app.user_challenges SET is_completed = TRUE, completed_at = NOW() WHERE id = $1`,
        [uc.id]
      );

      // Award bonus points
      await db.execute(
        `UPDATE app.user_stats SET total_points = total_points + $1, updated_at = NOW() WHERE user_id = $2`,
        [uc.bonus_points, userId]
      );

      // Award badge if configured
      if (uc.badge_id) {
        await db.execute(
          `INSERT INTO app.user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, uc.badge_id]
        );
      }

      newlyCompleted.push(uc.challenge_id);
    }
  }

  return newlyCompleted;
}

// ─────────────────────────────────────────────
// GET USER'S CHALLENGE HISTORY
// ─────────────────────────────────────────────
export async function getUserChallengeHistory(userId: string) {
  const result = await db.execute(
    `SELECT c.title, c.description, c.bonus_points, uc.is_completed, uc.completed_at, uc.progress, c.goal_value
     FROM app.user_challenges uc
     JOIN app.challenges c ON c.id = uc.challenge_id
     WHERE uc.user_id = $1
     ORDER BY uc.joined_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}
