import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, type SQL } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function productDto(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    unitPrice: Number(p.unitPrice),
    gstRate: Number(p.gstRate),
    hsnCode: p.hsnCode,
    manufacturer: p.manufacturer,
    wattage: p.wattage != null ? Number(p.wattage) : null,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const filters: SQL[] = [];
  if (category) filters.push(eq(productsTable.category, category));
  if (search) {
    const orClause = or(
      ilike(productsTable.name, `%${search}%`),
      ilike(productsTable.sku, `%${search}%`),
      ilike(productsTable.manufacturer, `%${search}%`),
    );
    if (orClause) filters.push(orClause);
  }
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt))
    : await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(rows.map(productDto));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const [row] = await db.insert(productsTable).values({
      sku: d.sku, name: d.name, category: d.category,
      description: d.description ?? null,
      unit: d.unit,
      unitPrice: String(d.unitPrice),
      gstRate: String(d.gstRate),
      hsnCode: d.hsnCode ?? null,
      manufacturer: d.manufacturer ?? null,
      wattage: d.wattage != null ? String(d.wattage) : null,
      isActive: d.isActive ?? true,
    }).returning();
    res.status(201).json(productDto(row));
  } catch (e) {
    res.status(409).json({ error: "SKU already exists" });
  }
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(productDto(row));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  await db.update(productsTable).set({
    sku: d.sku, name: d.name, category: d.category,
    description: d.description ?? null,
    unit: d.unit,
    unitPrice: String(d.unitPrice),
    gstRate: String(d.gstRate),
    hsnCode: d.hsnCode ?? null,
    manufacturer: d.manufacturer ?? null,
    wattage: d.wattage != null ? String(d.wattage) : null,
    isActive: d.isActive ?? true,
  }).where(eq(productsTable.id, id));
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  res.json(productDto(row));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).end();
});

export default router;
