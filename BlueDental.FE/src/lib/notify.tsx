import { toast } from "sonner";
import { describeApiError } from "./apiError";
import type { ApiErrorInfo } from "./apiError";
import { t } from "@/lib/i18n";

function showApiError(info: ApiErrorInfo): void {
  const msg =
    info.kind === "system"
      ? `${t("Lỗi hệ thống")}: ${info.message}`
      : info.message;
  toast.error(msg, {
    id: `bluedental-error-${info.message}`,
    duration: info.kind === "system" ? 8000 : 5000,
  });
}

export function logApiError(error: unknown, context?: string): void {
  console.error(
    `[BlueDental] Lỗi API${context ? ` (${context})` : ""}:`,
    error,
  );
}

export function notifyApiError(error: unknown): void {
  const info = describeApiError(error);
  if (info.canceled) return;
  if (info.status === 401) return;
  showApiError(info);
}
