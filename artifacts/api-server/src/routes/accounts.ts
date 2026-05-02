import { Router, type IRouter } from "express";
import { eq, ilike, or, desc } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import { CreateAccountBody, UpdateAccountBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function toDto(a: typeof accountsTable.$inferSelect) {
  return { ...a, createdAt: a.createdAt.toISOString() };
}

router.get("/accounts", requireAuth, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = search
    ? await db
        .select()
        .from(accountsTable)
        .where(
          or(
            ilike(accountsTable.name, `%${search}%`),
            ilike(accountsTable.billingCity, `%${search}%`),
            ilike(accountsTable.gstin, `%${search}%`),
          ),
        )
        .orderBy(desc(accountsTable.createdAt))
    : await db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt));
  res.json(rows.map(toDto));
});

router.post("/accounts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(accountsTable).values(parsed.data).returning();
  res.status(201).json(toDto(row));
});

router.get("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(accountsTable).where(eq(accountsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.patch("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(accountsTable)
    .set(parsed.data)
    .where(eq(accountsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.delete("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.status(204).end();
});

export default router;
