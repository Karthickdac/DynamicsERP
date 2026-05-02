import { Router, type IRouter } from "express";
import { db, integrationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const KNOWN_PROVIDERS = ["mysticshr"];

function maskKey(k: string | null): string | null {
  if (!k) return null;
  if (k.length <= 4) return "****";
  return `${k.slice(0, 2)}${"*".repeat(Math.min(k.length - 4, 8))}${k.slice(-2)}`;
}

function dto(r: typeof integrationSettingsTable.$inferSelect) {
  return {
    id: r.id,
    provider: r.provider,
    enabled: r.enabled,
    baseUrl: r.baseUrl,
    apiKeyMasked: maskKey(r.apiKey),
    config: r.config,
    lastSyncAt: r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
    lastSyncStatus: r.lastSyncStatus,
    lastSyncMessage: r.lastSyncMessage,
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function ensureProvider(provider: string) {
  const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.provider, provider));
  if (row) return row;
  const [created] = await db.insert(integrationSettingsTable).values({ provider, enabled: false }).returning();
  return created;
}

router.get("/integrations", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  for (const p of KNOWN_PROVIDERS) await ensureProvider(p);
  const rows = await db.select().from(integrationSettingsTable);
  res.json(rows.map(dto));
});

router.get("/integrations/:provider", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const row = await ensureProvider(String(req.params.provider));
  res.json(dto(row));
});

router.put("/integrations/:provider", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const provider = String(req.params.provider);
  const existing = await ensureProvider(provider);
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (b.enabled !== undefined) update.enabled = !!b.enabled;
  if (b.baseUrl !== undefined) update.baseUrl = b.baseUrl;
  if (b.apiKey !== undefined && b.apiKey !== null && b.apiKey !== "") update.apiKey = b.apiKey;
  if (b.apiSecret !== undefined && b.apiSecret !== null && b.apiSecret !== "") update.apiSecret = b.apiSecret;
  if (b.config !== undefined) update.config = b.config;
  const [row] = await db.update(integrationSettingsTable).set(update).where(eq(integrationSettingsTable.id, existing.id)).returning();
  res.json(dto(row));
});

export default router;
