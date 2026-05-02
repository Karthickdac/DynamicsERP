import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve(".local/manual/screenshots");
const OUT = path.resolve(".local/manual/output");
const CHROME = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

fs.mkdirSync(OUT, { recursive: true });

function img(name, caption) {
  const p = path.join(SHOTS, name);
  if (!fs.existsSync(p)) return `<p class="missing">[Missing: ${name}]</p>`;
  const b64 = fs.readFileSync(p).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}" alt="${caption}"/><figcaption>${caption}</figcaption></figure>`;
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, "Segoe UI", "Inter", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.55; }
  h1 { font-size: 28pt; color: #0f6e3a; margin: 0 0 4pt; letter-spacing: -0.02em; }
  h2 { font-size: 18pt; color: #0f6e3a; margin: 26pt 0 6pt; padding-bottom: 4pt; border-bottom: 2px solid #16a34a33; page-break-before: always; }
  h2:first-of-type { page-break-before: avoid; }
  h3 { font-size: 14pt; color: #0f172a; margin: 16pt 0 4pt; }
  h4 { font-size: 12pt; color: #334155; margin: 12pt 0 4pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 4pt 0 10pt 18pt; padding: 0; }
  li { margin-bottom: 3pt; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-family: "JetBrains Mono", "Menlo", Consolas, monospace; font-size: 9.5pt; color: #0f6e3a; }
  figure { margin: 10pt 0 14pt; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 230mm; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 1px 3px #0f172a14; }
  figcaption { font-size: 9pt; color: #64748b; font-style: italic; margin-top: 4pt; }
  .missing { color: #b91c1c; font-style: italic; }
  .cover { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; min-height: 240mm; padding: 0; page-break-after: always; }
  .cover .badge { display: inline-block; padding: 4px 12px; background: #dcfce7; color: #166534; border-radius: 999px; font-size: 10pt; font-weight: 600; margin-bottom: 14pt; letter-spacing: 0.04em; text-transform: uppercase; }
  .cover h1 { font-size: 44pt; line-height: 1.05; }
  .cover .subtitle { font-size: 16pt; color: #475569; margin-top: 6pt; max-width: 75%; }
  .cover .meta { margin-top: 40pt; color: #64748b; font-size: 10pt; line-height: 1.7; }
  .cover .meta strong { color: #0f172a; display: inline-block; min-width: 110px; }
  .toc { page-break-after: always; }
  .toc h2 { page-break-before: avoid; border-bottom: none; }
  .toc ol { font-size: 12pt; margin-left: 0; padding-left: 0; list-style: none; counter-reset: toc; }
  .toc ol li { counter-increment: toc; padding: 5pt 0; border-bottom: 1px dotted #cbd5e1; }
  .toc ol li::before { content: counter(toc, decimal-leading-zero) ". "; color: #16a34a; font-weight: 700; margin-right: 8pt; }
  .toc ol ol { font-size: 10.5pt; margin: 4pt 0 0 18pt; padding: 0; counter-reset: subtoc; }
  .toc ol ol li { padding: 2pt 0; border: none; counter-increment: subtoc; }
  .toc ol ol li::before { content: ""; }
  .callout { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10pt 14pt; margin: 12pt 0; border-radius: 4px; }
  .callout.warn { background: #fffbeb; border-left-color: #d97706; }
  .callout.danger { background: #fef2f2; border-left-color: #dc2626; }
  .callout strong { color: #0f6e3a; display: block; margin-bottom: 3pt; }
  .callout.warn strong { color: #92400e; }
  .callout.danger strong { color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 10pt; }
  th, td { text-align: left; padding: 6pt 8pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; color: #334155; font-weight: 600; }
  .muted { color: #64748b; font-size: 9.5pt; }
  .step { background: #f8fafc; border-radius: 6px; padding: 10pt 14pt; margin: 8pt 0 12pt; }
  .step-num { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; background: #16a34a; color: white; border-radius: 50%; font-weight: 700; font-size: 10pt; margin-right: 8pt; }
`;

function shell(title, subtitle, audience, sections, tocItems) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>${CSS}</style></head>
<body>
  <section class="cover">
    <span class="badge">Dynamic Green Energy · Solar Projects ERP</span>
    <h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
    <div class="meta">
      <p><strong>Product</strong> DynamicsERP — Solar Projects ERP</p>
      <p><strong>Audience</strong> ${audience}</p>
      <p><strong>Version</strong> 1.0</p>
      <p><strong>Issued</strong> May 2026</p>
      <p><strong>Organisation</strong> Dynamic Green Energy Pvt. Ltd. (India)</p>
    </div>
  </section>
  <section class="toc">
    <h2>Table of Contents</h2>
    <ol>${tocItems}</ol>
  </section>
  ${sections}
</body></html>`;
}

// ============================================================
// END USER MANUAL
// ============================================================
const endUserToc = [
  ["Getting Started", ["Logging in", "Navigating the workspace", "Your dashboard"]],
  ["Customer Relationship Management (CRM)", ["Leads", "Accounts", "Contacts"]],
  ["Sales Workflow", ["Product Catalog", "Quotations", "Estimations", "Approvals", "Sales Orders"]],
  ["Operations & Project Management", ["Projects", "Service Tickets", "AMC Contracts"]],
  ["Billing & Finance", ["Invoices", "Financial Dashboard", "Ageing Report", "GST Reports"]],
  ["Procurement", ["Procurement Dashboard", "Vendors", "Purchase Orders", "Vendor Invoices", "Expenses"]],
  ["Notifications", ["Notification Center", "Notification Preferences"]],
  ["Tips & Best Practices", []],
]
  .map(([t, subs]) => `<li>${t}${subs.length ? `<ol>${subs.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}</li>`)
  .join("");

const endUserSections = `
  <h2>1. Getting Started</h2>
  <p>Welcome to <strong>DynamicsERP</strong>, the all-in-one Solar Projects ERP built for Dynamic Green Energy. This manual walks you through every screen and workflow you will use day-to-day — from your first lead, through quote and project execution, to invoicing and after-sales service.</p>

  <h3>1.1 Logging in</h3>
  <p>Open the workspace URL in your browser. You will be greeted by the sign-in screen.</p>
  ${img("00-login.png", "Figure 1.1 — The DynamicsERP sign-in screen.")}
  <div class="step"><span class="step-num">1</span>Enter your work <strong>email address</strong> (issued by your administrator).</div>
  <div class="step"><span class="step-num">2</span>Enter your <strong>password</strong>. If this is your first login, use the temporary password your admin provided and change it later in your profile.</div>
  <div class="step"><span class="step-num">3</span>Click <strong>Sign in</strong>. You will be redirected to your role-specific dashboard.</div>
  <div class="callout"><strong>Tip</strong>If you forget your password, contact your administrator — they can reset it from the Users screen.</div>

  <h3>1.2 Navigating the workspace</h3>
  <p>Every page in DynamicsERP follows the same layout:</p>
  <ul>
    <li><strong>Left sidebar</strong> — your modules, grouped by function (CRM, Sales, Operations, Billing, Procurement, Admin). Only modules you have access to are listed.</li>
    <li><strong>Top bar</strong> — global search, theme toggle (light/dark), and notifications bell.</li>
    <li><strong>User card</strong> (bottom of sidebar) — click your name to access your profile and sign out.</li>
  </ul>

  <h3>1.3 Your dashboard</h3>
  <p>The dashboard is a real-time snapshot of your business. Cards show revenue, collections, receivables, payables, active projects, open service tickets, pending approvals and active leads. Charts compare invoiced vs collected over the last 12 months and break down active projects by stage.</p>
  ${img("01-dashboard.png", "Figure 1.2 — Management overview dashboard with KPIs, trend chart and recent activity.")}

  <h2>2. Customer Relationship Management (CRM)</h2>
  <p>CRM is where every customer relationship begins. Use it to capture inquiries (Leads), record companies you do business with (Accounts), and store the people inside those companies (Contacts).</p>

  <h3>2.1 Leads</h3>
  <p>A <strong>lead</strong> is a potential customer who has shown interest. Track every inquiry from first contact until it is qualified and converted into a Quotation or Account.</p>
  ${img("10-leads-list.png", "Figure 2.1 — Leads list with status, source and owner columns.")}

  <h4>Creating a new lead</h4>
  ${img("11-leads-create-dialog.png", "Figure 2.2 — New Lead dialog.")}
  <div class="step"><span class="step-num">1</span>Click <strong>New Lead</strong> at the top right of the Leads list.</div>
  <div class="step"><span class="step-num">2</span>Fill in the contact details — name, email, phone, source (Website, Referral, Walk-in, etc.).</div>
  <div class="step"><span class="step-num">3</span>Add solar-specific details such as estimated rooftop area or proposed kW capacity in the notes.</div>
  <div class="step"><span class="step-num">4</span>Assign an <strong>owner</strong> — the salesperson responsible for follow-up.</div>
  <div class="step"><span class="step-num">5</span>Click <strong>Create</strong>. The lead is added to the pipeline.</div>

  <h4>Working a lead</h4>
  <p>Click any row to open the lead detail. From here you can update the stage (New → Contacted → Qualified → Proposal → Won / Lost), log notes, attach files and create a quotation directly.</p>
  ${img("12-leads-detail.png", "Figure 2.3 — Lead detail screen with stage progression and activity timeline.")}

  <h3>2.2 Accounts</h3>
  <p>Accounts represent the <strong>companies</strong> you do business with — housing societies, factories, hospitals, government bodies, etc. Once a lead is won, it usually becomes an Account.</p>
  ${img("13-accounts-list.png", "Figure 2.4 — Accounts list.")}
  ${img("14-accounts-create-dialog.png", "Figure 2.5 — New Account dialog.")}
  <p>Capture the legal name, GSTIN, billing & shipping address, primary contact and industry. The GSTIN flows through to invoices and GST reports automatically.</p>
  ${img("15-accounts-detail.png", "Figure 2.6 — Account detail with contacts, projects and invoice history.")}

  <h3>2.3 Contacts</h3>
  <p>Contacts are the individual <strong>people</strong> at an Account — the procurement manager you email quotations to, the site engineer you coordinate installation with, the accounts head who clears your invoice.</p>
  ${img("16-contacts-list.png", "Figure 2.7 — Contacts list.")}
  ${img("17-contacts-create-dialog.png", "Figure 2.8 — New Contact dialog.")}
  ${img("18-contacts-detail.png", "Figure 2.9 — Contact detail.")}
  <div class="callout"><strong>Best practice</strong>Always link a Contact to its parent Account. This way every invoice, ticket and project automatically shows who to call.</div>

  <h2>3. Sales Workflow</h2>
  <p>Sales is the heart of DynamicsERP — from product catalog to signed sales order. The flow is: <strong>Catalog → Quotation → Estimation → Approval → Sales Order → Project</strong>.</p>

  <h3>3.1 Product Catalog</h3>
  <p>The Catalog stores every solar product you sell — panels, inverters, batteries, mounting structures, BoS items and labour SKUs. Each product has a name, SKU, unit, HSN/SAC code, GST rate, list price and stock category.</p>
  ${img("20-catalog.png", "Figure 3.1 — Product Catalog with filters.")}
  ${img("21-catalog-create-dialog.png", "Figure 3.2 — Add a new product.")}
  <div class="callout warn"><strong>Important</strong>Always set the correct HSN code and GST rate. These drive your invoices and GST returns — incorrect values cause filing errors.</div>

  <h3>3.2 Quotations</h3>
  <p>A Quotation is a formal price offer to a customer. Build line items from the Catalog, apply discounts, set validity and send for approval.</p>
  ${img("22-quotations-list.png", "Figure 3.3 — Quotations list with status and total.")}
  ${img("23-quotations-create-dialog.png", "Figure 3.4 — New Quotation form.")}
  ${img("24-quotations-detail.png", "Figure 3.5 — Quotation detail with line items and totals.")}
  <div class="step"><span class="step-num">1</span>Choose the customer Account and primary Contact.</div>
  <div class="step"><span class="step-num">2</span>Add line items — pick products from the catalog, set quantity and override price if needed.</div>
  <div class="step"><span class="step-num">3</span>Apply line discount or overall discount, set validity date and payment terms.</div>
  <div class="step"><span class="step-num">4</span>Save as draft, then submit for <strong>Approval</strong> if the discount or value exceeds your authority.</div>
  <div class="step"><span class="step-num">5</span>Once approved, generate a PDF and email it to the customer directly from the detail screen.</div>

  <h3>3.3 Estimations</h3>
  <p>Estimations let you build a detailed cost-versus-price worksheet before issuing a quotation. Compare BoM cost against quoted price to see your gross margin per project.</p>
  ${img("25-estimations.png", "Figure 3.6 — Estimations workbench.")}

  <h3>3.4 Approvals</h3>
  <p>Approvals route documents that exceed your authority limit (e.g. discount > 10% or quote value > ₹10 L) to a manager. The Approvals queue shows what is pending action.</p>
  ${img("26-approvals.png", "Figure 3.7 — Approvals queue.")}
  <h4>Approval rules</h4>
  <p>Administrators define which roles must approve which document types and at what thresholds. End users only see the queue.</p>
  ${img("27-approvals-rules.png", "Figure 3.8 — Approval rules (admin view).")}

  <h3>3.5 Sales Orders</h3>
  <p>Once a customer accepts a quotation, convert it to a <strong>Sales Order</strong> with one click. The Sales Order locks pricing, kicks off project creation in Operations, and triggers procurement requests for stock items.</p>
  ${img("28-sales-orders-list.png", "Figure 3.9 — Sales Orders list.")}

  <h2>4. Operations &amp; Project Management</h2>
  <p>Once the order is in, Operations takes over: site survey, design, material dispatch, installation, commissioning and handover.</p>

  <h3>4.1 Projects</h3>
  <p>Each Sales Order spawns a Project. Track stage (Design → Procurement → Installation → Commissioning → Handover), assigned team, target date and on-site progress.</p>
  ${img("30-projects-list.png", "Figure 4.1 — Projects list.")}
  ${img("31-projects-create-dialog.png", "Figure 4.2 — New Project form.")}

  <h3>4.2 Service Tickets</h3>
  <p>After commissioning, customers raise issues — inverter alarm, panel cleaning, performance drop. The Service module tracks every ticket from open to resolved with SLA timers.</p>
  ${img("33-service-tickets-list.png", "Figure 4.3 — Service Tickets list.")}
  ${img("34-service-tickets-create-dialog.png", "Figure 4.4 — Raise a new service ticket.")}
  <div class="callout"><strong>Tip</strong>Always link a service ticket to the parent Project. The technician then sees all installation history, panel make and inverter model on arrival.</div>

  <h3>4.3 AMC Contracts</h3>
  <p>Annual Maintenance Contracts (AMC) cover preventive maintenance visits over a defined term. The system tracks contract value, visit schedule and renewal dates.</p>
  ${img("36-amc-contracts.png", "Figure 4.5 — AMC Contracts.")}

  <h2>5. Billing &amp; Finance</h2>
  <p>Convert work into cash. Raise GST-compliant invoices, track receivables and file your monthly GST returns from one place.</p>

  <h3>5.1 Invoices</h3>
  <p>Invoices are auto-generated from Sales Orders or created manually. They are GST-ready: CGST/SGST or IGST is computed based on the customer's state versus your company state.</p>
  ${img("40-invoices-list.png", "Figure 5.1 — Invoices list with status (Draft / Sent / Paid / Overdue).")}
  ${img("41-invoices-create-dialog.png", "Figure 5.2 — New Invoice form.")}
  ${img("42-invoices-detail.png", "Figure 5.3 — Invoice detail with line items, taxes and payment record.")}
  <div class="callout warn"><strong>Important</strong>Once an invoice is marked <strong>Sent</strong>, line items are locked. To correct a sent invoice you must issue a credit note.</div>

  <h3>5.2 Financial Dashboard</h3>
  <p>A real-time view of revenue, collections and outstanding receivables. Drill in to spot which customers are slow to pay.</p>
  ${img("43-financial-dashboard.png", "Figure 5.4 — Financial Dashboard.")}

  <h3>5.3 Ageing Report</h3>
  <p>The Ageing Report buckets unpaid invoices by how overdue they are (0–30 / 31–60 / 61–90 / 90+ days). Use it to prioritise collection calls.</p>
  ${img("44-financial-ageing.png", "Figure 5.5 — Receivables ageing report.")}

  <h3>5.4 GST Reports</h3>
  <p>GSTR-1 (sales) and GSTR-3B (summary) reports are generated from your invoices. Export the JSON or download the working sheet for your CA.</p>
  ${img("45-financial-gst.png", "Figure 5.6 — GST returns workbench.")}

  <h2>6. Procurement</h2>
  <p>The Procurement module handles your supply side — vendors, purchase orders, vendor invoices and expenses.</p>

  <h3>6.1 Procurement Dashboard</h3>
  <p>Snapshot of open POs, vendor outstanding, recent expenses and pending approvals on the buying side.</p>
  ${img("50-procurement-dashboard.png", "Figure 6.1 — Procurement Dashboard.")}

  <h3>6.2 Vendors</h3>
  <p>Capture every supplier — panel manufacturer, inverter dealer, mounting fabricator, cable supplier, freight company. Store GSTIN, payment terms, bank details and rating.</p>
  ${img("51-vendors-list.png", "Figure 6.2 — Vendors list.")}
  ${img("52-vendors-create-dialog.png", "Figure 6.3 — New Vendor form.")}
  ${img("53-vendors-detail.png", "Figure 6.4 — Vendor detail with PO history and outstanding.")}

  <h3>6.3 Purchase Orders</h3>
  <p>Raise a PO to a vendor for materials or services. POs flow through approval (if above your limit), then dispatch and goods receipt.</p>
  ${img("54-po-list.png", "Figure 6.5 — Purchase Orders list.")}
  ${img("55-po-detail.png", "Figure 6.6 — Purchase Order detail.")}

  <h3>6.4 Vendor Invoices</h3>
  <p>Record bills received from vendors against your POs. Approval routes them to Finance for payment.</p>
  ${img("56-vendor-invoices.png", "Figure 6.7 — Vendor Invoices.")}

  <h3>6.5 Expenses</h3>
  <p>Log overhead and project-attributable expenses (travel, food, freight, miscellaneous) with bill upload and category.</p>
  ${img("57-expenses.png", "Figure 6.8 — Expenses ledger.")}
  ${img("58-expenses-create-dialog.png", "Figure 6.9 — New Expense form with bill upload.")}

  <h2>7. Notifications</h2>
  <p>The bell icon in the top bar shows unread alerts. The Notifications page lists your full history; the Preferences page lets you choose which events alert you (and via which channel).</p>
  ${img("60-notifications.png", "Figure 7.1 — Notifications inbox.")}
  ${img("61-notifications-preferences.png", "Figure 7.2 — Notification preferences.")}

  <h2>8. Tips &amp; Best Practices</h2>
  <ul>
    <li><strong>Keep CRM clean.</strong> One Account per company, and link every Contact to its Account. Duplicates make reporting messy.</li>
    <li><strong>Always quote from the Catalog.</strong> Free-text line items break HSN/GST and skew margin reports.</li>
    <li><strong>Submit on time for approval.</strong> Quotations and POs above your limit cannot move forward until approved — submit early to avoid delays.</li>
    <li><strong>Mark invoices Sent only when truly sent.</strong> Once sent, line items lock. Use Credit Notes for corrections.</li>
    <li><strong>Close service tickets explicitly.</strong> Open SLA timers count against your team metrics until you close the ticket.</li>
    <li><strong>Update your notification preferences.</strong> Mute what you don't need so important alerts stand out.</li>
  </ul>
  <div class="callout"><strong>Need help?</strong>Contact your administrator or write to <code>support@dynamicgreenenergy.in</code>.</div>
`;

// ============================================================
// ADMIN MANUAL
// ============================================================
const adminToc = [
  ["Introduction & Admin Overview", []],
  ["First-Time Setup", ["Company Settings", "Initial Users"]],
  ["User Management", ["Users", "Staff", "Inviting & resetting passwords"]],
  ["Roles & Module Access (RBAC)", ["Roles overview", "Module Management matrix", "Best practices"]],
  ["Approvals Configuration", []],
  ["Email & Templates", ["Email Templates", "Email Settings (SMTP)"]],
  ["Inbox & Customer Replies", []],
  ["Integrations", []],
  ["Notifications Administration", []],
  ["Maintenance & Operations", []],
]
  .map(([t, subs]) => `<li>${t}${subs.length ? `<ol>${subs.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}</li>`)
  .join("");

const adminSections = `
  <h2>1. Introduction &amp; Admin Overview</h2>
  <p>This Administrator's Manual covers everything you need to operate DynamicsERP for Dynamic Green Energy: organisational setup, user lifecycle, role-based access, approvals, email and integrations.</p>
  <p>You must be signed in with the <strong>admin</strong> role to access the screens in this manual. Admins automatically see every module — including the Admin section in the sidebar.</p>
  <div class="callout warn"><strong>Security reminder</strong>Treat admin access like the master key to your business. Limit it to a small, named group and always use strong, unique passwords.</div>

  <h3>The admin's responsibilities</h3>
  <table>
    <thead><tr><th>Area</th><th>What you own</th></tr></thead>
    <tbody>
      <tr><td>Company profile</td><td>Legal name, GSTIN, address, logo, currency, fiscal year.</td></tr>
      <tr><td>Users &amp; staff</td><td>Inviting joiners, deactivating leavers, password resets.</td></tr>
      <tr><td>Roles &amp; module access</td><td>Deciding which role sees which sidebar modules.</td></tr>
      <tr><td>Approval rules</td><td>Threshold limits for quotes, POs and expenses.</td></tr>
      <tr><td>Email setup</td><td>SMTP credentials, sender identity, templates.</td></tr>
      <tr><td>Integrations</td><td>Third-party connectors (payment, e-invoice, mail, etc).</td></tr>
      <tr><td>Customer inbox</td><td>Routing reply-to mail to the right team.</td></tr>
    </tbody>
  </table>

  <h2>2. First-Time Setup</h2>
  <p>Before you onboard end users, complete two foundational steps: company profile and at least one functional user per role.</p>

  <h3>2.1 Company Settings</h3>
  <p>Open <code>Admin → Company Settings</code> from the sidebar.</p>
  ${img("70-admin-company-settings.png", "Figure 2.1 — Company Settings.")}
  <div class="step"><span class="step-num">1</span><strong>Legal &amp; tax identity</strong> — fill in legal company name, GSTIN, PAN, CIN if applicable, and registered office address. These appear on every invoice.</div>
  <div class="step"><span class="step-num">2</span><strong>Branding</strong> — upload your logo (used on the sidebar and on PDF documents) and pick the primary brand colour.</div>
  <div class="step"><span class="step-num">3</span><strong>Currency &amp; locale</strong> — set INR as currency, India as country, and your fiscal year start month (April for India).</div>
  <div class="step"><span class="step-num">4</span><strong>Document numbering</strong> — pick the prefix and starting number for Quotations (QT), Sales Orders (SO), Invoices (INV), POs (PO) and Service Tickets (ST).</div>
  <div class="step"><span class="step-num">5</span>Click <strong>Save</strong>. Some changes (logo, brand colour) are picked up immediately; others take effect on next login.</div>
  <div class="callout warn"><strong>Important</strong>Once invoices are issued under a numbering scheme, do not change the prefix or starting number — Indian tax law requires continuous, sequential invoice numbers per fiscal year.</div>

  <h3>2.2 Initial Users</h3>
  <p>After Company Settings, create at least one user for each functional role you intend to use (Sales, Project Manager, Finance, Service, Engineer, HR). See <strong>User Management</strong> below.</p>

  <h2>3. User Management</h2>
  <p>DynamicsERP separates two related concepts:</p>
  <ul>
    <li><strong>Users</strong> — anyone who can sign in. Has email, password, role.</li>
    <li><strong>Staff</strong> — your full HR roster (employees, contractors, technicians). A staff member <em>may</em> also be a User if they need system access; field technicians often appear in Staff but not Users.</li>
  </ul>

  <h3>3.1 Users</h3>
  <p>Open <code>Admin → Users</code>.</p>
  ${img("71-admin-users.png", "Figure 3.1 — Users list with role and status.")}
  ${img("72-admin-users-create-dialog.png", "Figure 3.2 — Create / invite User dialog.")}
  <div class="step"><span class="step-num">1</span>Click <strong>New User</strong>.</div>
  <div class="step"><span class="step-num">2</span>Enter first name, last name, email and assign a <strong>role</strong> (Admin, Sales, Project Manager, Finance, Service, Engineer, HR).</div>
  <div class="step"><span class="step-num">3</span>Set an initial password. Ask the user to change it on first login from their profile.</div>
  <div class="step"><span class="step-num">4</span>Optionally link to a Staff record (recommended) to enrich profile with designation, department and employee code.</div>
  <div class="step"><span class="step-num">5</span>Click <strong>Create</strong>. The user can sign in immediately.</div>
  <div class="callout"><strong>Deactivating a user</strong>To revoke access (resignation, role change), open the user and toggle <strong>Active</strong> off. The audit trail and ownership of past records are preserved — only sign-in is blocked.</div>

  <h3>3.2 Staff</h3>
  <p>Open <code>Admin → Staff</code>. Maintain your HR roster here — designation, department, employee code, contact details, joining date.</p>
  ${img("73-admin-staff.png", "Figure 3.3 — Staff roster.")}
  ${img("74-admin-staff-create-dialog.png", "Figure 3.4 — Add Staff member.")}

  <h3>3.3 Inviting &amp; resetting passwords</h3>
  <ul>
    <li>Initial passwords are set when you create the user. Communicate them out-of-band (e.g. via WhatsApp, not email).</li>
    <li>To reset a forgotten password, open the user record and use the <strong>Reset password</strong> action — set a new temporary password and share it.</li>
    <li>Users can change their own password from their profile after signing in.</li>
  </ul>

  <h2>4. Roles &amp; Module Access (RBAC)</h2>
  <p>RBAC (role-based access control) governs which sidebar modules and pages each role can see. Admins always see every module — RBAC only restricts non-admin roles.</p>

  <h3>4.1 Roles overview</h3>
  <table>
    <thead><tr><th>Role</th><th>Typical use</th></tr></thead>
    <tbody>
      <tr><td><strong>Admin</strong></td><td>Full system access. Configures everything.</td></tr>
      <tr><td><strong>Sales</strong></td><td>CRM, Catalog, Quotations, Sales Orders.</td></tr>
      <tr><td><strong>Project Manager</strong></td><td>Projects, Service Tickets, AMC.</td></tr>
      <tr><td><strong>Finance</strong></td><td>Invoices, Financial Dashboard, Ageing, GST.</td></tr>
      <tr><td><strong>Service</strong></td><td>Service Tickets, AMC contracts.</td></tr>
      <tr><td><strong>Engineer</strong></td><td>Project execution, technical detail screens.</td></tr>
      <tr><td><strong>HR</strong></td><td>Staff records and HR-specific reports.</td></tr>
    </tbody>
  </table>

  <h3>4.2 Module Management matrix</h3>
  <p>Open <code>Admin → Modules</code>. The screen shows every module on the rows and every role on the columns. Tick a box to grant access; untick to revoke.</p>
  ${img("75-admin-modules.png", "Figure 4.1 — Role × Module access matrix.")}
  <div class="step"><span class="step-num">1</span>Locate the role column you want to configure.</div>
  <div class="step"><span class="step-num">2</span>Tick the modules that role should see in their sidebar. Untick what they should not.</div>
  <div class="step"><span class="step-num">3</span>Use the <strong>all</strong> / <strong>clear</strong> shortcuts in the column header to toggle every module for that role.</div>
  <div class="step"><span class="step-num">4</span>Click <strong>Save changes</strong>. Affected users see the new sidebar on their next page load (within ~30 seconds).</div>
  <div class="callout"><strong>Admin column</strong>The Admin column is locked with a padlock — admins always have access to every module by design. You cannot revoke modules from the Admin role.</div>

  <h3>4.3 Best practices</h3>
  <ul>
    <li><strong>Start narrow, expand on request.</strong> Granting only what a role needs reduces accidental data exposure.</li>
    <li><strong>Group access by function, not person.</strong> If two people do the same job, give them the same role.</li>
    <li><strong>Review quarterly.</strong> Roles drift over time as the org changes — schedule a 15-minute review every quarter.</li>
    <li><strong>Never share admin credentials.</strong> Each admin should have their own login so the audit trail is clean.</li>
  </ul>

  <h2>5. Approvals Configuration</h2>
  <p>Approval rules govern who must approve high-value or high-discount documents. Open <code>Sales → Approvals → Rules</code> (visible to admins).</p>
  ${img("27-approvals-rules.png", "Figure 5.1 — Approval rules.")}
  <p>For each document type (Quotation, Sales Order, PO, Expense) define one or more rules:</p>
  <ul>
    <li><strong>Trigger</strong> — e.g. discount % above a threshold, total value above a threshold.</li>
    <li><strong>Approver role</strong> — who must approve (e.g. Finance, Admin).</li>
    <li><strong>Action on approval</strong> — typically the document moves to the next stage; on rejection it returns to the author with a comment.</li>
  </ul>
  <div class="callout warn"><strong>Tip</strong>Keep rules simple. Two or three thresholds per document type are enough — too many rules slow your team down.</div>

  <h2>6. Email &amp; Templates</h2>
  <p>DynamicsERP sends transactional email — quotation PDFs, invoices, password resets, notifications — through your configured SMTP provider with templates you control.</p>

  <h3>6.1 Email Templates</h3>
  <p>Open <code>Admin → Email Templates</code>. Each template has a key (e.g. <code>quotation-sent</code>, <code>invoice-overdue</code>), subject and HTML body. Use placeholders like <code>{{customer.name}}</code> or <code>{{invoice.number}}</code>.</p>
  ${img("76-admin-email-templates.png", "Figure 6.1 — Email Templates.")}
  <div class="step"><span class="step-num">1</span>Pick a template from the list to edit, or click <strong>New Template</strong>.</div>
  <div class="step"><span class="step-num">2</span>Edit the subject and HTML body. Use placeholders for dynamic fields.</div>
  <div class="step"><span class="step-num">3</span>Send a <strong>test email</strong> to yourself before saving.</div>
  <div class="step"><span class="step-num">4</span>Save. Future sends use the new template immediately.</div>

  <h3>6.2 Email Settings (SMTP)</h3>
  <p>Open <code>Admin → Email Settings</code> and configure your outgoing mail server.</p>
  ${img("77-admin-email-settings.png", "Figure 6.2 — Email (SMTP) settings.")}
  <table>
    <thead><tr><th>Field</th><th>Example</th></tr></thead>
    <tbody>
      <tr><td>SMTP host</td><td><code>smtp.gmail.com</code> / <code>smtp.office365.com</code> / your provider</td></tr>
      <tr><td>Port</td><td><code>587</code> (STARTTLS) or <code>465</code> (SSL)</td></tr>
      <tr><td>Username</td><td>The mailbox you send from</td></tr>
      <tr><td>Password / App password</td><td>Provider's password or app-specific password</td></tr>
      <tr><td>From name / address</td><td>e.g. <code>Dynamic Green Energy &lt;billing@dynamicgreenenergy.in&gt;</code></td></tr>
      <tr><td>Reply-to</td><td>The mailbox staff should receive replies on (often <code>support@…</code>)</td></tr>
    </tbody>
  </table>
  <div class="step"><span class="step-num">1</span>Enter the credentials.</div>
  <div class="step"><span class="step-num">2</span>Click <strong>Test connection</strong>. The system sends a probe to validate the credentials.</div>
  <div class="step"><span class="step-num">3</span>Click <strong>Save</strong>. All transactional email now flows through this SMTP.</div>
  <div class="callout danger"><strong>Security</strong>Never use a personal mailbox password. Always use an app-specific password (Gmail / Outlook) or a dedicated transactional account so revoking access does not affect personal mail.</div>

  <h2>7. Inbox &amp; Customer Replies</h2>
  <p>When customers reply to an emailed quotation or invoice, those replies land in the <code>Admin → Inbox</code>. From here you can route messages to the responsible team or convert them to leads / tickets.</p>
  ${img("78-admin-inbox.png", "Figure 7.1 — Customer reply inbox.")}
  <ul>
    <li><strong>Open</strong> any message to see the full thread, including the original outbound mail.</li>
    <li><strong>Convert</strong> a message to a Lead, Service Ticket or Note on the related document.</li>
    <li><strong>Assign</strong> to a user for follow-up.</li>
    <li><strong>Mark resolved</strong> once handled.</li>
  </ul>

  <h2>8. Integrations</h2>
  <p>Connect DynamicsERP to third-party services from <code>Admin → Integrations</code>. Each integration has its own configuration (API key, webhook secret, OAuth flow).</p>
  ${img("79-admin-integrations.png", "Figure 8.1 — Integrations directory.")}
  <p>Common integrations include:</p>
  <ul>
    <li><strong>Payment gateways</strong> — collect online payments against invoices.</li>
    <li><strong>E-invoicing &amp; e-way bill</strong> — push invoices directly to GSTN's IRP.</li>
    <li><strong>Cloud storage</strong> — back up document attachments.</li>
    <li><strong>Mobile push</strong> — alert technicians of new tickets in real time.</li>
  </ul>
  <div class="step"><span class="step-num">1</span>Click the integration card.</div>
  <div class="step"><span class="step-num">2</span>Follow the connector-specific instructions (API key paste or OAuth consent).</div>
  <div class="step"><span class="step-num">3</span>Test the integration from the configuration screen.</div>
  <div class="step"><span class="step-num">4</span>Enable. The integration is live for the whole organisation.</div>
  <div class="callout warn"><strong>Credentials hygiene</strong>Rotate API keys at least once a year and immediately whenever an admin with access leaves the organisation.</div>

  <h2>9. Notifications Administration</h2>
  <p>Notifications are produced by system events (new lead, invoice overdue, ticket SLA breach) and delivered via in-app bell, email and (where configured) mobile push. End users tune their own preferences; you, as admin, decide which channels are <em>available</em>.</p>
  ${img("60-notifications.png", "Figure 9.1 — Notifications inbox (user view, included for reference).")}
  ${img("61-notifications-preferences.png", "Figure 9.2 — Notification preferences (user view).")}
  <ul>
    <li>Email notifications require the SMTP setup from section 6.2.</li>
    <li>Push notifications require the mobile push integration from section 8.</li>
    <li>In-app notifications are always on.</li>
  </ul>

  <h2>10. Maintenance &amp; Operations</h2>
  <h3>Routine checks</h3>
  <ul>
    <li><strong>Daily</strong> — scan the customer Inbox; clear any unassigned messages.</li>
    <li><strong>Weekly</strong> — review pending Approvals; nudge approvers on aged items.</li>
    <li><strong>Monthly</strong> — reconcile users vs. staff; deactivate any users no longer with the company.</li>
    <li><strong>Quarterly</strong> — review the Module Access matrix; rotate any shared API credentials.</li>
    <li><strong>Annually</strong> — confirm fiscal year, renumber prefixes if required, archive prior-year data per policy.</li>
  </ul>

  <h3>Backups &amp; data export</h3>
  <p>The hosting team backs up the database nightly. For point-in-time exports (e.g. for your CA), use the report exports inside each module. Treat exported files as confidential — they contain customer PII and pricing.</p>

  <h3>Getting support</h3>
  <p>For platform issues (errors, downtime, integrations) raise a ticket with the implementation team. For business questions (how to model a new workflow), engage your account manager.</p>

  <div class="callout"><strong>End of Administrator Manual</strong>Thank you for keeping DynamicsERP healthy for everyone at Dynamic Green Energy.</div>
`;

const endUserHtml = shell(
  "End User Manual",
  "Your complete walkthrough of DynamicsERP — Solar Projects ERP. From your first lead through quote, project, invoice and after-sales service.",
  "Sales, Project Managers, Finance, Service & Operations staff",
  endUserSections,
  endUserToc,
);

const adminHtml = shell(
  "Administrator Manual",
  "Configure and operate DynamicsERP — users, roles, modules, approvals, email and integrations.",
  "System Administrators",
  adminSections,
  adminToc,
);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const [name, html] of [
    ["DynamicsERP-End-User-Manual.pdf", endUserHtml],
    ["DynamicsERP-Administrator-Manual.pdf", adminHtml],
  ]) {
    console.log(`→ Building ${name}`);
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(OUT, name),
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
    const sz = (fs.statSync(path.join(OUT, name)).size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ ${name} (${sz} MB)`);
  }

  await browser.close();
  console.log("\n✅ PDFs ready in .local/manual/output/");
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
