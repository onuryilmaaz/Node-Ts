import type { Request, Response } from "express";
import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/user/user.routes";
import adminRoutes from "./modules/admin/admin.routes";
import prayerRoutes from "./modules/prayer/prayer.routes";
import gamificationRoutes from "./modules/gamification/gamification.routes";
import challengeRoutes from "./modules/challenge/challenge.routes";
import mosqueRoutes from "./modules/mosque/mosque.routes";
import trackerRoutes from "./modules/tracker/tracker.routes";
import groupRoutes from "./modules/group/group.routes";
import familyRoutes from "./modules/family/family.routes";
import ozelGunRoutes from "./modules/ozel_gun/ozel_gun.routes";
import goalsRoutes from "./modules/goals/goals.routes";
import { runGroupsMigration } from "./db/migrations/groups.migration";
import { runFamilyMigration } from "./db/migrations/family.migration";
import { runOzelGunMigration } from "./db/migrations/ozel_gun.migration";
import { runGoalsMigration } from "./db/migrations/goals.migration";
import { authMiddleware } from "./middleware/auth.middleware";
import { sendEmail } from "./services/email.service";
import { query } from "./db";

const app = express();

// Migration: add image_public_id column if not exists
query(
  "ALTER TABLE app.mosques ADD COLUMN IF NOT EXISTS image_public_id TEXT"
).catch((e) => console.error("Migration error:", e));

runGroupsMigration().catch((e) => console.error("Groups migration error:", e));
runFamilyMigration().catch((e) => console.error("Family migration error:", e));
runOzelGunMigration().catch((e) => console.error("OzelGun migration error:", e));
runGoalsMigration().catch((e) => console.error("Goals migration error:", e));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/prayer", prayerRoutes);
app.use("/gamification", gamificationRoutes);
app.use("/challenges", challengeRoutes);
app.use("/mosques", mosqueRoutes);
app.use("/tracker", trackerRoutes);
app.use("/groups", groupRoutes);
app.use("/family", familyRoutes);
app.use("/ozel-gun", ozelGunRoutes);
app.use("/goals", goalsRoutes);

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    runtime: "bun",
    ts: true,
  });
});

app.post("/test-mail", async (req, res) => {
  await sendEmail({
    to: "onuryilm.41@gmail.com",
    subject: "Brevo Test Mail",
    html: "<h2>Mail başarıyla gönderildi 🚀</h2>",
  });

  res.json({ ok: true });
});

app.get("/me", authMiddleware, (req, res) => {
  res.json({
    user: req.user,
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
