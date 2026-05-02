import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db, purchaseOrdersTable, vendorInvoicesTable, expensesTable, vendorsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/procurement/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const pos = await db.select({
    id: purchaseOrdersTable.id, status: purchaseOrdersTable.status, total: purchaseOrdersTable.total,
    vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name,
  }).from(purchaseOrdersTable)
    .leftJoin(vendorsTable, eq(vendorsTable.id, purchaseOrdersTable.vendorId));
  let totalPoValue = 0, totalPoCount = 0, pendingApprovalCount = 0, inTransitValue = 0;
  const byVendor = new Map<number, { vendorId: number; vendorName: string; totalValue: number; poCount: number }>();
  for (const p of pos) {
    if (p.status === "cancelled") continue;
    totalPoValue += Number(p.total);
    totalPoCount += 1;
    if (p.status === "pending_approval") pendingApprovalCount += 1;
    if (p.status === "sent" || p.status === "partially_received") inTransitValue += Number(p.total);
    const v = byVendor.get(p.vendorId) ?? { vendorId: p.vendorId, vendorName: p.vendorName ?? "Unknown", totalValue: 0, poCount: 0 };
    v.totalValue += Number(p.total);
    v.poCount += 1;
    byVendor.set(p.vendorId, v);
  }

  const vis = await db.select({ amount: vendorInvoicesTable.amount, paidAmount: vendorInvoicesTable.paidAmount, status: vendorInvoicesTable.status })
    .from(vendorInvoicesTable);
  let vendorPayables = 0;
  for (const v of vis) {
    if (v.status === "paid") continue;
    vendorPayables += Math.max(0, Number(v.amount) - Number(v.paidAmount));
  }

  const exps = await db.select({ status: expensesTable.status, amount: expensesTable.amount, category: expensesTable.category }).from(expensesTable);
  let expenseTotal = 0, expensePendingCount = 0, expenseApprovedCount = 0;
  const byCat = new Map<string, number>();
  for (const e of exps) {
    if (e.status === "rejected" || e.status === "draft") {} else expenseTotal += Number(e.amount);
    if (e.status === "submitted") expensePendingCount += 1;
    if (e.status === "approved" || e.status === "reimbursed") expenseApprovedCount += 1;
    if (e.status !== "draft" && e.status !== "rejected") {
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
    }
  }

  res.json({
    totalPoValue: +totalPoValue.toFixed(2),
    totalPoCount,
    pendingApprovalCount,
    inTransitValue: +inTransitValue.toFixed(2),
    vendorPayables: +vendorPayables.toFixed(2),
    expenseTotal: +expenseTotal.toFixed(2),
    expensePendingCount,
    expenseApprovedCount,
    topVendors: Array.from(byVendor.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5)
      .map(v => ({ ...v, totalValue: +v.totalValue.toFixed(2) })),
    expenseByCategory: Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount: +amount.toFixed(2) })),
  });
});

export default router;
