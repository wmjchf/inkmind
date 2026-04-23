import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { entriesRouter } from "./routes/entries";
import { statsRouter } from "./routes/stats";
import { tagsRouter } from "./routes/tags";
import { errorMiddleware } from "./middleware/requireAuth";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "inkmind-backend" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/me", meRouter);
  app.use("/api/v1/entries", entriesRouter);
  app.use("/api/v1/stats", statsRouter);
  app.use("/api/v1/tags", tagsRouter);

  app.use(errorMiddleware);
  return app;
}
