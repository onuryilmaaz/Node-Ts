import fs from "fs";
import path from "path";

export function buildFileUrl(filePath: string) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return `${baseUrl}/${filePath.replace(/\\/g, "/")}`;
}

export function deleteLocalFile(fileUrl?: string | null) {
  if (!fileUrl) return;

  const uploadsIndex = fileUrl.indexOf("/uploads/");
  if (uploadsIndex === -1) return;

  const relativePath = fileUrl.slice(uploadsIndex + 1);
  const fullPath = path.join(process.cwd(), relativePath);

  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}
