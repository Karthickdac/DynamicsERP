import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
const logoImg = "/logo.jpeg";

interface LineItem {
  id: number;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  gstPct: number;
}

interface QuotationData {
  number: string;
  subject: string;
  customer: string;
  createdDate: string;
  validUntil: string;
  status: string;
  items: LineItem[];
}

const defaultQuotation: QuotationData = {
  number: "QT-2026-00001",
  subject: "BOS Supply",
  customer: "Talco",
  createdDate: "23 May 2026",
  validUntil: "30 Jun 2026",
  status: "Draft",
  items: [
    { id: 1, description: "Weather Monitoring Stations", qty: 1, unit: "nos", rate: 145000, discount: 0, gstPct: 18 },
    { id: 2, description: "300 sq mm cable", qty: 400, unit: "Mtrs", rate: 6500, discount: 0, gstPct: 18 },
  ],
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

function computeTotals(items: LineItem[]) {
  let subtotal = 0;
  let totalGst = 0;
  let totalDiscount = 0;

  const rows = items.map((item) => {
    const lineAmount = item.qty * item.rate;
    const discountAmt = (lineAmount * item.discount) / 100;
    const taxableAmt = lineAmount - discountAmt;
    const gstAmt = (taxableAmt * item.gstPct) / 100;
    subtotal += taxableAmt;
    totalGst += gstAmt;
    totalDiscount += discountAmt;
    return { ...item, lineAmount: taxableAmt };
  });

  return { rows, subtotal, totalGst, totalDiscount, total: subtotal + totalGst };
}

export default function QuotationPage() {
  const [quotation] = useState<QuotationData>(defaultQuotation);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { rows, subtotal, totalGst, totalDiscount, total } = computeTotals(quotation.items);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      // Ensure all fonts (including Noto Sans with ₹ glyph) are fully loaded
      await document.fonts.ready;

      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;

      pdf.addImage(imgData, "PNG", imgX, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${quotation.number}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Toolbar */}
      <div className="no-print max-w-[900px] mx-auto mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Quotation Preview</h1>
          <p className="text-sm text-gray-500">Professional PDF Generator</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-60"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Document */}
      <div
        ref={printRef}
        className="print-page max-w-[900px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
        style={{ fontFamily: "'Noto Sans', 'Inter', Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="px-12 pt-10 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-6">
            <img
              src={logoImg}
              alt="Dynamic Green Energy Logo"
              className="w-20 h-20 object-contain flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">M/s.Dynamic Green Energy</h2>
              <p className="text-sm italic text-gray-500 mt-0.5">Reliable Solar Project Developers</p>
              <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                <p>Flat No: 189, Thamirabarani Street, Park Town</p>
                <p>Madurai, Tamilnadu, 625017</p>
                <p>
                  Tel: +91 8072824034&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="mailto:info@dynamicgreenenergy.in" className="text-blue-700">info@dynamicgreenenergy.in</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <span className="text-blue-700">https://dynamicgreenenergy.in</span>
                </p>
                <p className="mt-0.5">GSTIN: 33ATLPV5789M1ZK</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quotation Info */}
        <div className="px-12 py-6 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-y-3">
            <div className="w-1/2">
              <h3 className="text-xl font-bold text-gray-900">Quotation {quotation.number}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{quotation.subject}</p>
            </div>
            <div className="w-1/2 text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                quotation.status.toLowerCase() === "draft"
                  ? "bg-yellow-100 text-yellow-800"
                  : quotation.status.toLowerCase() === "approved"
                  ? "bg-green-100 text-green-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                {quotation.status}
              </span>
            </div>
            <div className="w-full grid grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Customer</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{quotation.customer}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Created</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{quotation.createdDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Valid Until</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{quotation.validUntil}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="px-12 py-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#1e3a6e" }}>
                <th className="px-3 py-3 text-left text-white font-semibold text-xs uppercase tracking-wide w-8">#</th>
                <th className="px-3 py-3 text-left text-white font-semibold text-xs uppercase tracking-wide">Item Description</th>
                <th className="px-3 py-3 text-right text-white font-semibold text-xs uppercase tracking-wide w-16">Qty</th>
                <th className="px-3 py-3 text-left text-white font-semibold text-xs uppercase tracking-wide w-16">Unit</th>
                <th className="px-3 py-3 text-right text-white font-semibold text-xs uppercase tracking-wide w-28">Rate (₹)</th>
                <th className="px-3 py-3 text-right text-white font-semibold text-xs uppercase tracking-wide w-16">Disc%</th>
                <th className="px-3 py-3 text-right text-white font-semibold text-xs uppercase tracking-wide w-16">GST%</th>
                <th className="px-3 py-3 text-right text-white font-semibold text-xs uppercase tracking-wide w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-3 py-3 text-gray-500 text-center">{item.id}</td>
                  <td className="px-3 py-3 text-gray-800 font-medium">{item.description}</td>
                  <td className="px-3 py-3 text-gray-700 text-right">{item.qty.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-3 py-3 text-gray-700 text-right">{item.rate.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-3 text-gray-700 text-right">{item.discount}%</td>
                  <td className="px-3 py-3 text-gray-700 text-right">{item.gstPct}%</td>
                  <td className="px-3 py-3 text-gray-900 font-semibold text-right">
                    {item.lineAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-12 pb-8">
          <div className="flex justify-end">
            <div className="w-72">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-medium text-gray-800">
                    ₹ {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Discount</span>
                    <span className="text-sm font-medium text-red-600">
                      − ₹ {totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-600">GST</span>
                  <span className="text-sm font-medium text-gray-800">
                    ₹ {totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3.5" style={{ backgroundColor: "#1e3a6e" }}>
                  <span className="text-base font-bold text-white">Total</span>
                  <span className="text-base font-bold text-white">
                    ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Notes */}
        <div className="px-12 pb-8 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Terms & Conditions</h4>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Prices are valid until the date mentioned above.</li>
            <li>GST as applicable will be charged extra on the above amounts.</li>
            <li>Delivery within 4–6 weeks from the date of purchase order.</li>
            <li>Payment: 50% advance, balance before dispatch.</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="px-12 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-xs text-gray-400">This is a computer-generated document. No signature required.</p>
          <p className="text-xs text-gray-400">M/s.Dynamic Green Energy · GSTIN: 33ATLPV5789M1ZK</p>
        </div>
      </div>
    </div>
  );
}
