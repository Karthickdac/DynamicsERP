import { Router, type IRouter } from "express";
import { db, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function dto(r: typeof companySettingsTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    legalName: r.legalName,
    tagline: r.tagline,
    logoUrl: r.logoUrl,
    email: r.email,
    phone: r.phone,
    website: r.website,
    addressLine1: r.addressLine1,
    addressLine2: r.addressLine2,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    country: r.country,
    gstin: r.gstin,
    pan: r.pan,
    cin: r.cin,
    bankName: r.bankName,
    bankAccountNo: r.bankAccountNo,
    bankIfsc: r.bankIfsc,
    bankBranch: r.bankBranch,
    invoiceFooterNote: r.invoiceFooterNote,
    termsAndConditions: r.termsAndConditions,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function ensureCompanySettings() {
  const rows = await db.select().from(companySettingsTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(companySettingsTable).values({
    name: "Dynamic Green Energy",
    legalName: "Dynamic Green Energy Pvt. Ltd.",
    tagline: "Solar Power. Sustainable Future.",
    email: "info@dynamicsgreenenergy.in",
    phone: "+91 80 0000 0000",
    website: "https://dynamicsgreenenergy.in",
    addressLine1: "Plot No. 12, Industrial Area",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560100",
    country: "India",
    gstin: "29ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    bankName: "HDFC Bank",
    bankAccountNo: "50200012345678",
    bankIfsc: "HDFC0000123",
    bankBranch: "Whitefield, Bengaluru",
    invoiceFooterNote: "Thank you for your business. Powered by Dynamic Green Energy.",
    termsAndConditions: "1. Payment due within 30 days. 2. Subject to Bengaluru jurisdiction.",
  }).returning();
  return created;
}

router.get("/company-settings", requireAuth, async (_req, res): Promise<void> => {
  const row = await ensureCompanySettings();
  res.json(dto(row));
});

router.put("/company-settings", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const existing = await ensureCompanySettings();
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "name", "legalName", "tagline", "logoUrl", "email", "phone", "website",
    "addressLine1", "addressLine2", "city", "state", "pincode", "country",
    "gstin", "pan", "cin", "bankName", "bankAccountNo", "bankIfsc", "bankBranch",
    "invoiceFooterNote", "termsAndConditions",
  ]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  const [row] = await db.update(companySettingsTable).set(update).where(eq(companySettingsTable.id, existing.id)).returning();
  res.json(dto(row));
});

export default router;
