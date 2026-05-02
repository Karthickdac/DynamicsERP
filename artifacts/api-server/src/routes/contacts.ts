import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, type SQL } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import { CreateContactBody, UpdateContactBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function toDto(c: typeof contactsTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

router.get("/contacts", requireAuth, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const accountIdParam = req.query.accountId;
  const accountId = accountIdParam ? Number(accountIdParam) : NaN;

  const filters: SQL[] = [];
  if (Number.isFinite(accountId)) filters.push(eq(contactsTable.accountId, accountId));
  if (search) {
    const orClause = or(
      ilike(contactsTable.firstName, `%${search}%`),
      ilike(contactsTable.lastName, `%${search}%`),
      ilike(contactsTable.email, `%${search}%`),
    );
    if (orClause) filters.push(orClause);
  }
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await db.select().from(contactsTable).where(where).orderBy(desc(contactsTable.createdAt))
    : await db.select().from(contactsTable).orderBy(desc(contactsTable.createdAt));
  res.json(rows.map(toDto));
});

router.post("/contacts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contactsTable).values({
    ...parsed.data,
    isPrimary: parsed.data.isPrimary ?? false,
  }).returning();
  res.status(201).json(toDto(row));
});

router.get("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.patch("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(contactsTable).set(parsed.data).where(eq(contactsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.delete("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  res.status(204).end();
});

export default router;
