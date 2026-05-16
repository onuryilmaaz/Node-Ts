import type { Request, Response } from "express";
import { db } from "../../db";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import cloudinary from "../../utils/cloudinary";

export async function addMosque(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { name, latitude, longitude, image_url, image_public_id, description } = req.body;

    if (!userId || !name || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const result = await db.execute(
      `INSERT INTO app.mosques (user_id, name, latitude, longitude, image_url, image_public_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name, latitude, longitude, image_url, image_public_id, description]
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

    let queryStr = `
      SELECT m.*, u.first_name, u.last_name, u.username
      FROM app.mosques m
      JOIN app.users u ON m.user_id = u.id
    `;
    const params: any[] = [];

    if (filter === "mine" && userId) {
      queryStr += ` WHERE m.user_id = $1`;
      params.push(userId);
    }

    queryStr += ` ORDER BY m.created_at DESC`;

    const result = await db.execute(queryStr, params);
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
    return res.json({
      success: true,
      imageUrl: uploadResult.url,
      imagePublicId: uploadResult.publicId,
    });
  } catch (error) {
    console.error("Mosque image upload error:", error);
    return res.status(500).json({ success: false, message: "Yükleme başarısız" });
  }
}

export async function updateMosque(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, description, image_url, image_public_id } = req.body;

    const existing = await db.execute(
      "SELECT * FROM app.mosques WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (!existing.rows[0]) {
      return res.status(403).json({ success: false, message: "Yetkisiz" });
    }

    const old = existing.rows[0];

    // Resim değiştiyse eski Cloudinary resmini sil
    if (
      image_public_id &&
      old.image_public_id &&
      old.image_public_id !== image_public_id
    ) {
      await cloudinary.uploader.destroy(old.image_public_id);
    }

    const result = await db.execute(
      `UPDATE app.mosques
       SET name = $1, description = $2, image_url = $3, image_public_id = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, description, image_url ?? old.image_url, image_public_id ?? old.image_public_id, id, userId]
    );

    return res.json({ success: true, mosque: result.rows[0] });
  } catch (error) {
    console.error("Update mosque error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}

export async function deleteMosque(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const existing = await db.execute(
      "SELECT * FROM app.mosques WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (!existing.rows[0]) {
      return res.status(403).json({ success: false, message: "Yetkisiz" });
    }

    const mosque = existing.rows[0];

    if (mosque.image_public_id) {
      await cloudinary.uploader.destroy(mosque.image_public_id);
    }

    await db.execute(
      "DELETE FROM app.mosques WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete mosque error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}
