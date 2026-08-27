/** Format bytes to human-readable string */
export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format date as DD/MM/YYYY (Vietnamese locale) */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format datetime as DD/MM/YYYY HH:mm */
export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return (
    date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Format currency as VND with symbol */
/** HH:mm in local time, or a placeholder when there is no instant. */
export function formatClock(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "--:--"
    : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format VND amount as dot-separated number without symbol (e.g. 24.000.000) */
export function formatVND(value: number): string {
  if (value === 0) return "0";
  return value.toLocaleString("vi-VN");
}

/** Table-cell fallback — an em dash when there is no value (a 0 stays 0). */
export function formatDash(value: string | number | null | undefined): string | number {
  return value === null || value === undefined || value === "" ? "—" : value;
}
