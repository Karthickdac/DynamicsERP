// Module registry — single source of truth for what can be access-controlled.
// Each entry maps to a navigable area of the app. Admin always has access to
// every module; the role_module_access table is consulted for everyone else.

export type ModuleDefinition = {
  key: string;
  label: string;
  group: string;
  /** Default-on for these roles when the seed runs and no rows exist yet. */
  defaultRoles: string[];
};

const ALL_NON_ADMIN = [
  "sales",
  "project_manager",
  "finance",
  "service",
  "engineer",
  "hr",
];

export const MODULE_REGISTRY: ReadonlyArray<ModuleDefinition> = [
  // Dashboard — everyone gets it by default
  { key: "dashboard", label: "Dashboard", group: "General", defaultRoles: ALL_NON_ADMIN },

  // CRM
  { key: "crm.leads", label: "Leads", group: "CRM", defaultRoles: ["sales", "project_manager"] },
  { key: "crm.accounts", label: "Accounts", group: "CRM", defaultRoles: ["sales", "project_manager", "service", "finance"] },
  { key: "crm.contacts", label: "Contacts", group: "CRM", defaultRoles: ["sales", "project_manager", "service", "finance"] },

  // Sales
  { key: "sales.catalog", label: "Catalog", group: "Sales", defaultRoles: ["sales"] },
  { key: "sales.quotations", label: "Quotations", group: "Sales", defaultRoles: ["sales"] },
  { key: "sales.estimations", label: "Estimations", group: "Sales", defaultRoles: ["sales", "engineer"] },
  { key: "sales.approvals", label: "Approvals", group: "Sales", defaultRoles: ["sales"] },
  { key: "sales.orders", label: "Sales Orders", group: "Sales", defaultRoles: ["sales", "project_manager"] },

  // Operations
  { key: "ops.projects", label: "Projects", group: "Operations", defaultRoles: ["project_manager", "engineer"] },
  { key: "ops.service_tickets", label: "Service Tickets", group: "Operations", defaultRoles: ["service", "engineer", "project_manager"] },
  { key: "ops.amc_contracts", label: "AMC Contracts", group: "Operations", defaultRoles: ["service", "finance"] },

  // Billing
  { key: "billing.invoices", label: "Invoices", group: "Billing", defaultRoles: ["finance"] },
  { key: "billing.financial", label: "Financial Dashboard", group: "Billing", defaultRoles: ["finance"] },
  { key: "billing.ageing", label: "Ageing Report", group: "Billing", defaultRoles: ["finance"] },
  { key: "billing.gst", label: "GST Reports", group: "Billing", defaultRoles: ["finance"] },

  // Procurement
  { key: "proc.dashboard", label: "Procurement Dashboard", group: "Procurement", defaultRoles: ["finance"] },
  { key: "proc.vendors", label: "Vendors", group: "Procurement", defaultRoles: ["finance"] },
  { key: "proc.purchase_orders", label: "Purchase Orders", group: "Procurement", defaultRoles: ["finance"] },
  { key: "proc.vendor_invoices", label: "Vendor Invoices", group: "Procurement", defaultRoles: ["finance"] },
  { key: "proc.expenses", label: "Expenses", group: "Procurement", defaultRoles: ["finance"] },
];

export const MODULE_KEYS: ReadonlySet<string> = new Set(MODULE_REGISTRY.map((m) => m.key));

/** Roles that appear in the module-access matrix (admin is excluded — always full). */
export const MANAGED_ROLES: ReadonlyArray<string> = [
  "sales",
  "project_manager",
  "finance",
  "service",
  "engineer",
  "hr",
];
