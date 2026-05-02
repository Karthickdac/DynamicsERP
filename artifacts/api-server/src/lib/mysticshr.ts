import { logger } from "./logger";

/**
 * MysticsHR connector — REST client for the MysticsHR HR system.
 *
 * Contract (per the MysticsHR API spec):
 *   GET {baseUrl}/api/v1/employees?limit={n}&offset={m}
 *     Headers:
 *       Authorization: Bearer {apiKey}
 *       Accept: application/json
 *     Response (200):
 *       { "data": [Employee, ...], "total": 234, "limit": 200, "offset": 0 }
 *
 * If `baseUrl` already ends in `/api`, we keep it; otherwise we append `/api`.
 * If the server omits `total`, we keep paging until a partial page is returned.
 *
 * Employee shape (snake_case or camelCase accepted; nulls allowed):
 *   {
 *     "id": 12345,                       // numeric or string external stable id
 *     "employeeId": "EMP-001",           // unique HR code
 *     "firstName": "Asha",
 *     "lastName": "Verma",
 *     "email": "asha@example.com",
 *     "phone": "+91 98765 43210",
 *     "designation": "Engineer",
 *     "department": "Operations",
 *     "dateOfJoining": "2023-04-01",     // ISO date
 *     "exitDate": null,                  // ISO date or null
 *     "status": "active",                // active | inactive | on_leave | terminated
 *     "employmentType": "full_time",
 *     "location": "Bengaluru",
 *     "managerExternalId": "12340"       // optional — links to another Employee.id
 *   }
 *
 * Notes:
 * - We are defensive about field naming (snake_case vs camelCase) and
 *   pagination shape so minor spec drift doesn't break the connector.
 * - HTTP non-2xx responses are fatal for the whole sync (logged + surfaced).
 * - Per-record mapping failures are isolated and counted as `failed`.
 */

export interface MysticsHrEmployee {
  externalId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  joiningDate: string | null;
  exitDate: string | null;
  status: "active" | "inactive" | "on_leave" | "terminated";
  employmentType: string | null;
  workLocation: string | null;
  managerExternalId: string | null;
}

export interface MysticsHrFetchOptions {
  baseUrl: string;
  apiKey: string;
  limit?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface MysticsHrFetchResult {
  employees: MysticsHrEmployee[];
  parseFailures: Array<{ raw: unknown; reason: string }>;
}

const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_PAGES = 200; // safety: 40k employees max per sync

const VALID_STAFF_STATUSES = new Set(["active", "inactive", "on_leave", "terminated"]);

function pickString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

function normaliseStatus(raw: string | null): MysticsHrEmployee["status"] {
  if (!raw) return "active";
  const s = raw.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (VALID_STAFF_STATUSES.has(s)) return s as MysticsHrEmployee["status"];
  if (s === "employed" || s === "onboarding") return "active";
  if (s === "leave" || s === "sabbatical") return "on_leave";
  if (s === "resigned" || s === "separated" || s === "exited" || s === "retired") return "inactive";
  return "active";
}

function normaliseDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function mapEmployee(raw: any): MysticsHrEmployee {
  const externalId = pickString(raw, ["id", "external_id", "externalId", "employeeId", "employee_id"]);
  const employeeCode = pickString(raw, ["employeeId", "employee_id", "employee_code", "employeeCode", "code", "empCode"]);
  const firstName = pickString(raw, ["firstName", "first_name", "givenName", "given_name"]);
  const lastName = pickString(raw, ["lastName", "last_name", "familyName", "family_name", "surname"]);

  if (!externalId) throw new Error("missing id");
  if (!employeeCode) throw new Error("missing employeeId");
  if (!firstName) throw new Error("missing firstName");
  if (!lastName) throw new Error("missing lastName");

  return {
    externalId,
    employeeCode,
    firstName,
    lastName,
    email: pickString(raw, ["email", "work_email", "workEmail"]),
    phone: pickString(raw, ["phone", "mobile", "phone_number", "phoneNumber"]),
    designation: pickString(raw, ["designation", "title", "job_title", "jobTitle", "role"]),
    department: pickString(raw, ["department", "dept"]),
    joiningDate: normaliseDate(pickString(raw, ["dateOfJoining", "date_of_joining", "joining_date", "joiningDate", "hire_date", "hireDate"])),
    exitDate: normaliseDate(pickString(raw, ["exit_date", "exitDate", "termination_date", "terminationDate", "last_working_day"])),
    status: normaliseStatus(pickString(raw, ["status", "employment_status", "employmentStatus"])),
    employmentType: pickString(raw, ["employmentType", "employment_type", "type"]),
    workLocation: pickString(raw, ["location", "work_location", "workLocation", "office"]),
    managerExternalId: pickString(raw, ["managerExternalId", "manager_external_id", "manager_id", "managerId", "reports_to_id", "reportsToId"]),
  };
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.employees)) return payload.employees;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export class MysticsHrApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `MysticsHR API error ${status}`);
    this.name = "MysticsHrApiError";
    this.status = status;
    this.body = body;
  }
}

function resolveApiBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export async function fetchAllEmployees(opts: MysticsHrFetchOptions): Promise<MysticsHrFetchResult> {
  const apiBase = resolveApiBase(opts.baseUrl);
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_LIMIT, 500));
  const maxPages = Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES);
  const fetchImpl = opts.fetchImpl ?? fetch;

  const employees: MysticsHrEmployee[] = [];
  const parseFailures: Array<{ raw: unknown; reason: string }> = [];
  const seen = new Set<string>();

  let offset = 0;
  let total = Infinity;

  for (let page = 1; page <= maxPages; page++) {
    if (offset >= total) break;
    const url = `${apiBase}/v1/employees?limit=${limit}&offset=${offset}`;
    logger.info({ provider: "mysticshr", url, page, offset }, "MysticsHR fetch page");

    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          Accept: "application/json",
        },
        signal: opts.signal,
      });
    } catch (err: any) {
      logger.error({ provider: "mysticshr", url, err: err?.message }, "MysticsHR network error");
      throw new MysticsHrApiError(0, String(err?.message ?? err), `Network error contacting MysticsHR: ${err?.message ?? err}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ provider: "mysticshr", url, status: res.status, body: body.slice(0, 500) }, "MysticsHR HTTP error");
      throw new MysticsHrApiError(res.status, body, `MysticsHR ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 200)}`);
    }

    let payload: any;
    try {
      payload = await res.json();
    } catch (err: any) {
      throw new MysticsHrApiError(res.status, "", `MysticsHR returned non-JSON response: ${err?.message ?? err}`);
    }

    const rows = pickArray(payload);
    for (const raw of rows) {
      try {
        const emp = mapEmployee(raw);
        if (seen.has(emp.externalId)) continue;
        seen.add(emp.externalId);
        employees.push(emp);
      } catch (err: any) {
        parseFailures.push({ raw, reason: err?.message ?? String(err) });
      }
    }

    if (typeof payload?.total === "number") total = payload.total;
    if (rows.length < limit) break;
    offset += limit;
  }

  return { employees, parseFailures };
}
