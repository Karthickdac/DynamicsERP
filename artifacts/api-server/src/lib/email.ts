import { db, emailLogTable, emailTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { ensureCompanySettings } from "../routes/company_settings";
import { deliverEmail, isEmailDeliveryEnabled } from "./email_transport";
import {
  accountsTable, contactsTable, leadsTable, quotationsTable, quotationLineItemsTable,
  salesOrdersTable, projectsTable, invoicesTable, invoiceLineItemsTable, paymentsTable,
  vendorsTable, purchaseOrdersTable, poLineItemsTable, vendorInvoicesTable, expensesTable,
} from "@workspace/db";

export type EmailContext = Record<string, string | number | null | undefined>;

export function isSmtpEnabled(): boolean {
  return isEmailDeliveryEnabled();
}

export function renderTemplate(text: string, ctx: EmailContext): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

function formatINR(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function buildEntityContext(entityType: string | null | undefined, entityId: number | null | undefined): Promise<{ ctx: EmailContext; suggestedTo: string[] }> {
  const company = await ensureCompanySettings();
  const ctx: EmailContext = {
    "company.name": company.name,
    "company.email": company.email ?? "",
    "company.phone": company.phone ?? "",
    "company.website": company.website ?? "",
    "company.gstin": company.gstin ?? "",
    "company.address": [company.addressLine1, company.addressLine2, company.city, company.state, company.pincode].filter(Boolean).join(", "),
    "company.bankName": company.bankName ?? "",
    "company.bankAccountNo": company.bankAccountNo ?? "",
    "company.bankIfsc": company.bankIfsc ?? "",
  };
  const suggestedTo: string[] = [];
  if (!entityType || !entityId) return { ctx, suggestedTo };

  try {
    if (entityType === "invoice") {
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, entityId));
      if (inv) {
        const [acc] = inv.accountId ? await db.select().from(accountsTable).where(eq(accountsTable.id, inv.accountId)) : [undefined];
        ctx["invoice.number"] = inv.invoiceNumber;
        ctx["invoice.date"] = formatDate(inv.invoiceDate);
        ctx["invoice.dueDate"] = formatDate(inv.dueDate);
        ctx["invoice.total"] = formatINR(inv.total);
        ctx["invoice.balance"] = formatINR(Number(inv.total) - Number(inv.paidAmount ?? 0));
        ctx["invoice.status"] = inv.status;
        ctx["customer.name"] = acc?.name ?? "";
        if (acc?.email) suggestedTo.push(acc.email);
      }
    } else if (entityType === "quotation") {
      const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, entityId));
      if (q) {
        const [acc] = q.accountId ? await db.select().from(accountsTable).where(eq(accountsTable.id, q.accountId)) : [undefined];
        ctx["quotation.number"] = q.quotationNumber;
        ctx["quotation.date"] = formatDate(q.createdAt);
        ctx["quotation.validUntil"] = formatDate(q.validUntil);
        ctx["quotation.total"] = formatINR(q.total);
        ctx["quotation.status"] = q.status;
        ctx["customer.name"] = acc?.name ?? "";
        if (acc?.email) suggestedTo.push(acc.email);
      }
    } else if (entityType === "sales_order") {
      const [so] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, entityId));
      if (so) {
        const [acc] = so.accountId ? await db.select().from(accountsTable).where(eq(accountsTable.id, so.accountId)) : [undefined];
        ctx["order.number"] = so.orderNumber;
        ctx["order.date"] = formatDate(so.orderDate);
        ctx["order.total"] = formatINR(so.total);
        ctx["order.status"] = so.status;
        ctx["customer.name"] = acc?.name ?? "";
        if (acc?.email) suggestedTo.push(acc.email);
      }
    } else if (entityType === "purchase_order") {
      const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, entityId));
      if (po) {
        const [v] = po.vendorId ? await db.select().from(vendorsTable).where(eq(vendorsTable.id, po.vendorId)) : [undefined];
        ctx["po.number"] = po.poNumber;
        ctx["po.date"] = formatDate(po.orderDate);
        ctx["po.total"] = formatINR(po.total);
        ctx["po.status"] = po.status;
        ctx["vendor.name"] = v?.name ?? "";
        if (v?.email) suggestedTo.push(v.email);
      }
    } else if (entityType === "vendor_invoice") {
      const [vi] = await db.select().from(vendorInvoicesTable).where(eq(vendorInvoicesTable.id, entityId));
      if (vi) {
        const [v] = vi.vendorId ? await db.select().from(vendorsTable).where(eq(vendorsTable.id, vi.vendorId)) : [undefined];
        ctx["vendorInvoice.number"] = vi.vendorInvoiceNumber;
        ctx["vendorInvoice.date"] = formatDate(vi.invoiceDate);
        ctx["vendorInvoice.total"] = formatINR(vi.amount);
        ctx["vendorInvoice.status"] = vi.status;
        ctx["vendor.name"] = v?.name ?? "";
        if (v?.email) suggestedTo.push(v.email);
      }
    } else if (entityType === "payment") {
      const [pay] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, entityId));
      if (pay) {
        const [inv] = pay.invoiceId ? await db.select().from(invoicesTable).where(eq(invoicesTable.id, pay.invoiceId)) : [undefined];
        const [acc] = inv?.accountId ? await db.select().from(accountsTable).where(eq(accountsTable.id, inv.accountId)) : [undefined];
        ctx["payment.amount"] = formatINR(pay.amount);
        ctx["payment.date"] = formatDate(pay.paymentDate);
        ctx["payment.mode"] = pay.paymentMode;
        ctx["payment.reference"] = pay.referenceNumber ?? "";
        ctx["invoice.number"] = inv?.invoiceNumber ?? "";
        ctx["customer.name"] = acc?.name ?? "";
        if (acc?.email) suggestedTo.push(acc.email);
      }
    } else if (entityType === "expense") {
      const [ex] = await db.select().from(expensesTable).where(eq(expensesTable.id, entityId));
      if (ex) {
        ctx["expense.number"] = ex.expenseNumber;
        ctx["expense.amount"] = formatINR(ex.amount);
        ctx["expense.date"] = formatDate(ex.expenseDate);
        ctx["expense.category"] = ex.category;
        ctx["expense.status"] = ex.status;
      }
    } else if (entityType === "lead") {
      const [l] = await db.select().from(leadsTable).where(eq(leadsTable.id, entityId));
      if (l) {
        ctx["lead.title"] = l.title;
        ctx["lead.status"] = l.status;
        const [c] = l.contactId ? await db.select().from(contactsTable).where(eq(contactsTable.id, l.contactId)) : [undefined];
        if (c?.email) suggestedTo.push(c.email);
        ctx["customer.name"] = c ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : "";
      }
    } else if (entityType === "project") {
      const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, entityId));
      if (p) {
        ctx["project.name"] = p.name;
        ctx["project.status"] = p.status;
        const [acc] = p.accountId ? await db.select().from(accountsTable).where(eq(accountsTable.id, p.accountId)) : [undefined];
        ctx["customer.name"] = acc?.name ?? "";
        if (acc?.email) suggestedTo.push(acc.email);
      }
    }
  } catch (err) {
    logger.warn({ err, entityType, entityId }, "buildEntityContext failed");
  }
  void quotationLineItemsTable; void invoiceLineItemsTable; void poLineItemsTable; void contactsTable;
  return { ctx, suggestedTo };
}

