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
- **Dashboard** — Pipeline value, lead count, conversion rate, recent activity feed.
- **Admin** — Company Settings (single-row, used in PDFs/emails), Users (full CRUD + role/active filters + password reset), Staff (HR directory, manual + MysticsHR sync stub), Email Templates (system + custom, double-curly placeholders, per-category), Integrations (MysticsHR connector — settings save now, endpoint wiring pending API spec).
- **Email & Templates** — Per-document Send Email action on invoices, quotations, sales orders, POs, vendor invoices, payments, expenses; uses templates rendered with entity context (`{{customer.name}}`, `{{invoice.number}}`, `{{company.name}}`, etc.). All emails persisted in `email_log` whether SMTP delivers or not (graceful no-op).
- **Print & Export** — Reusable Print + PDF + Excel buttons (jsPDF / jspdf-autotable / xlsx) on key documents and reports. PDFs include the configured company header, GSTIN/PAN, and invoice footer note from Company Settings.

### Test users (password: `password123`)
- admin@dynamicsgreenenergy.in (admin)  •  sales@dynamicsgreenenergy.in (sales)  •  pm@dynamicsgreenenergy.in (project_manager)  •  finance@dynamicsgreenenergy.in (finance)  •  service@dynamicsgreenenergy.in (service)

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
- Notification env (optional): `SMTP_HOST/USER/PASS/FROM` enables email; `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` enables web push. Without them, dispatcher logs and skips silently while in-app delivery still works.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
