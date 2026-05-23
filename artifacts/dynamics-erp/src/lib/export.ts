import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { objectPathToUrl } from "./upload-file";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type CompanyHeader = {
  name: string;
  legalName?: string | null;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  logoUrl?: string | null;
};

export type PdfOptions = {
  title: string;
  subtitle?: string;
  company?: CompanyHeader | null;
  meta?: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Array<Array<string | number>>;
  totals?: Array<{ label: string; value: string }>;
  footerNote?: string | null;
  filename?: string;
};

async function fetchImageAsDataUrl(
  rawUrl: string,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  // Normalize stored object paths (e.g. "/objects/uploads/...") to the
  // authenticated `/api/storage/...` endpoint that actually serves them.
  const url = objectPathToUrl(rawUrl) ?? rawUrl;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > MAX_LOGO_BYTES) return null;
    const ct = blob.type || "image/png";
    const format: "PNG" | "JPEG" = ct.includes("jpeg") || ct.includes("jpg") ? "JPEG" : "PNG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}

async function addCompanyHeader(
  doc: jsPDF,
  company: CompanyHeader | null | undefined,
): Promise<number> {
  let y = 14;
  if (!company) return y;

  // Optional logo on the left
  let textLeft = 14;
  let logoBottom = y;
  if (company.logoUrl) {
    const img = await fetchImageAsDataUrl(company.logoUrl);
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, 14, y, 22, 22);
        textLeft = 40;
        logoBottom = y + 22;
      } catch {
        // ignore image errors and fall back to text-only
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company.name, textLeft, y + 5);
  let cursor = y + 5;

  if (company.tagline) {
    cursor += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(company.tagline, textLeft, cursor);
    doc.setTextColor(0);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addrParts = [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.state, company.pincode].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];
  for (const line of addrParts) {
    cursor += 4;
    doc.text(line, textLeft, cursor);
  }
  const contact: string[] = [];
  if (company.phone) contact.push(`Tel: ${company.phone}`);
  if (company.email) contact.push(company.email);
  if (company.website) contact.push(company.website);
  if (contact.length) {
    cursor += 4;
    doc.text(contact.join("  •  "), textLeft, cursor);
  }
  const ids: string[] = [];
  if (company.gstin) ids.push(`GSTIN: ${company.gstin}`);
  if (company.pan) ids.push(`PAN: ${company.pan}`);
  if (ids.length) {
    cursor += 4;
    doc.text(ids.join("  •  "), textLeft, cursor);
  }

  return Math.max(cursor, logoBottom) + 4;
}

/** jsPDF's built-in fonts (Helvetica/Times/Courier) are Latin-1 only and
 *  cannot render the ₹ glyph — it comes out as ¹. Replace it with "Rs."
 *  so the PDF is readable without embedding a full Unicode font. */
function rupeeToRs(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/₹\s*/g, "Rs. ");
}

export async function exportPdf(opts: PdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = await addCompanyHeader(doc, opts.company);
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(opts.title, 14, y);
  y += 5;
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(opts.subtitle, 14, y);
    y += 5;
  }
  if (opts.meta && opts.meta.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const m of opts.meta) {
      doc.text(`${m.label}: ${m.value}`, 14, y);
      y += 4;
    }
    y += 1;
  }
  autoTable(doc, {
    startY: y,
    head: [opts.columns.map(rupeeToRs)],
    body: opts.rows.map(r => r.map(c => rupeeToRs(c))),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 90, 140], textColor: 255 },
    margin: { left: 14, right: 14 },
  });
  let endY = (doc as any).lastAutoTable?.finalY ?? y;
  if (opts.totals && opts.totals.length) {
    endY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    for (const t of opts.totals) {
      doc.text(`${rupeeToRs(t.label)}:  ${rupeeToRs(t.value)}`, 196, endY, { align: "right" });
      endY += 5;
    }
  }
  if (opts.footerNote) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(rupeeToRs(opts.footerNote), 14, pageHeight - 10);
  }
  if (opts.filename) doc.save(opts.filename);
  return doc;
}

export type ExcelSheet = {
  name: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

export function exportExcel(filename: string, sheets: ExcelSheet[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const data = [s.columns, ...s.rows.map(r => r.map(c => (c == null ? "" : c)))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || "Sheet1");
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function printNode(): void {
  window.print();
}