export async function loadTemplate(idOrCode: { id?: number | null; code?: string | null }): Promise<typeof emailTemplatesTable.$inferSelect | null> {
  if (idOrCode.id) {
    const [r] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, idOrCode.id));
    return r ?? null;
  }
  if (idOrCode.code) {
    const [r] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.code, idOrCode.code));
    return r ?? null;
  }
  return null;
}

export async function renderForEntity(opts: {
  templateId?: number | null;
  templateCode?: string | null;
  entityType?: string | null;
  entityId?: number | null;
}): Promise<{ subject: string; body: string; suggestedTo: string[] }> {
  const tpl = await loadTemplate({ id: opts.templateId, code: opts.templateCode });
  const { ctx, suggestedTo } = await buildEntityContext(opts.entityType, opts.entityId);
  const subject = tpl ? renderTemplate(tpl.subject, ctx) : "";
  const body = tpl ? renderTemplate(tpl.body, ctx) : "";
  return { subject, body, suggestedTo };
}

export async function sendEmail(opts: {
  to: string[];
  cc?: string[] | null;
  subject: string;
  body: string;
  templateCode?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  sentById?: number | null;
}): Promise<{ status: "sent" | "skipped" | "failed"; message: string; logId: number; provider: string }> {
  const result = await deliverEmail({
    to: opts.to,
    cc: opts.cc ?? null,
    subject: opts.subject,
    body: opts.body,
  });

  const errorMessage = result.status === "failed" ? result.message : null;

  const [logRow] = await db.insert(emailLogTable).values({
    templateCode: opts.templateCode ?? null,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
    toAddresses: opts.to.join(", "),
    ccAddresses: opts.cc && opts.cc.length ? opts.cc.join(", ") : null,
    subject: opts.subject,
    body: opts.body,
    status: result.status,
    errorMessage,
    sentById: opts.sentById ?? null,
  }).returning();

  return {
    status: result.status,
    message: result.message,
    logId: logRow.id,
    provider: result.provider,
  };
}

export { getActiveProvider } from "./email_transport";

