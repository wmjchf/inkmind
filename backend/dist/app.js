"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./routes/auth");
const me_1 = require("./routes/me");
const entries_1 = require("./routes/entries");
const stats_1 = require("./routes/stats");
const tags_1 = require("./routes/tags");
const ocr_1 = require("./routes/ocr");
const feedback_1 = require("./routes/feedback");
const requireAuth_1 = require("./middleware/requireAuth");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: "2mb" }));
    app.get("/health", (_req, res) => {
        res.json({ ok: true, service: "inkmind-backend" });
    });
    app.use("/api/v1/auth", auth_1.authRouter);
    app.use("/api/v1/me", me_1.meRouter);
    app.use("/api/v1/entries", entries_1.entriesRouter);
    app.use("/api/v1/stats", stats_1.statsRouter);
    app.use("/api/v1/tags", tags_1.tagsRouter);
    app.use("/api/v1/ocr", ocr_1.ocrRouter);
    app.use("/api/v1/feedback", feedback_1.feedbackRouter);
    app.use(requireAuth_1.errorMiddleware);
    return app;
}
