import { useRoute } from "wouter";
import {
  useGetQuotation,
  getGetQuotationQueryKey,
  useGetCompanySettings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import { objectPathToUrl } from "@/lib/upload-file";

export default function QuotationPrint() {
  const [, params] = useRoute("/quotations/:id/print");
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: quotation, isLoading } = useGetQuotation(id, {
    query: { enabled: !!id, queryKey: getGetQuotationQueryKey(id) },
  });
  const { data: company } = useGetCompanySettings();

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!quotation) return <div className="p-8">Quotation not found</div>;

  const companyName = company?.name || "Your Company";
  const tagline = company?.tagline ?? null;
  const logoSrc = objectPathToUrl(company?.logoUrl ?? null);
  const addrParts = [
    company?.addressLine1,
    company?.addressLine2,
    [company?.city, company?.state, company?.pincode].filter(Boolean).join(", "),
    company?.country,
  ].filter(Boolean);
  const contactParts: string[] = [];
  if (company?.phone) contactParts.push(`Tel: ${company.phone}`);
  if (company?.email) contactParts.push(company.email);
  if (company?.website) contactParts.push(company.website);
  const idParts: string[] = [];
  if (company?.gstin) idParts.push(`GSTIN: ${company.gstin}`);
  if (company?.pan) idParts.push(`PAN: ${company.pan}`);
  if (company?.cin) idParts.push(`CIN: ${company.cin}`);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h1 className="text-xl font-bold">Quotation Preview</h1>
          <Button onClick={() => window.print()} data-testid="btn-print-action">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>

        {/* Dynamic company header from Admin → Company Settings */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start gap-4">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={`${companyName} logo`}
              className="h-16 w-16 object-contain shrink-0"
              data-testid="img-company-logo"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-company-name">{companyName}</h1>
            {tagline && (
              <p className="text-sm text-gray-600 mt-1" data-testid="text-company-tagline">{tagline}</p>
            )}
            {addrParts.length > 0 && (
              <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                {addrParts.join(" · ")}
              </p>
            )}
            {(contactParts.length > 0 || idParts.length > 0) && (
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                {contactParts.join(" · ")}
                {contactParts.length > 0 && idParts.length > 0 && " · "}
                {idParts.join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">QUOTATION</h2>
            <p className="text-sm">No: <span className="font-mono">{quotation.quotationNumber}</span></p>
            <p className="text-sm">Date: {formatDate(quotation.createdAt)}</p>
            {quotation.validUntil && <p className="text-sm">Valid Until: {formatDate(quotation.validUntil)}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">Bill To:</p>
            <p className="text-sm">{quotation.accountName || "-"}</p>
          </div>
        </div>

        <h3 className="font-bold text-lg mb-2">{quotation.title}</h3>

        <table className="w-full border-collapse text-sm mb-6">
          <thead>
            <tr className="bg-gray-100 border-y border-black">
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Item</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-left p-2">Unit</th>
              <th className="text-right p-2">Unit Price</th>
              <th className="text-right p-2">Disc %</th>
              <th className="text-right p-2">GST %</th>
              <th className="text-right p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lineItems?.map((li, i) => (
              <tr key={li.id} className="border-b border-gray-300">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">
                  <div className="font-medium">{li.productName}</div>
                  {li.description && <div className="text-xs text-gray-600">{li.description}</div>}
                </td>
                <td className="p-2 text-right">{li.quantity}</td>
                <td className="p-2">{li.unit}</td>
                <td className="p-2 text-right">{formatINR(li.unitPrice)}</td>
                <td className="p-2 text-right">{li.discountPct}%</td>
                <td className="p-2 text-right">{li.gstRate}%</td>
                <td className="p-2 text-right">{formatINR(li.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <table className="text-sm">
            <tbody>
              <tr><td className="pr-8 py-1">Subtotal:</td><td className="text-right">{formatINR(quotation.subtotal)}</td></tr>
              <tr><td className="pr-8 py-1">Discount:</td><td className="text-right">- {formatINR(quotation.discountAmount)}</td></tr>
              <tr><td className="pr-8 py-1">Taxable Amount:</td><td className="text-right">{formatINR(quotation.taxableAmount)}</td></tr>
              <tr><td className="pr-8 py-1">GST:</td><td className="text-right">{formatINR(quotation.gstAmount)}</td></tr>
              <tr className="border-t-2 border-black font-bold"><td className="pr-8 py-2">Grand Total:</td><td className="text-right">{formatINR(quotation.total)}</td></tr>
            </tbody>
          </table>
        </div>

        {quotation.notes && (
          <div className="mb-4">
            <h4 className="font-bold mb-1">Notes</h4>
            <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        {quotation.termsAndConditions && (
          <div>
            <h4 className="font-bold mb-1">Terms & Conditions</h4>
            <p className="text-sm whitespace-pre-wrap">{quotation.termsAndConditions}</p>
          </div>
        )}

        {company?.invoiceFooterNote ? (
          <div className="mt-12 pt-6 border-t border-gray-400 text-center text-xs text-gray-600 whitespace-pre-wrap" data-testid="text-footer-note">
            {company.invoiceFooterNote}
          </div>
        ) : (
          <div className="mt-12 pt-6 border-t border-gray-400 text-center text-xs text-gray-600">
            <p>This is a system-generated quotation from {companyName}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
