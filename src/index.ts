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
import hifzRoutes from "./modules/hifz/hifz.routes";
import assistantRoutes from "./modules/assistant/assistant.routes";
import { runGroupsMigration } from "./db/migrations/groups.migration";
import { runFamilyMigration } from "./db/migrations/family.migration";
import { runOzelGunMigration } from "./db/migrations/ozel_gun.migration";
import { runGoalsMigration } from "./db/migrations/goals.migration";
import { runHifzMigration } from "./db/migrations/hifz.migration";
import { authMiddleware } from "./middleware/auth.middleware";
import { query } from "./db";
import { initSentry, captureException } from "./services/sentry.service";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Hata izlemeyi her şeyden önce başlat (DSN yoksa no-op).
initSentry();

const app = express();

// Tek bir reverse proxy/load balancer arkasında çalışırken gerçek istemci
// IP'sini (X-Forwarded-For) güvenle okumak için — rate limiting buna dayanır.
app.set("trust proxy", 1);

// Migration: add image_public_id column if not exists
query(
  "ALTER TABLE app.mosques ADD COLUMN IF NOT EXISTS image_public_id TEXT"
).catch((e) => console.error("Migration error:", e));

runGroupsMigration().catch((e) => console.error("Groups migration error:", e));
runFamilyMigration().catch((e) => console.error("Family migration error:", e));
runOzelGunMigration().catch((e) => console.error("OzelGun migration error:", e));
runGoalsMigration().catch((e) => console.error("Goals migration error:", e));
runHifzMigration().catch((e) => console.error("Hifz migration error:", e));

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
app.use("/hifz", hifzRoutes);
app.use("/assistant", assistantRoutes);

const SERVER_START = Date.now();

// /health — liveness probe (process ayakta mı)
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "salah-api",
    runtime: "bun",
    uptime_seconds: Math.floor((Date.now() - SERVER_START) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// /health/ready — readiness probe (DB hazır mı)
app.get("/health/ready", async (_req: Request, res: Response) => {
  try {
    const start = Date.now();
    await query("SELECT 1");
    const dbMs = Date.now() - start;
    res.json({
      status: "ready",
      checks: { database: { ok: true, latency_ms: dbMs } },
      uptime_seconds: Math.floor((Date.now() - SERVER_START) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(503).json({
      status: "not_ready",
      checks: { database: { ok: false, error: e?.message ?? "unknown" } },
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/me", authMiddleware, (req, res) => {
  res.json({
    user: req.user,
  });
});

// Eşleşmeyen route'lar için 404 (tüm route'lardan sonra).
app.use(notFoundHandler);

// Merkezi hata yakalayıcı (en sonda olmalı).
app.use(errorHandler);

// Process seviyesinde yakalanmamış hatalar — log + Sentry.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  captureException(reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  captureException(err);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
