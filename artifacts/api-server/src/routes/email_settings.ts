import { Router, type IRouter } from "express";
import { db, emailSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { deliverEmail, verifyEmailTransport, invalidateEmailSettingsCache } from "../lib/email_transport";

const router: IRouter = Router();

function dto(r: typeof emailSettingsTable.$inferSelect) {
  return {
    id: r.id,
    provider: r.provider,
    smtpHost: r.smtpHost,
    smtpPort: r.smtpPort,
    smtpSecure: r.smtpSecure,
    smtpUser: r.smtpUser,
    smtpPasswordSet: Boolean(r.smtpPassword),
    smtpFrom: r.smtpFrom,
    smtpFromName: r.smtpFromName,
    resendApiKeySet: Boolean(r.resendApiKey),
    resendFrom: r.resendFrom,
    resendFromName: r.resendFromName,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SINGLETON_ID = 1;

export async function ensureEmailSettings() {
  // Atomic singleton: always upsert id=1 with DO NOTHING so concurrent first
  // requests can't create duplicate rows. Then read by the fixed id.
  await db
    .insert(emailSettingsTable)
    .values({ id: SINGLETON_ID, provider: "none" })
    .onConflictDoNothing({ target: emailSettingsTable.id });
  const rows = await db
    .select()
    .from(emailSettingsTable)
    .where(eq(emailSettingsTable.id, SINGLETON_ID))
    .limit(1);
  return rows[0];
}

router.get("/email-settings", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  const row = await ensureEmailSettings();
  res.json(dto(row));
});

router.put("/email-settings", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const existing = await ensureEmailSettings();
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof b.provider === "string" && ["smtp", "resend", "none"].includes(b.provider)) {
    update.provider = b.provider;
  }
  for (const k of [
    "smtpHost", "smtpUser", "smtpFrom", "smtpFromName",
    "resendFrom", "resendFromName",
  ]) {
    if (b[k] !== undefined) update[k] = b[k] === "" ? null : b[k];
  }
  if (b.smtpPort !== undefined) {
    update.smtpPort = b.smtpPort === null || b.smtpPort === "" ? null : Number(b.smtpPort);
  }
  if (b.smtpSecure !== undefined) update.smtpSecure = Boolean(b.smtpSecure);

  // Secret fields: only update when client explicitly sends a non-empty string,
  // OR sends null to clear. Empty string / undefined => leave as-is so the masked
  // GET response can be re-submitted without wiping credentials.
  if (b.smtpPassword === null) update.smtpPassword = null;
  else if (typeof b.smtpPassword === "string" && b.smtpPassword.length > 0) {
    update.smtpPassword = b.smtpPassword;
  }
  if (b.resendApiKey === null) update.resendApiKey = null;
  else if (typeof b.resendApiKey === "string" && b.resendApiKey.length > 0) {
    update.resendApiKey = b.resendApiKey;
  }

  const [row] = await db
    .update(emailSettingsTable)
    .set(update)
    .where(eq(emailSettingsTable.id, existing.id))
    .returning();
  invalidateEmailSettingsCache();
  res.json(dto(row));
});

router.post(
  "/email-settings/test",
  requireAuth,
  requireRole(["admin"]),
  async (req, res): Promise<void> => {
    const recipient = typeof req.body?.recipient === "string" ? req.body.recipient.trim() : "";
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      res.status(400).json({ ok: false, provider: "none", message: "A valid recipient email is required." });
      return;
    }
    const verify = await verifyEmailTransport();
    if (!verify.ok) {
      res.json({ ok: false, provider: verify.provider, message: verify.message });
      return;
    }
    const result = await deliverEmail({
      to: [recipient],
      subject: "DynamicsERP — test email",
      body:
        "This is a test message from DynamicsERP confirming your email settings are working.\n\n" +
        "If you received this, outbound email delivery is configured correctly.",
    });
    res.json({
      ok: result.status === "sent",
      provider: result.provider,
      message: result.message,
    });
  },
);

export default router;
