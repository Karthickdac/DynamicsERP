import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type CompanyHeader = {
  name: string;
  legalName?: string | null;
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

function addCompanyHeader(doc: jsPDF, company: CompanyHeader | null | undefined): number {
  let y = 14;
  if (!company) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company.name, 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addrParts = [company.addressLine1, company.addressLine2, [company.city, company.state, company.pincode].filter(Boolean).join(", ")].filter(Boolean) as string[];
  for (const line of addrParts) { doc.text(line, 14, y); y += 4; }
  const contact: string[] = [];
  if (company.phone) contact.push(`Tel: ${company.phone}`);
  if (company.email) contact.push(company.email);
  if (company.website) contact.push(company.website);
  if (contact.length) { doc.text(contact.join("  •  "), 14, y); y += 4; }
  const ids: string[] = [];
  if (company.gstin) ids.push(`GSTIN: ${company.gstin}`);
  if (company.pan) ids.push(`PAN: ${company.pan}`);
  if (ids.length) { doc.text(ids.join("  •  "), 14, y); y += 4; }
  return y + 2;
}

export function exportPdf(opts: PdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = addCompanyHeader(doc, opts.company);
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
    head: [opts.columns],
    body: opts.rows.map(r => r.map(c => (c == null ? "" : String(c)))),
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
      doc.text(`${t.label}:  ${t.value}`, 196, endY, { align: "right" });
      endY += 5;
    }
  }
  if (opts.footerNote) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(opts.footerNote, 14, pageHeight - 10);
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
