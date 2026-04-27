"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../middleware/requireAuth");
const feedbackService_1 = require("../services/feedbackService");
exports.feedbackRouter = (0, express_1.Router)();
exports.feedbackRouter.use(requireAuth_1.requireAuth);
exports.feedbackRouter.post("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const body = req.body || {};
    const content = typeof body.content === "string" ? body.content : "";
    const contact = body.contact === undefined || body.contact === null
        ? null
        : String(body.contact);
    const id = await (0, feedbackService_1.createFeedback)(userId, { content, contact });
    res.status(201).json({ id });
}));
