import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { CreateVendorBody, UpdateVendorBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function vendorDto(v: typeof vendorsTable.$inferSelect) {
  return {
    id: v.id, code: v.code, name: v.name, gstin: v.gstin, pan: v.pan,
    contactPerson: v.contactPerson, email: v.email, phone: v.phone,
    addressLine: v.addressLine, city: v.city, state: v.state, pincode: v.pincode,
    bankName: v.bankName, bankAccountNo: v.bankAccountNo, ifscCode: v.ifscCode,
    category: v.category, rating: v.rating, notes: v.notes, isActive: v.isActive,
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

router.get("/vendors", requireAuth, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const isActiveQ = req.query.isActive;
  const filters: SQL[] = [];
  if (search) {
    const o = or(ilike(vendorsTable.name, `%${search}%`), ilike(vendorsTable.code, `%${search}%`));
    if (o) filters.push(o);
  }
  if (typeof isActiveQ === "string") filters.push(eq(vendorsTable.isActive, isActiveQ === "true"));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await db.select().from(vendorsTable).where(where).orderBy(desc(vendorsTable.id))
    : await db.select().from(vendorsTable).orderBy(desc(vendorsTable.id));
  res.json(rows.map(vendorDto));
});

router.post("/vendors", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [exists] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.code, d.code));
  if (exists) { res.status(409).json({ error: "Vendor code already exists" }); return; }
  const [row] = await db.insert(vendorsTable).values({
    code: d.code, name: d.name,
    gstin: d.gstin ?? null, pan: d.pan ?? null,
    contactPerson: d.contactPerson ?? null, email: d.email ?? null, phone: d.phone ?? null,
    addressLine: d.addressLine ?? null, city: d.city ?? null, state: d.state ?? null, pincode: d.pincode ?? null,
    bankName: d.bankName ?? null, bankAccountNo: d.bankAccountNo ?? null, ifscCode: d.ifscCode ?? null,
    category: d.category ?? null, rating: d.rating ?? null, notes: d.notes ?? null,
  }).returning();
  res.status(201).json(vendorDto(row));
});

router.get("/vendors/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(vendorDto(row));
});

router.patch("/vendors/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  for (const k of ["name","gstin","pan","contactPerson","email","phone","addressLine","city","state","pincode","bankName","bankAccountNo","ifscCode","category","rating","notes","isActive"] as const) {
    if (d[k] !== undefined && d[k] !== null) patch[k] = d[k];
  }
  await db.update(vendorsTable).set(patch).where(eq(vendorsTable.id, id));
  const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(vendorDto(row));
});

router.delete("/vendors/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(vendorsTable).set({ isActive: false, updatedAt: sql`now()` }).where(eq(vendorsTable.id, id));
  res.status(204).end();
});

export default router;
