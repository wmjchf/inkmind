import { Router } from "express";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { createFeedback } from "../services/feedbackService";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const body = req.body || {};
    const content = typeof body.content === "string" ? body.content : "";
    const contact =
      body.contact === undefined || body.contact === null
        ? null
        : String(body.contact);
    const id = await createFeedback(userId, { content, contact });
    res.status(201).json({ id });
  })
);