export const SYSTEM_TEMPLATES: Array<{ code: string; name: string; category: string; subject: string; body: string; variables: string }> = [
  {
    code: "invoice_send", name: "Invoice — Send to Customer", category: "billing",
    subject: "Invoice {{invoice.number}} from {{company.name}}",
    body: "Dear {{customer.name}},\n\nPlease find attached invoice {{invoice.number}} dated {{invoice.date}} for {{invoice.total}}.\nPayment is due by {{invoice.dueDate}}.\n\nBank Details:\n{{company.bankName}} — A/c {{company.bankAccountNo}}, IFSC {{company.bankIfsc}}\n\nRegards,\n{{company.name}}\n{{company.email}} | {{company.phone}}",
    variables: "customer.name, invoice.number, invoice.date, invoice.dueDate, invoice.total, company.*",
  },
  {
    code: "invoice_reminder", name: "Invoice — Payment Reminder", category: "billing",
    subject: "Payment Reminder: Invoice {{invoice.number}}",
    body: "Dear {{customer.name}},\n\nThis is a gentle reminder that invoice {{invoice.number}} for {{invoice.total}} is due on {{invoice.dueDate}}.\nOutstanding balance: {{invoice.balance}}.\n\nKindly arrange payment at the earliest.\n\nRegards,\n{{company.name}}",
    variables: "customer.name, invoice.number, invoice.dueDate, invoice.total, invoice.balance",
  },
  {
    code: "quotation_send", name: "Quotation — Send to Customer", category: "sales",
    subject: "Quotation {{quotation.number}} from {{company.name}}",
    body: "Dear {{customer.name}},\n\nThank you for your interest. Please find attached quotation {{quotation.number}} dated {{quotation.date}} for a total of {{quotation.total}}.\nValid until: {{quotation.validUntil}}.\n\nWe look forward to working with you.\n\nRegards,\n{{company.name}}",
    variables: "customer.name, quotation.number, quotation.date, quotation.validUntil, quotation.total",
  },
  {
    code: "proposal_send", name: "Proposal — Send to Customer", category: "sales",
    subject: "Proposal: {{quotation.number}} — {{company.name}}",
    body: "Dear {{customer.name}},\n\nWe are pleased to share our proposal for your solar project. Please review the attached document.\n\nQuotation Reference: {{quotation.number}}\nTotal Investment: {{quotation.total}}\n\nRegards,\n{{company.name}}",
    variables: "customer.name, quotation.number, quotation.total",
  },
  {
    code: "po_send", name: "Purchase Order — Send to Vendor", category: "procurement",
    subject: "Purchase Order {{po.number}} from {{company.name}}",
    body: "Dear {{vendor.name}},\n\nPlease find attached purchase order {{po.number}} dated {{po.date}} for {{po.total}}.\nPlease confirm receipt and provide an expected delivery schedule.\n\nRegards,\n{{company.name}}\nGSTIN: {{company.gstin}}",
    variables: "vendor.name, po.number, po.date, po.total, company.*",
  },
  {
    code: "payment_receipt", name: "Payment — Receipt to Customer", category: "billing",
    subject: "Payment Receipt — {{payment.amount}} received against {{invoice.number}}",
    body: "Dear {{customer.name}},\n\nWe acknowledge receipt of {{payment.amount}} on {{payment.date}} via {{payment.mode}}{{payment.reference}}.\nApplied to invoice {{invoice.number}}.\n\nThank you for your prompt payment.\n\nRegards,\n{{company.name}}",
    variables: "customer.name, payment.amount, payment.date, payment.mode, invoice.number",
  },
  {
    code: "vendor_invoice_ack", name: "Vendor Invoice — Acknowledgement", category: "procurement",
    subject: "Vendor Invoice {{vendorInvoice.number}} received",
    body: "Dear {{vendor.name}},\n\nWe confirm receipt of your invoice {{vendorInvoice.number}} dated {{vendorInvoice.date}} for {{vendorInvoice.total}}.\nIt has been recorded for processing.\n\nRegards,\n{{company.name}}",
    variables: "vendor.name, vendorInvoice.number, vendorInvoice.date, vendorInvoice.total",
  },
  {
    code: "expense_approved", name: "Expense — Approved Notification", category: "expenses",
    subject: "Expense {{expense.number}} approved",
    body: "Hello,\n\nYour expense claim {{expense.number}} for {{expense.amount}} ({{expense.category}}) submitted on {{expense.date}} has been approved.\n\nRegards,\n{{company.name}} Finance Team",
    variables: "expense.number, expense.amount, expense.category, expense.date",
  },
];

export async function ensureSystemTemplates() {
  for (const t of SYSTEM_TEMPLATES) {
    const [exists] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.code, t.code));
    if (!exists) {
      await db.insert(emailTemplatesTable).values({ ...t, isActive: true, isSystem: true });
    }
  }
}
