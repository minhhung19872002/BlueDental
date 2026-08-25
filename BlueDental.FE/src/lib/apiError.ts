import axios from "axios";
import { t } from "@/lib/i18n";

export type ApiErrorKind = "user" | "system" | "network";

export interface ApiErrorInfo {
  message: string;
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  canceled: boolean;
}

interface AbpValidationError {
  message?: string;
  members?: string[];
}

interface AbpErrorEnvelope {
  code?: string;
  message?: string;
  details?: string;
  validationErrors?: AbpValidationError[];
}

/**
 * Rebuilt on each call rather than held in module constants: t() reads the
 * overlay that is current now, and a constant would freeze the language that
 * happened to be loaded when this module was first imported.
 */
const messages = () => ({
  unknown: t("Đã xảy ra lỗi không xác định. Vui lòng thử lại."),
  system: t("Hệ thống đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ quản trị viên."),
  invalidInput: t("Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập."),
  forbidden: t("Bạn không có quyền thực hiện thao tác này."),
  offline: t("Không kết nối được tới máy chủ. Vui lòng kiểm tra đường truyền và thử lại."),
  timeout: t("Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút."),
  canceled: t("Yêu cầu đã bị hủy."),
});

const statusFallbackMessages = (
  m: ReturnType<typeof messages>,
): Readonly<Record<number, string>> => ({
  400: m.invalidInput,
  401: t("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."),
  403: m.forbidden,
  404: t("Không tìm thấy dữ liệu yêu cầu."),
  409: t("Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang và thử lại."),
  413: t("Tệp tải lên vượt quá dung lượng cho phép."),
  422: m.invalidInput,
  429: t("Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút."),
  503: t("Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút."),
});

const MAX_MESSAGE_LENGTH = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncate(text: string): string {
  return text.length > MAX_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`
    : text;
}

function sanitizeServerText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0) return undefined;
  return truncate(text);
}

function readOptionalString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function readValidationErrors(
  abpError: Record<string, unknown>,
): AbpValidationError[] | undefined {
  const raw = abpError.validationErrors;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.filter(isRecord).map((e) => ({
    message: readOptionalString(e, "message"),
    members: Array.isArray(e.members)
      ? (e.members as unknown[]).filter(
          (m): m is string => typeof m === "string",
        )
      : undefined,
  }));
}

function readErrorEnvelope(data: unknown): AbpErrorEnvelope | undefined {
  const payload = typeof data === "string" ? JSON.parse(data) : data;
  if (!isRecord(payload)) return undefined;
  const abpError = payload.error;
  if (isRecord(abpError)) {
    return {
      code: readOptionalString(abpError, "code"),
      message: readOptionalString(abpError, "message"),
      details: readOptionalString(abpError, "details"),
      validationErrors: readValidationErrors(abpError),
    };
  }
  return undefined;
}

function pickServerMessage(envelope: AbpErrorEnvelope): string | undefined {
  const valErrors = envelope.validationErrors;
  if (valErrors !== undefined && valErrors.length > 0) {
    const msgs = valErrors
      .map((e) => e.message)
      .filter((m): m is string => m !== undefined && m.length > 0);
    if (msgs.length > 0) return truncate(msgs.join(" "));
  }
  if (envelope.code !== undefined && envelope.code.length > 0) {
    return sanitizeServerText(envelope.message);
  }
  const details = sanitizeServerText(envelope.details);
  if (details !== undefined) return details;
  return sanitizeServerText(envelope.message);
}

export function describeApiError(error: unknown): ApiErrorInfo {
  const text = messages();

  if (axios.isCancel(error)) {
    return { message: text.canceled, kind: "network", canceled: true };
  }

  if (!axios.isAxiosError<unknown>(error)) {
    if (error instanceof Error) {
      return {
        message: sanitizeServerText(error.message) ?? text.system,
        kind: "system",
        canceled: false,
      };
    }
    return { message: text.unknown, kind: "system", canceled: false };
  }

  const response = error.response;
  if (response === undefined) {
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return {
      message: isTimeout ? text.timeout : text.offline,
      kind: "network",
      canceled: false,
    };
  }

  const status = response.status;
  const envelope = readErrorEnvelope(response.data);
  const serverMessage =
    envelope === undefined ? undefined : pickServerMessage(envelope);
  const code = envelope?.code;
  const isServerFault = status >= 500;
  const useServerMessage =
    serverMessage !== undefined && (!isServerFault || code !== undefined);

  if (useServerMessage) {
    return {
      message: serverMessage,
      kind: isServerFault ? "system" : "user",
      status,
      code,
      canceled: false,
    };
  }

  const fallback =
    statusFallbackMessages(text)[status] ??
    (isServerFault ? text.system : text.invalidInput);

  return {
    message: fallback,
    kind: isServerFault ? "system" : "user",
    status,
    code,
    canceled: false,
  };
}

export function extractApiError(error: unknown): string {
  return describeApiError(error).message;
}
