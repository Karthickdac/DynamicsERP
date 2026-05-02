import { db, notificationsTable, notificationPreferencesTable, pushSubscriptionsTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

export type EventCategory = "leads" | "sales" | "operations" | "billing" | "procurement" | "expenses";

export type EventType = {
  eventKey: string;
  label: string;
  category: EventCategory;
  description: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultPush: boolean;
};

export const EVENT_TYPES: EventType[] = [
  { eventKey: "lead.assigned", label: "Lead Assigned", category: "leads", description: "When a lead is assigned to you", defaultInApp: true, defaultEmail: true, defaultPush: true },
  { eventKey: "quotation.approval_required", label: "Quotation Approval Required", category: "sales", description: "A quotation needs your approval", defaultInApp: true, defaultEmail: true, defaultPush: true },
  { eventKey: "quotation.approved", label: "Quotation Approved", category: "sales", description: "A quotation you submitted was approved", defaultInApp: true, defaultEmail: true, defaultPush: false },
  { eventKey: "quotation.rejected", label: "Quotation Rejected", category: "sales", description: "A quotation you submitted was rejected", defaultInApp: true, defaultEmail: true, defaultPush: false },
  { eventKey: "invoice.sent", label: "Invoice Sent", category: "billing", description: "An invoice was sent to a customer", defaultInApp: true, defaultEmail: false, defaultPush: false },
  { eventKey: "payment.received", label: "Payment Received", category: "billing", description: "A customer payment was recorded", defaultInApp: true, defaultEmail: true, defaultPush: true },
  { eventKey: "po.approval_required", label: "PO Approval Required", category: "procurement", description: "A purchase order needs your approval", defaultInApp: true, defaultEmail: true, defaultPush: true },
  { eventKey: "expense.approval_required", label: "Expense Approval Required", category: "expenses", description: "An expense needs your approval", defaultInApp: true, defaultEmail: true, defaultPush: false },
  { eventKey: "expense.approved", label: "Expense Approved", category: "expenses", description: "Your expense was approved", defaultInApp: true, defaultEmail: true, defaultPush: false },
  { eventKey: "expense.rejected", label: "Expense Rejected", category: "expenses", description: "Your expense was rejected", defaultInApp: true, defaultEmail: true, defaultPush: false },
  { eventKey: "ticket.assigned", label: "Service Ticket Assigned", category: "operations", description: "A service ticket was assigned to you", defaultInApp: true, defaultEmail: true, defaultPush: true },
  { eventKey: "project.milestone_overdue", label: "Project Milestone Overdue", category: "operations", description: "A project milestone is overdue", defaultInApp: true, defaultEmail: true, defaultPush: false },
];

const EVENT_MAP = new Map(EVENT_TYPES.map(e => [e.eventKey, e]));

export function isEmailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

export function isPushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

async function resolvePref(userId: number, ev: EventType): Promise<{ inApp: boolean; email: boolean; push: boolean }> {
  const [row] = await db.select().from(notificationPreferencesTable)
    .where(and(eq(notificationPreferencesTable.userId, userId), eq(notificationPreferencesTable.eventKey, ev.eventKey)));
  if (row) return { inApp: row.inApp, email: row.email, push: row.push };
  return { inApp: ev.defaultInApp, email: ev.defaultEmail, push: ev.defaultPush };
}

async function sendEmailStub(to: string, subject: string, body: string): Promise<"sent" | "failed" | "skipped"> {
  if (!isEmailEnabled()) {
    logger.info({ to, subject }, "[email:skipped] SMTP not configured");
    return "skipped";
  }
  // Real SMTP send would go here. Logging instead.
  logger.info({ to, subject, body: body.slice(0, 200) }, "[email:sent]");
  return "sent";
}

async function sendPushStub(userId: number, payload: { title: string; body: string; link?: string | null }): Promise<"sent" | "failed" | "skipped" | "no_subscription"> {
  if (!isPushEnabled()) {
    logger.info({ userId, payload }, "[push:skipped] VAPID not configured");
    return "skipped";
  }
  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  if (subs.length === 0) return "no_subscription";
  // Real web-push send would go here.
  logger.info({ userId, payload, count: subs.length }, "[push:sent]");
  return "sent";
}

export type DispatchInput = {
  userIds: number[];
  eventKey: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: number | null;
};

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const ev = EVENT_MAP.get(input.eventKey);
  if (!ev) { logger.warn({ eventKey: input.eventKey }, "Unknown event key"); return; }
  if (input.userIds.length === 0) return;
  const users = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable).where(inArray(usersTable.id, input.userIds));
  for (const u of users) {
    const pref = await resolvePref(u.id, ev);
    let emailStatus: string | null = null;
    let pushStatus: string | null = null;
    if (pref.email) {
      emailStatus = await sendEmailStub(u.email, input.title, input.body ?? "");
    }
    if (pref.push) {
      pushStatus = await sendPushStub(u.id, { title: input.title, body: input.body ?? "", link: input.link });
    }
    if (pref.inApp) {
      await db.insert(notificationsTable).values({
        userId: u.id,
        eventKey: input.eventKey,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        emailStatus,
        pushStatus,
      });
    }
  }
}

// Fire-and-forget wrapper that won't break the calling request if notification fails.
export function dispatchSafe(input: DispatchInput): void {
  dispatchNotification(input).catch((err) => {
    logger.error({ err, eventKey: input.eventKey }, "dispatchNotification failed");
  });
}
