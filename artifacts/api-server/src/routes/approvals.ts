import { Router, type IRouter } from "express";
import { eq, and, desc, lte, gte, or, isNull, sql, type SQL } from "drizzle-orm";
import { db, approvalRulesTable, approvalRequestsTable, usersTable, quotationsTable } from "@workspace/db";
import { CreateApprovalRuleBody, UpdateApprovalRuleBody, ApproveApprovalRequestBody, RejectApprovalRequestBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function ruleDto(r: typeof approvalRulesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    entityType: r.entityType,
    minAmount: Number(r.minAmount),
    maxAmount: r.maxAmount != null ? Number(r.maxAmount) : null,
    approverRole: r.approverRole,
    level: r.level,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function evaluateAndCreateApprovalRequests(opts: {
  entityType: string; entityId: number; amount: number;
}): Promise<number> {
  const rules = await db.select().from(approvalRulesTable).where(
    and(
      eq(approvalRulesTable.entityType, opts.entityType),
      eq(approvalRulesTable.isActive, true),
      lte(approvalRulesTable.minAmount, String(opts.amount)),
    )!,
  );
  const matching = rules.filter(r => r.maxAmount == null || Number(r.maxAmount) >= opts.amount);
  matching.sort((a, b) => a.level - b.level);
  for (const rule of matching) {
    const approvers = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, rule.approverRole));
    const approverId = approvers[0]?.id ?? null;
    await db.insert(approvalRequestsTable).values({
      entityType: opts.entityType,
      entityId: opts.entityId,
      amount: String(opts.amount),
      ruleId: rule.id,
      approverRole: rule.approverRole,
      approverId,
      level: rule.level,
      status: "pending",
    });
    const eventKey = opts.entityType === "purchase_order" ? "po.approval_required" : "quotation.approval_required";
    const recipientIds = approvers.map(a => a.id);
    if (recipientIds.length > 0) {
      const link = opts.entityType === "purchase_order" ? `/purchase-orders/${opts.entityId}` : `/quotations/${opts.entityId}`;
      dispatchSafe({
        userIds: recipientIds,
        eventKey,
        title: opts.entityType === "purchase_order" ? "Purchase Order needs approval" : "Quotation needs approval",
        body: `Amount: ₹${opts.amount.toFixed(2)} — your approval is required.`,
        link,
        entityType: opts.entityType,
        entityId: opts.entityId,
      });
    }
  }
  return matching.length;
}

router.get("/approval-rules", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(approvalRulesTable).orderBy(approvalRulesTable.level);
  res.json(rows.map(ruleDto));
});

router.post("/approval-rules", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateApprovalRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(approvalRulesTable).values({
    name: d.name, entityType: d.entityType,
    minAmount: String(d.minAmount),
    maxAmount: d.maxAmount != null ? String(d.maxAmount) : null,
    approverRole: d.approverRole,
    level: d.level,
    isActive: d.isActive ?? true,
  }).returning();
  res.status(201).json(ruleDto(row));
});

router.patch("/approval-rules/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateApprovalRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  await db.update(approvalRulesTable).set({
    name: d.name, entityType: d.entityType,
    minAmount: String(d.minAmount),
    maxAmount: d.maxAmount != null ? String(d.maxAmount) : null,
    approverRole: d.approverRole,
    level: d.level,
    isActive: d.isActive ?? true,
  }).where(eq(approvalRulesTable.id, id));
  const [row] = await db.select().from(approvalRulesTable).where(eq(approvalRulesTable.id, id));
  res.json(ruleDto(row));
});

router.delete("/approval-rules/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(approvalRulesTable).where(eq(approvalRulesTable.id, id));
  res.status(204).end();
});

router.get("/approval-requests", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const assignedToMe = req.query.assignedToMe === "true";
  const filters: SQL[] = [];
  if (status) filters.push(eq(approvalRequestsTable.status, status));
  if (assignedToMe && req.user) {
    const orClause = or(
      eq(approvalRequestsTable.approverId, req.user.id),
      and(isNull(approvalRequestsTable.approverId), eq(approvalRequestsTable.approverRole, req.user.role)),
    );
    if (orClause) filters.push(orClause);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = db
    .select({
      id: approvalRequestsTable.id,
      entityType: approvalRequestsTable.entityType,
      entityId: approvalRequestsTable.entityId,
      amount: approvalRequestsTable.amount,
      ruleId: approvalRequestsTable.ruleId,
      ruleName: approvalRulesTable.name,
      approverRole: approvalRequestsTable.approverRole,
      approverId: approvalRequestsTable.approverId,
      approverFirst: usersTable.firstName,
      approverLast: usersTable.lastName,
      level: approvalRequestsTable.level,
      status: approvalRequestsTable.status,
      comments: approvalRequestsTable.comments,
      actionedAt: approvalRequestsTable.actionedAt,
      createdAt: approvalRequestsTable.createdAt,
      quotationTitle: quotationsTable.title,
    })
    .from(approvalRequestsTable)
    .leftJoin(approvalRulesTable, eq(approvalRulesTable.id, approvalRequestsTable.ruleId))
    .leftJoin(usersTable, eq(usersTable.id, approvalRequestsTable.approverId))
    .leftJoin(quotationsTable, and(eq(approvalRequestsTable.entityType, "quotation"), eq(quotationsTable.id, approvalRequestsTable.entityId)));
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(approvalRequestsTable.createdAt))
    : await baseQuery.orderBy(desc(approvalRequestsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    entityTitle: r.quotationTitle,
    amount: Number(r.amount),
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    approverRole: r.approverRole,
    approverId: r.approverId,
    approverName: r.approverFirst ? `${r.approverFirst} ${r.approverLast ?? ""}`.trim() : null,
    level: r.level,
    status: r.status,
    comments: r.comments,
    actionedAt: r.actionedAt ? r.actionedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  })));
});

