import { toast } from "sonner";
import { describeApiError } from "./apiError";
import type { ApiErrorInfo } from "./apiError";
import { t } from "@/lib/i18n";

/**
 * One sonner id per message, so the same failure can never stack.
 *
 * A mutation that is awaited in a try/catch reports its error twice: once from
 * the caller's own `catch`, once from the mutation cache's global handler.
 * Both derive the text from the same response, so sharing the id collapses
 * them into the single toast the user should see.
 */
function errorToastId(message: string): string {
  return `bluedental-error-${message}`;
}

function showApiError(info: ApiErrorInfo): void {
  const msg =
    info.kind === "system"
      ? `${t("Common:Error:SystemPrefix")}: ${info.message}`
      : info.message;
  toast.error(msg, {
    id: errorToastId(info.message),
    duration: info.kind === "system" ? 8000 : 5000,
  });
}

/**
 * An error a screen reports itself, on the same de-duplicated channel as
 * {@link notifyApiError}. Use this rather than `toast.error` whenever the text
 * comes from `extractApiError`.
 */
export function notifyError(message: string): void {
  toast.error(message, { id: errorToastId(message), duration: 5000 });
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
