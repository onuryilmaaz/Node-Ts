import multer from "multer";
import path from "path";
import fs from "fs";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    let baseDir = "uploads";

    if (file.fieldname === "avatar") baseDir = "uploads/avatars";

    ensureDir(baseDir);
    cb(null, baseDir);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    cb(null, filename);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
