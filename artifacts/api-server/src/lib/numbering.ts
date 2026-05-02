import { sql, type AnyColumn } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function lockKey(prefix: string, year: number): number {
  let h = year >>> 0;
  for (const c of prefix) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return h & 0x7fffffff;
}

/**
 * Atomically generate the next document number of the form `{prefix}-{year}-{NNNNN}`.
 * Uses a Postgres advisory transaction lock keyed on (prefix, year) so concurrent
 * insertions cannot collide. MUST be called inside a transaction (`tx`).
 */
export async function nextDocNumber(
  tx: DbOrTx,
  prefix: string,
  table: PgTable,
  numberCol: AnyColumn,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const key = lockKey(prefix, year);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${key})`);
  const result = await tx.execute(
    sql`SELECT MAX(${numberCol}) AS max FROM ${table} WHERE ${numberCol} LIKE ${yearPrefix + "%"}`,
  );
  const rows = (result as any).rows ?? (result as any);
  const max = rows?.[0]?.max as string | null | undefined;
  let next = 1;
  if (max && typeof max === "string") {
    const parsed = parseInt(max.slice(yearPrefix.length), 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  }
  return `${yearPrefix}${String(next).padStart(5, "0")}`;
}
