# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Product: DynamicsERP

ERP for an Indian Solar Projects Company. Path-based artifact at `/`.

### Modules (delivered)
- **Auth** — email/password (bcrypt) + httpOnly cookie session, CORS allowlist, public registration locked to `sales` role.
- **CRM** — Accounts, Contacts, Leads (kanban + table), Lead Activities timeline.
- **Sales** — Catalog (products + bundles), Quotations (multi-line + GST), Estimations (BOM + cost rollup), Approval rules + requests, Sales Orders.
- **Operations** — Projects (tasks + milestones), Service Tickets (assignment + resolution), AMC Contracts.
- **Billing** — Invoices (GST split CGST/SGST/IGST, e-invoice fields), Payments (allocations), Financial Dashboard, Ageing Report, GST Reports (GSTR-1/3B).
- **Procurement** — Vendors, Purchase Orders (approval flow + GRN partial/final, over-receipt blocked), Vendor Invoices (3-way match), Expenses (submit/approve/reimburse).
- **Notifications** — In-app bell with unread polling, full notifications center, per-event channel preferences (in-app/email/push), Web Push (VAPID, service worker), email (Nodemailer SMTP). Email/push are graceful no-ops when env vars missing. 12 event types wired across leads, quotations, expenses, invoices, payments, service tickets, POs.
- **Dashboard** — Management overview: revenue MTD/YTD, collected MTD, AR/AP outstanding, active/overdue projects, open service tickets, pipeline + leads, pending approvals, top 5 customers (12mo), 12-month invoiced-vs-collected area chart, project-stage pie, alerts (overdue invoices + projects past due date), recent activity. Backed by `GET /api/dashboard/management`.
- **Admin** — Company Settings (single-row, used in PDFs/emails; logo upload via Replit Object Storage / `POST /api/storage/uploads/request-url` + `GET /api/storage/objects/...`), Users (full CRUD + role/active filters + password reset), Staff (HR directory, manual + live MysticsHR sync via `GET {baseUrl}/api/v1/employees` with limit/offset paging, upserts on `(source='mysticshr', externalId)`, links manager hierarchy, admin/HR can trigger), Email Templates (system + custom, double-curly placeholders, per-category), Email Settings (admin UI for SMTP/Resend credentials at `/admin/email-settings`, single-row `email_settings` table; secrets are stored server-side and never echoed back — only `smtpPasswordSet` / `resendApiKeySet` flags; `POST /email-settings/test` sends a verification email; falls back to legacy SMTP_*/RESEND_* env vars when `provider='none'`), Integrations (MysticsHR connector with masked-key storage; surfaces imported/updated/failed counts and last-sync status).
- **Email & Templates** — Per-document Send Email action on invoices, quotations, sales orders, POs, vendor invoices, payments, expenses; uses templates rendered with entity context (`{{customer.name}}`, `{{invoice.number}}`, `{{company.name}}`, etc.). Real delivery via Nodemailer SMTP or Resend HTTP API (auto-detected). All emails persisted in `email_log` (status `sent`/`failed`/`skipped`); send failures surface in the UI toast and `email_log.error_message`.
- **Print & Export** — Reusable Print + PDF + Excel buttons (jsPDF / jspdf-autotable / xlsx) on key documents and reports. PDFs include the configured company header, GSTIN/PAN, and invoice footer note from Company Settings.

### Test users (password: `password123`)
- admin@dynamicgreenenergy.in (admin)  •  sales@dynamicgreenenergy.in (sales)  •  pm@dynamicgreenenergy.in (project_manager)  •  finance@dynamicgreenenergy.in (finance)  •  service@dynamicgreenenergy.in (service)

### Architecture
- `lib/api-spec/openapi.yaml` — single source of truth; codegen produces `@workspace/api-zod` and `@workspace/api-client-react` (Orval).
- `lib/db` — Drizzle schema (auth, CRM, sales, operations, billing, procurement, notifications + push subscriptions).
- `artifacts/api-server` — Express 5, mounts `/api/*`, cookie session middleware, pino logging.
- `artifacts/dynamics-erp` — React + Vite + wouter + TanStack Query + shadcn/ui; Indian ₹/date formatters.

### Conventions
- Indian context: ₹ display, GSTIN fields, dates `dd MMM yyyy`.
- No emojis anywhere in UI.
- After spec changes, always run `pnpm --filter @workspace/api-spec run codegen` before typechecking.
- Never return session tokens in JSON; never accept `Authorization: Bearer` for the session cookie.
- Public `POST /auth/register` must hardcode role; privileged role assignment goes through admin-only flows.
- Admin-only API: `/api/users*`, `/api/integrations*`, mutating `/api/email-templates`, mutating `/api/company-settings`. Admin/HR: `/api/staff*`. All authenticated: `GET /api/company-settings`, `GET /api/email-templates`, `/api/emails/preview`, `/api/emails/send`.
- Frontend admin pages wrapped in `<AdminRoute>` (returns Access Denied card when role mismatched). Always defend in depth — never rely on UI gating alone.
- Deactivated users: `isActive=false` blocks login (403) and is rejected by session lookup. Deactivating a user via `DELETE /api/users/:id` also revokes all their sessions.
- Email delivery env (optional, applies to both notifications and the per-document Send Email action):
  - SMTP: `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` + `SMTP_FROM` (required); `SMTP_PORT` (default 587), `SMTP_SECURE` (`true`/`false`, default true on port 465), `SMTP_FROM_NAME` (defaults to Company Settings name).
  - Resend: `RESEND_API_KEY` (auto-picked up from the Replit Resend integration). Optional `RESEND_FROM` / `RESEND_FROM_NAME` override (otherwise uses `SMTP_FROM` / Company Settings name).
  - Resend takes precedence when both are set. Without either, sends are recorded with status `skipped`. Hard send failures (auth, rejected recipient, API error) are recorded with status `failed` and a meaningful `error_message`.
- Push env (optional): `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` enables web push. Without it, dispatcher logs and skips silently while in-app delivery still works.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
