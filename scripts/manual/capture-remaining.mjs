import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:80";
const EMAIL = "admin@dynamicgreenenergy.in";
const PASSWORD = "password123";
const OUT_DIR = path.resolve(".local/manual/screenshots");
const CHROME = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForReady(page) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        const txt = document.body.innerText || "";
        if (/^\s*Loading\.\.\.\s*$/m.test(txt) && txt.trim().length < 30) return false;
        return !!document.querySelector("h1, h2, table, [data-testid], .recharts-wrapper");
      },
      { timeout: 9000 },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
}

async function shoot(page, name, viewport = false) {
  await waitForReady(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: !viewport });
  console.log(`  ✓ ${name}.png`);
}

async function nav(page, urlPath, name, viewport = false) {
  await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 18000 }).catch(() => {});
  await shoot(page, name, viewport);
}

async function tryClickAndShoot(page, selector, name) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: "visible", timeout: 4000 });
    await el.click();
    await page.waitForTimeout(900);
    await shoot(page, name, true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch {
    console.log(`  ⚠ skip ${name} (selector not found)`);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  ! pageerror:", e.message));

  console.log("→ API login");
  const resp = await ctx.request.post(BASE + "/api/auth/login", {
    data: { email: EMAIL, password: PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  if (!resp.ok()) throw new Error(`login ${resp.status()}`);
  console.log("  ✓ logged in");

  // Visit dashboard once to warm up SPA + auth state
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  console.log("→ Procurement (remaining)");
  await nav(page, "/vendor-invoices", "56-vendor-invoices");
  await nav(page, "/expenses", "57-expenses");
  await tryClickAndShoot(page, 'button:has-text("New Expense"), button:has-text("Add Expense"), button:has-text("Create Expense")', "58-expenses-create-dialog");

  console.log("→ Notifications");
  await nav(page, "/notifications", "60-notifications");
  await nav(page, "/notifications/preferences", "61-notifications-preferences");

  console.log("→ Admin");
  await nav(page, "/admin/company-settings", "70-admin-company-settings");
  await nav(page, "/admin/users", "71-admin-users");
  await tryClickAndShoot(page, 'button:has-text("New User"), button:has-text("Add User"), button:has-text("Create User"), button:has-text("Invite")', "72-admin-users-create-dialog");
  await nav(page, "/admin/staff", "73-admin-staff");
  await tryClickAndShoot(page, 'button:has-text("New Staff"), button:has-text("Add Staff"), button:has-text("Create Staff")', "74-admin-staff-create-dialog");
  await nav(page, "/admin/modules", "75-admin-modules");
  await nav(page, "/admin/email-templates", "76-admin-email-templates");
  await nav(page, "/admin/email-settings", "77-admin-email-settings");
  await nav(page, "/admin/inbox", "78-admin-inbox");
  await nav(page, "/admin/integrations", "79-admin-integrations");

  console.log("\n✅ Remaining screenshots done");
  await browser.close();
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
