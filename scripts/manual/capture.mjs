#!/usr/bin/env node
/**
 * Capture screenshots of every key page in DynamicsERP for the user manuals.
 * Uses Playwright + system Chromium.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.MANUAL_BASE_URL || "http://localhost:80";
const EMAIL = process.env.ADMIN_EMAIL || "admin@dynamicgreenenergy.in";
const PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const OUT_DIR = path.resolve(".local/manual/screenshots");
const CHROME = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForReady(page) {
  // Wait for the "Loading..." overlay (AppLayout) to disappear and skeletons to settle.
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        const txt = document.body.innerText || "";
        // AppLayout shows "Loading..." centered while auth is loading.
        if (/^\s*Loading\.\.\.\s*$/m.test(txt) && txt.trim().length < 30) return false;
        // Wait for either real content (h1/h2/table/card) OR the access denied card.
        return !!document.querySelector("h1, h2, table, [data-testid], .recharts-wrapper");
      },
      { timeout: 10000 },
    )
    .catch(() => {});
  await page.waitForTimeout(900);
}

async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await waitForReady(page);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function viewportShot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await waitForReady(page);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png (viewport)`);
}

async function nav(page, urlPath, name, opts = {}) {
  await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  if (opts.viewport) await viewportShot(page, name);
  else await shoot(page, name);
}

async function tryClickAndShoot(page, selector, name, { viewport = false, dismiss = true } = {}) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: "visible", timeout: 3000 });
    await el.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    if (viewport) await viewportShot(page, name);
    else await shoot(page, name);
    if (dismiss) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
    return true;
  } catch {
    console.log(`  · skipped ${name} (selector not found: ${selector})`);
    return false;
  }
}

async function getFirstRowHref(page, prefix) {
  return await page.evaluate((p) => {
    const a = Array.from(document.querySelectorAll("a")).find((el) =>
      (el.getAttribute("href") || "").startsWith(p) && (el.getAttribute("href") || "").length > p.length,
    );
    return a ? a.getAttribute("href") : null;
  }, prefix);
}

async function login(page, ctx) {
  console.log("→ Login (capture login screen first)");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await viewportShot(page, "00-login");

  // Programmatic login via API to guarantee a session cookie is on the context.
  console.log("→ Programmatic login via API");
  const resp = await ctx.request.post(BASE + "/api/auth/login", {
    data: { email: EMAIL, password: PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: HTTP ${resp.status()} — ${await resp.text()}`);
  }
  const cookies = await ctx.cookies();
  console.log(`  ✓ session cookie set: ${cookies.map((c) => c.name).join(", ")}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  ! pageerror:", e.message));

  await login(page, ctx);

  // ---------------- DASHBOARD ----------------
  console.log("→ Dashboard");
  await nav(page, "/", "01-dashboard");

  // ---------------- CRM: LEADS ----------------
  console.log("→ CRM");
  await nav(page, "/leads", "10-leads-list");
  await tryClickAndShoot(page, 'button:has-text("New Lead"), button:has-text("Create Lead"), button:has-text("Add Lead")', "11-leads-create-dialog", { viewport: true });
  const leadHref = await getFirstRowHref(page, "/leads/");
  if (leadHref) await nav(page, leadHref, "12-leads-detail");

  // ---------------- CRM: ACCOUNTS ----------------
  await nav(page, "/accounts", "13-accounts-list");
  await tryClickAndShoot(page, 'button:has-text("New Account"), button:has-text("Add Account"), button:has-text("Create Account")', "14-accounts-create-dialog", { viewport: true });
  const accHref = await getFirstRowHref(page, "/accounts/");
  if (accHref) await nav(page, accHref, "15-accounts-detail");

  // ---------------- CRM: CONTACTS ----------------
  await nav(page, "/contacts", "16-contacts-list");
  await tryClickAndShoot(page, 'button:has-text("New Contact"), button:has-text("Add Contact"), button:has-text("Create Contact")', "17-contacts-create-dialog", { viewport: true });
  const conHref = await getFirstRowHref(page, "/contacts/");
  if (conHref) await nav(page, conHref, "18-contacts-detail");

  // ---------------- SALES ----------------
  console.log("→ Sales");
  await nav(page, "/catalog", "20-catalog");
  await tryClickAndShoot(page, 'button:has-text("New Product"), button:has-text("Add Product")', "21-catalog-create-dialog", { viewport: true });

  await nav(page, "/quotations", "22-quotations-list");
  await tryClickAndShoot(page, 'button:has-text("New Quotation"), button:has-text("Create Quotation"), a:has-text("New Quotation")', "23-quotations-create-dialog", { viewport: true });
  const qHref = await getFirstRowHref(page, "/quotations/");
  if (qHref && !qHref.endsWith("/print")) await nav(page, qHref, "24-quotations-detail");

  await nav(page, "/estimations", "25-estimations");
  await nav(page, "/approvals", "26-approvals");
  await nav(page, "/approvals/rules", "27-approvals-rules");

  await nav(page, "/sales-orders", "28-sales-orders-list");
  const soHref = await getFirstRowHref(page, "/sales-orders/");
  if (soHref) await nav(page, soHref, "29-sales-orders-detail");

  // ---------------- OPERATIONS ----------------
  console.log("→ Operations");
  await nav(page, "/projects", "30-projects-list");
  await tryClickAndShoot(page, 'button:has-text("New Project"), button:has-text("Create Project")', "31-projects-create-dialog", { viewport: true });
  const projHref = await getFirstRowHref(page, "/projects/");
  if (projHref) await nav(page, projHref, "32-projects-detail");

  await nav(page, "/service-tickets", "33-service-tickets-list");
  await tryClickAndShoot(page, 'button:has-text("New Ticket"), button:has-text("Create Ticket"), button:has-text("New Service")', "34-service-tickets-create-dialog", { viewport: true });
  const stHref = await getFirstRowHref(page, "/service-tickets/");
  if (stHref) await nav(page, stHref, "35-service-tickets-detail");

  await nav(page, "/amc-contracts", "36-amc-contracts");

  // ---------------- BILLING ----------------
  console.log("→ Billing");
  await nav(page, "/invoices", "40-invoices-list");
  await tryClickAndShoot(page, 'button:has-text("New Invoice"), button:has-text("Create Invoice")', "41-invoices-create-dialog", { viewport: true });
  const invHref = await getFirstRowHref(page, "/invoices/");
  if (invHref) await nav(page, invHref, "42-invoices-detail");

  await nav(page, "/financial", "43-financial-dashboard");
  await nav(page, "/financial/ageing", "44-financial-ageing");
  await nav(page, "/financial/gst-report", "45-financial-gst");

  // ---------------- PROCUREMENT ----------------
  console.log("→ Procurement");
  await nav(page, "/procurement", "50-procurement-dashboard");
  await nav(page, "/vendors", "51-vendors-list");
  await tryClickAndShoot(page, 'button:has-text("New Vendor"), button:has-text("Add Vendor"), button:has-text("Create Vendor")', "52-vendors-create-dialog", { viewport: true });
  const vHref = await getFirstRowHref(page, "/vendors/");
  if (vHref) await nav(page, vHref, "53-vendors-detail");

  await nav(page, "/purchase-orders", "54-po-list");
  const poHref = await getFirstRowHref(page, "/purchase-orders/");
  if (poHref) await nav(page, poHref, "55-po-detail");

  await nav(page, "/vendor-invoices", "56-vendor-invoices");
  await nav(page, "/expenses", "57-expenses");
  await tryClickAndShoot(page, 'button:has-text("New Expense"), button:has-text("Add Expense"), button:has-text("Create Expense")', "58-expenses-create-dialog", { viewport: true });

  // ---------------- NOTIFICATIONS ----------------
  console.log("→ Notifications");
  await nav(page, "/notifications", "60-notifications");
  await nav(page, "/notifications/preferences", "61-notifications-preferences");

  // ---------------- ADMIN ----------------
  console.log("→ Admin");
  await nav(page, "/admin/company-settings", "70-admin-company-settings");
  await nav(page, "/admin/users", "71-admin-users");
  await tryClickAndShoot(page, 'button:has-text("New User"), button:has-text("Add User"), button:has-text("Create User"), button:has-text("Invite")', "72-admin-users-create-dialog", { viewport: true });

  await nav(page, "/admin/staff", "73-admin-staff");
  await tryClickAndShoot(page, 'button:has-text("New Staff"), button:has-text("Add Staff"), button:has-text("Create Staff")', "74-admin-staff-create-dialog", { viewport: true });

  await nav(page, "/admin/modules", "75-admin-modules");
  await nav(page, "/admin/email-templates", "76-admin-email-templates");
  await nav(page, "/admin/email-settings", "77-admin-email-settings");
  await nav(page, "/admin/inbox", "78-admin-inbox");
  await nav(page, "/admin/integrations", "79-admin-integrations");

  console.log("\n✅ All screenshots captured to .local/manual/screenshots/");
  await browser.close();
})().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
