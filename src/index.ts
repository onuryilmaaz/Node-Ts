import type { Request, Response } from "express";
import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/user/user.routes";
import adminRoutes from "./modules/admin/admin.routes";
import { authMiddleware } from "./middleware/auth.middleware";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    runtime: "bun",
    ts: true,
  });
});

app.get("/me", authMiddleware, (req, res) => {
  res.json({
    user: req.user,
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