async function actOnRequest(reqId: number, userId: number | null, userRole: string | null, decision: "approved" | "rejected", comments: string | null) {
  const [req] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, reqId)).limit(1);
  if (!req) return { error: "Not found", status: 404 as const };
  if (req.status !== "pending") return { error: "Already actioned", status: 400 as const };
  if (req.approverId != null && userId != null && req.approverId !== userId) {
    if (userRole !== "admin") return { error: "Not your approval", status: 403 as const };
  }
  if (req.approverId == null && userRole && req.approverRole !== userRole && userRole !== "admin") {
    return { error: "Role not permitted", status: 403 as const };
  }
  await db.update(approvalRequestsTable).set({
    status: decision,
    comments: comments ?? null,
    approverId: req.approverId ?? userId,
    actionedAt: sql`now()`,
  }).where(eq(approvalRequestsTable.id, reqId));
  if (req.entityType === "quotation") {
    if (decision === "rejected") {
      await db.update(quotationsTable).set({ status: "rejected", updatedAt: sql`now()` }).where(eq(quotationsTable.id, req.entityId));
      const [q] = await db.select({ createdById: quotationsTable.createdById, title: quotationsTable.title })
        .from(quotationsTable).where(eq(quotationsTable.id, req.entityId));
      if (q?.createdById) {
        dispatchSafe({
          userIds: [q.createdById], eventKey: "quotation.rejected",
          title: `Quotation rejected: ${q.title ?? `#${req.entityId}`}`,
          body: comments ?? "Your quotation has been rejected.",
          link: `/quotations/${req.entityId}`, entityType: "quotation", entityId: req.entityId,
        });
      }
    } else {
      const remaining = await db.select().from(approvalRequestsTable).where(
        and(
          eq(approvalRequestsTable.entityType, "quotation"),
          eq(approvalRequestsTable.entityId, req.entityId),
          eq(approvalRequestsTable.status, "pending"),
        )!,
      );
      if (remaining.length === 0) {
        await db.update(quotationsTable).set({ status: "approved", updatedAt: sql`now()` }).where(eq(quotationsTable.id, req.entityId));
        const [q] = await db.select({ createdById: quotationsTable.createdById, title: quotationsTable.title })
          .from(quotationsTable).where(eq(quotationsTable.id, req.entityId));
        if (q?.createdById) {
          dispatchSafe({
            userIds: [q.createdById], eventKey: "quotation.approved",
            title: `Quotation approved: ${q.title ?? `#${req.entityId}`}`,
            body: "All approvals complete — you can now send this quotation.",
            link: `/quotations/${req.entityId}`, entityType: "quotation", entityId: req.entityId,
          });
        }
      }
    }
  }
  const [row] = await db.select().from(approvalRequestsTable).where(eq(approvalRequestsTable.id, reqId));
  return { row };
}

router.post("/approval-requests/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ApproveApprovalRequestBody.safeParse(req.body ?? {});
  const comments = parsed.success ? (parsed.data.comments ?? null) : null;
  const result = await actOnRequest(id, req.user?.id ?? null, req.user?.role ?? null, "approved", comments);
  if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
  res.json({
    id: result.row.id, entityType: result.row.entityType, entityId: result.row.entityId,
    amount: Number(result.row.amount), approverRole: result.row.approverRole,
    approverId: result.row.approverId, level: result.row.level, status: result.row.status,
    comments: result.row.comments,
    actionedAt: result.row.actionedAt ? result.row.actionedAt.toISOString() : null,
    createdAt: result.row.createdAt.toISOString(),
  });
});

router.post("/approval-requests/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RejectApprovalRequestBody.safeParse(req.body ?? {});
  const comments = parsed.success ? (parsed.data.comments ?? null) : null;
  const result = await actOnRequest(id, req.user?.id ?? null, req.user?.role ?? null, "rejected", comments);
  if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
  res.json({
    id: result.row.id, entityType: result.row.entityType, entityId: result.row.entityId,
    amount: Number(result.row.amount), approverRole: result.row.approverRole,
    approverId: result.row.approverId, level: result.row.level, status: result.row.status,
    comments: result.row.comments,
    actionedAt: result.row.actionedAt ? result.row.actionedAt.toISOString() : null,
    createdAt: result.row.createdAt.toISOString(),
  });
});

export default router;
