import type { Request, Response } from "express";
import { db } from "../../db";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import type { Express } from "express";

export async function addMosque(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { name, latitude, longitude, image_url, description } = req.body;

    if (!userId || !name || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const result = await db.execute(
      `INSERT INTO app.mosques (user_id, name, latitude, longitude, image_url, description) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, latitude, longitude, image_url, description],
    );

    return res.json({ success: true, mosque: result.rows[0] });
  } catch (error) {
    console.error("Add mosque error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}

export async function getMosques(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { filter } = req.query;

    let query = `
      SELECT m.*, u.first_name, u.last_name, u.username
      FROM app.mosques m
      JOIN app.users u ON m.user_id = u.id
    `;

    const params = [];

    if (filter === "mine" && userId) {
      query += ` WHERE m.user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY m.created_at DESC`;

    const result = await db.execute(query, params);
    return res.json({ success: true, mosques: result.rows });
  } catch (error) {
    console.error("Get mosques error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}

export async function uploadMosqueImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Dosya gerekli" });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, "mosques");
    return res.json({ success: true, imageUrl: uploadResult.url });
  } catch (error) {
    console.error("Mosque image upload error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Yükleme başarısız" });
  }
}
