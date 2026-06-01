import { db } from "../../db";

const VALID_STATUS = ["in_progress", "memorized", "reviewing"];

export async function listHifz(userId: string) {
  const res = await db.execute(
    `SELECT id, surah_id, status, pages_done, updated_at
     FROM app.user_hifz
     WHERE user_id = $1
     ORDER BY surah_id ASC`,
    [userId],
  );
  return res.rows;
}

export async function upsertHifz(
  userId: string,
  surahId: number,
  status: string,
  pagesDone: number,
) {
  if (!VALID_STATUS.includes(status)) {
    throw new Error("Geçersiz durum");
  }
  const res = await db.execute(
    `INSERT INTO app.user_hifz (user_id, surah_id, status, pages_done)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, surah_id)
     DO UPDATE SET status = $3, pages_done = $4, updated_at = NOW()
     RETURNING *`,
    [userId, surahId, status, pagesDone],
  );
  return res.rows[0];
}

export async function deleteHifz(userId: string, surahId: number) {
  await db.execute(
    `DELETE FROM app.user_hifz WHERE user_id = $1 AND surah_id = $2`,
    [userId, surahId],
  );
}
