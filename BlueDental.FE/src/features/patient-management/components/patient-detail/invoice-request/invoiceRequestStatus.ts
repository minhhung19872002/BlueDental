import { t } from "@/lib/i18n";
import {
  INVOICE_REQUEST_STATUS,
  type InvoiceRequestDto,
  type InvoiceRequestStatsDto,
  type InvoiceRequestStatus,
} from "../../../api/invoiceRequestApi";

type StatusTone = "amber" | "blue" | "green" | "red" | "grey";

/** Label and colour of each status, the chip that filters on it and the stat that counts it. */
export const INVOICE_REQUEST_STATUS_CONFIG: Record<
  InvoiceRequestStatus,
  { labelKey: string; tone: StatusTone; stat: keyof InvoiceRequestStatsDto }
> = {
  [INVOICE_REQUEST_STATUS.Pending]: { labelKey: "Patient:InvoiceRequest:Status:Pending", tone: "amber", stat: "pending" },
  [INVOICE_REQUEST_STATUS.Processing]: { labelKey: "Patient:InvoiceRequest:Status:Processing", tone: "blue", stat: "processing" },
  [INVOICE_REQUEST_STATUS.Issued]: { labelKey: "Patient:InvoiceRequest:Status:Issued", tone: "green", stat: "issued" },
  // P1811: cancelled on EasyInvoice is a red tag — it waits for Xử lý lại.
  [INVOICE_REQUEST_STATUS.Cancelled]: { labelKey: "Patient:InvoiceRequest:Status:Cancelled", tone: "red", stat: "cancelled" },
  [INVOICE_REQUEST_STATUS.Withdrawn]: { labelKey: "Patient:InvoiceRequest:Status:Withdrawn", tone: "grey", stat: "withdrawn" },
};

/** The chips over the table: everything, "Cần xử lý", then one per status. */
export type InvoiceRequestFilter = "all" | "open" | InvoiceRequestStatus;

export const INVOICE_REQUEST_FILTERS: readonly InvoiceRequestFilter[] = [
  "all",
  "open",
  INVOICE_REQUEST_STATUS.Pending,
  INVOICE_REQUEST_STATUS.Processing,
  INVOICE_REQUEST_STATUS.Issued,
  INVOICE_REQUEST_STATUS.Cancelled,
  INVOICE_REQUEST_STATUS.Withdrawn,
];

export function filterLabel(filter: InvoiceRequestFilter): string {
  if (filter === "all") return t("Patient:InvoiceRequest:Filter:All");
  if (filter === "open") return t("Patient:InvoiceRequest:Filter:Open");
  return t(INVOICE_REQUEST_STATUS_CONFIG[filter].labelKey);
}

export function filterCount(filter: InvoiceRequestFilter, stats: InvoiceRequestStatsDto | undefined): number {
  if (!stats) return 0;
  if (filter === "all") return stats.total;
  if (filter === "open") return stats.open;
  return stats[INVOICE_REQUEST_STATUS_CONFIG[filter].stat];
}

/**
 * Mới and Đã hủy wait on staff: Xử lý (lại) sends them, Sửa and Hủy yêu cầu
 * still apply. Chờ xử lý, Đã xuất HĐ and Đã hủy yêu cầu are only looked at.
 */
export function needsAction(status: InvoiceRequestStatus): boolean {
  return status === INVOICE_REQUEST_STATUS.Pending || status === INVOICE_REQUEST_STATUS.Cancelled;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Under this much time left the deadline turns amber. */
const SOON = 4 * HOUR;

/** "MỚI": nobody has picked it up and it came in within the last day (UNKNOWN_REFERENCE_BEHAVIOR). */
export function isNewRequest(row: InvoiceRequestDto, now: number): boolean {
  return row.status === INVOICE_REQUEST_STATUS.Pending && now - Date.parse(row.requestedAt) < DAY;
}

export interface DueView {
  tone: "ok" | "soon" | "late" | "none";
  text: string;
}

/**
 * The Hạn xử lý cell. The clock runs from the request until Xử lý first sends
 * it: a Mới request shows time left or over, a sent one whether it went out
 * in time, a withdrawn one nothing.
 */
export function describeDue(row: InvoiceRequestDto, now: number): DueView {
  const due = Date.parse(row.dueAt);
  if (row.status === INVOICE_REQUEST_STATUS.Withdrawn) return { tone: "none", text: "—" };
  if (row.status === INVOICE_REQUEST_STATUS.Pending) return due > now ? timeLeft(due - now) : timeOver(now - due);

  const late = row.processedAt !== null && Date.parse(row.processedAt) > due;
  return late
    ? { tone: "late", text: t("Patient:InvoiceRequest:Due:Late") }
    : { tone: "ok", text: t("Patient:InvoiceRequest:Due:OnTime") };
}

function timeLeft(ms: number): DueView {
  const tone = ms < SOON ? "soon" : "ok";
  if (ms < HOUR) return { tone, text: t("Patient:InvoiceRequest:Due:MinutesLeft", Math.ceil(ms / 60000)) };
  return { tone, text: t("Patient:InvoiceRequest:Due:HoursLeft", Math.floor(ms / HOUR)) };
}

function timeOver(ms: number): DueView {
  if (ms < DAY) return { tone: "late", text: t("Patient:InvoiceRequest:Due:HoursOver", Math.max(1, Math.floor(ms / HOUR))) };
  return { tone: "late", text: t("Patient:InvoiceRequest:Due:DaysOver", Math.floor(ms / DAY)) };
}
