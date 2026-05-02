import { format } from "date-fns";

export function formatINR(value: number | undefined | null) {
  if (value == null) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "dd MMM yyyy");
}
