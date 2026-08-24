import { toast } from "sonner";
import { describeApiError } from "./apiError";
import type { ApiErrorInfo } from "./apiError";
import { t } from "@/lib/i18n";

function showApiError(info: ApiErrorInfo): void {
  if (info.kind === "system") {
    toast.error(t("Lỗi hệ thống"), {
      description: info.message,
      duration: 8000,
    });
    return;
  }
  toast.error(info.message, { duration: 5000 });
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

export function notifySuccess(msg: string): void {
  toast.success(msg);
}

export function notifyError(msg: string): void {
  toast.error(msg);
}
