import { db, roleModuleAccessTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { MANAGED_ROLES, MODULE_KEYS, MODULE_REGISTRY } from "./modules";

export type AssignmentInput = { role: string; moduleKey: string };

let seedPromise: Promise<void> | null = null;

/** Insert default role→module rows iff the table is empty. Idempotent. */
export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existing = await db.select({ role: roleModuleAccessTable.role }).from(roleModuleAccessTable).limit(1);
    if (existing.length > 0) return;
    const rows: AssignmentInput[] = [];
    for (const m of MODULE_REGISTRY) {
      for (const role of m.defaultRoles) {
        if (MANAGED_ROLES.includes(role)) {
          rows.push({ role, moduleKey: m.key });
        }
      }
    }
    if (rows.length > 0) {
      await db.insert(roleModuleAccessTable).values(rows).onConflictDoNothing();
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

export async function getAllAssignments(): Promise<AssignmentInput[]> {
  await ensureSeeded();
  const rows = await db
    .select({ role: roleModuleAccessTable.role, moduleKey: roleModuleAccessTable.moduleKey })
    .from(roleModuleAccessTable);
  return rows
    .filter((r) => MANAGED_ROLES.includes(r.role) && MODULE_KEYS.has(r.moduleKey))
    .map((r) => ({ role: r.role, moduleKey: r.moduleKey }));
}

/**
 * Replace all assignments for the given roles with the provided list.
 * Roles outside MANAGED_ROLES and modules outside MODULE_KEYS are silently dropped.
 */
export async function replaceAssignments(input: AssignmentInput[]): Promise<void> {
  // Filter to known roles + modules to prevent garbage rows.
  const sanitized = input.filter(
    (a) => MANAGED_ROLES.includes(a.role) && MODULE_KEYS.has(a.moduleKey),
  );
  // Dedupe
  const seen = new Set<string>();
  const unique: AssignmentInput[] = [];
  for (const a of sanitized) {
    const k = `${a.role}::${a.moduleKey}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(a);
    }
  }
  // We replace the entire managed-roles slice atomically.
  await db.transaction(async (tx) => {
    await tx
      .delete(roleModuleAccessTable)
      .where(inArray(roleModuleAccessTable.role, MANAGED_ROLES as unknown as string[]));
    if (unique.length > 0) {
      await tx.insert(roleModuleAccessTable).values(unique).onConflictDoNothing();
    }
  });
}

/**
 * Returns the set of module keys accessible to the given role.
 * Admin always has access to every module. Unknown roles get nothing.
 */
export async function getAccessibleModules(role: string): Promise<string[]> {
  if (role === "admin") return MODULE_REGISTRY.map((m) => m.key);
  if (!MANAGED_ROLES.includes(role)) return [];
  await ensureSeeded();
  const rows = await db
    .select({ moduleKey: roleModuleAccessTable.moduleKey })
    .from(roleModuleAccessTable)
    .where(eq(roleModuleAccessTable.role, role));
  return rows.map((r) => r.moduleKey).filter((k) => MODULE_KEYS.has(k));
}

export async function hasModuleAccess(role: string, moduleKey: string): Promise<boolean> {
  if (role === "admin") return MODULE_KEYS.has(moduleKey);
  if (!MANAGED_ROLES.includes(role)) return false;
  if (!MODULE_KEYS.has(moduleKey)) return false;
  await ensureSeeded();
  const rows = await db
    .select({ role: roleModuleAccessTable.role })
    .from(roleModuleAccessTable)
    .where(
      and(
        eq(roleModuleAccessTable.role, role),
        eq(roleModuleAccessTable.moduleKey, moduleKey),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
