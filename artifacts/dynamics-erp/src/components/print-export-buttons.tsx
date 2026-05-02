import { Printer, FileDown, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCompanySettings } from "@workspace/api-client-react";
import { exportPdf, exportExcel, printNode, type PdfOptions, type ExcelSheet, type CompanyHeader } from "@/lib/export";

type Props = {
  title: string;
  subtitle?: string;
  filename: string;
  meta?: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Array<Array<string | number>>;
  totals?: Array<{ label: string; value: string }>;
  excelSheets?: ExcelSheet[];
  showPrint?: boolean;
  size?: "sm" | "default";
};

export function PrintExportButtons({ title, subtitle, filename, meta, columns, rows, totals, excelSheets, showPrint = false, size = "sm" }: Props) {
  const { data: company } = useGetCompanySettings();
  const companyHeader: CompanyHeader | null = company ? {
    name: company.name,
    legalName: company.legalName ?? null,
    tagline: company.tagline ?? null,
    email: company.email ?? null,
    phone: company.phone ?? null,
    website: company.website ?? null,
    addressLine1: company.addressLine1 ?? null,
    addressLine2: company.addressLine2 ?? null,
    city: company.city ?? null,
    state: company.state ?? null,
    pincode: company.pincode ?? null,
    gstin: company.gstin ?? null,
    pan: company.pan ?? null,
    logoUrl: company.logoUrl ?? null,
  } : null;

  const onPdf = async () => {
    const opts: PdfOptions = {
      title, subtitle, meta, columns, rows, totals,
      company: companyHeader,
      footerNote: company?.invoiceFooterNote ?? null,
      filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    };
    await exportPdf(opts);
  };

  const onExcel = () => {
    const sheets: ExcelSheet[] = excelSheets ?? [{ name: title.slice(0, 28), columns, rows: rows.map(r => r.slice()) }];
    exportExcel(filename, sheets);
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      {showPrint && (
        <Button type="button" variant="outline" size={size} onClick={printNode} data-testid="btn-print">
          <Printer className="h-4 w-4 mr-1.5" /> Print
        </Button>
      )}
      <Button type="button" variant="outline" size={size} onClick={onPdf} data-testid="btn-export-pdf">
        <FileDown className="h-4 w-4 mr-1.5" /> PDF
      </Button>
      <Button type="button" variant="outline" size={size} onClick={onExcel} data-testid="btn-export-excel">
        <Sheet className="h-4 w-4 mr-1.5" /> Excel
      </Button>
    </div>
  );
}
