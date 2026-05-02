import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { listInbox, getInboxMessage } from "../lib/imap_client";

const router: IRouter = Router();

router.get("/inbox", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const limitRaw = req.query.limit;
  const mailbox = typeof req.query.mailbox === "string" ? req.query.mailbox : undefined;
  const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;
  try {
    const data = await listInbox({
      mailbox,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read inbox.";
    res.status(400).json({ message });
  }
});

router.get(
  "/inbox/:uid",
  requireAuth,
  requireRole(["admin"]),
  async (req, res): Promise<void> => {
    const uid = Number(req.params.uid);
    if (!Number.isFinite(uid) || uid <= 0) {
      res.status(400).json({ message: "Invalid uid." });
      return;
    }
    const mailbox = typeof req.query.mailbox === "string" ? req.query.mailbox : undefined;
    try {
      const data = await getInboxMessage(uid, { mailbox });
      if (!data) {
        res.status(404).json({ message: "Message not found." });
        return;
      }
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load message.";
      res.status(400).json({ message });
    }
  },
);

export default router;
