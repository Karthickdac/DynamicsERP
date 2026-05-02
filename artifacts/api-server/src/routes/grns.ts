import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import {
  db, goodsReceiptsTable, grnLineItemsTable, purchaseOrdersTable, poLineItemsTable, vendorsTable, usersTable,
} from "@workspace/db";
import { CreateGrnBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const grnSelect = {
  id: goodsReceiptsTable.id,
  grnNumber: goodsReceiptsTable.grnNumber,
  purchaseOrderId: goodsReceiptsTable.purchaseOrderId,
  poNumber: purchaseOrdersTable.poNumber,
  vendorId: goodsReceiptsTable.vendorId,
  vendorName: vendorsTable.name,
  receivedDate: goodsReceiptsTable.receivedDate,
  receivedById: goodsReceiptsTable.receivedById,
  receivedByFirst: usersTable.firstName,
  receivedByLast: usersTable.lastName,
  status: goodsReceiptsTable.status,
  notes: goodsReceiptsTable.notes,
  createdAt: goodsReceiptsTable.createdAt,
};

function selectGrn() {
  return db.select(grnSelect).from(goodsReceiptsTable)
    .leftJoin(purchaseOrdersTable, eq(purchaseOrdersTable.id, goodsReceiptsTable.purchaseOrderId))
    .leftJoin(vendorsTable, eq(vendorsTable.id, goodsReceiptsTable.vendorId))
    .leftJoin(usersTable, eq(usersTable.id, goodsReceiptsTable.receivedById));
}

function grnDto(g: Awaited<ReturnType<typeof selectGrn>>[number]) {
  return {
    id: g.id, grnNumber: g.grnNumber,
    purchaseOrderId: g.purchaseOrderId, poNumber: g.poNumber,
    vendorId: g.vendorId, vendorName: g.vendorName,
    receivedDate: g.receivedDate, receivedById: g.receivedById,
    receivedByName: g.receivedByFirst ? `${g.receivedByFirst} ${g.receivedByLast ?? ""}`.trim() : null,
    status: g.status, notes: g.notes,
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/grns", requireAuth, async (req, res): Promise<void> => {
  const poId = req.query.purchaseOrderId ? Number(req.query.purchaseOrderId) : NaN;
  const filters: SQL[] = [];
  if (Number.isFinite(poId)) filters.push(eq(goodsReceiptsTable.purchaseOrderId, poId));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await selectGrn().where(where).orderBy(desc(goodsReceiptsTable.receivedDate), desc(goodsReceiptsTable.id))
    : await selectGrn().orderBy(desc(goodsReceiptsTable.receivedDate), desc(goodsReceiptsTable.id));
  res.json(rows.map(grnDto));
});

router.post("/grns", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGrnBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const newId = await db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT id, status, vendor_id FROM ${purchaseOrdersTable} WHERE id = ${d.purchaseOrderId} FOR UPDATE`,
      );
      const lockedRows = ((lockResult as any).rows ?? lockResult) as Array<{ id: number; status: string; vendor_id: number }>;
      const po = lockedRows[0];
      if (!po) { const e = new Error("po_not_found"); (e as any).code = 404; throw e; }
      if (!["sent", "partially_received", "approved"].includes(po.status)) {
        const e = new Error(`Cannot record GRN on ${po.status} PO`); (e as any).code = 409; throw e;
      }
      const poLines = await tx.select().from(poLineItemsTable).where(eq(poLineItemsTable.purchaseOrderId, d.purchaseOrderId));
      const linesById = new Map(poLines.map(l => [l.id, l]));
      // Validate each receipt does not exceed remaining
      for (const line of d.lines) {
        const pol = linesById.get(line.poLineItemId);
        if (!pol) { const e = new Error(`PO line ${line.poLineItemId} not found`); (e as any).code = 400; throw e; }
        const remaining = Number(pol.quantity) - Number(pol.receivedQuantity);
        if (line.quantity <= 0) { const e = new Error("Receipt quantity must be > 0"); (e as any).code = 400; throw e; }
        if (line.quantity > remaining + 0.001) { const e = new Error(`Receipt for line ${pol.productName} exceeds remaining (${remaining})`); (e as any).code = 400; throw e; }
      }
      const grnNumber = await nextDocNumber(tx, "GRN", goodsReceiptsTable, goodsReceiptsTable.grnNumber);
      const [grnRow] = await tx.insert(goodsReceiptsTable).values({
        grnNumber,
        purchaseOrderId: d.purchaseOrderId,
        vendorId: po.vendor_id,
        receivedDate: d.receivedDate ? new Date(d.receivedDate).toISOString().slice(0, 10) : today,
        receivedById: req.user?.id ?? null,
        notes: d.notes ?? null,
        status: "partial",
      }).returning({ id: goodsReceiptsTable.id });
      // Insert GRN lines and update PO line received quantities
      for (const line of d.lines) {
        await tx.insert(grnLineItemsTable).values({
          grnId: grnRow.id, poLineItemId: line.poLineItemId, quantity: String(line.quantity),
        });
        await tx.update(poLineItemsTable)
          .set({ receivedQuantity: sql`${poLineItemsTable.receivedQuantity} + ${line.quantity}` })
          .where(eq(poLineItemsTable.id, line.poLineItemId));
      }
      // Determine if PO is now fully received vs partially
      const updated = await tx.select().from(poLineItemsTable).where(eq(poLineItemsTable.purchaseOrderId, d.purchaseOrderId));
      const allReceived = updated.every(l => Number(l.receivedQuantity) >= Number(l.quantity) - 0.001);
      const newPoStatus = allReceived ? "received" : "partially_received";
      await tx.update(purchaseOrdersTable).set({ status: newPoStatus, updatedAt: sql`now()` }).where(eq(purchaseOrdersTable.id, d.purchaseOrderId));
      // GRN status: full if this GRN completes, otherwise partial
      if (allReceived) {
        await tx.update(goodsReceiptsTable).set({ status: "received" }).where(eq(goodsReceiptsTable.id, grnRow.id));
      }
      return grnRow.id;
    });
    res.status(201).json(await fetchGrnDetail(newId));
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Purchase order not found" }); return; }
    if (err?.code === 409) { res.status(409).json({ error: err.message }); return; }
    if (err?.code === 400) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});

async function fetchGrnDetail(id: number) {
  const [head] = await selectGrn().where(eq(goodsReceiptsTable.id, id));
  if (!head) return null;
  const lines = await db.select({
    id: grnLineItemsTable.id,
    grnId: grnLineItemsTable.grnId,
    poLineItemId: grnLineItemsTable.poLineItemId,
    quantity: grnLineItemsTable.quantity,
    productName: poLineItemsTable.productName,
  }).from(grnLineItemsTable)
    .leftJoin(poLineItemsTable, eq(poLineItemsTable.id, grnLineItemsTable.poLineItemId))
    .where(eq(grnLineItemsTable.grnId, id));
  return {
    ...grnDto(head),
    lineItems: lines.map(l => ({ id: l.id, grnId: l.grnId, poLineItemId: l.poLineItemId, productName: l.productName, quantity: Number(l.quantity) })),
  };
}

router.get("/grns/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const detail = await fetchGrnDetail(id);
  if (!detail) { res.status(404).json({ error: "Not found" }); return; }
  res.json(detail);
});

export default router;
