import axios from "axios";

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

const UNKNOWN_MESSAGE = "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
const SYSTEM_MESSAGE =
  "Hệ thống đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ quản trị viên.";
const INVALID_INPUT_MESSAGE =
  "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.";
const FORBIDDEN_MESSAGE = "Bạn không có quyền thực hiện thao tác này.";
const OFFLINE_MESSAGE =
  "Không kết nối được tới máy chủ. Vui lòng kiểm tra đường truyền và thử lại.";
const TIMEOUT_MESSAGE =
  "Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.";
const CANCELED_MESSAGE = "Yêu cầu đã bị hủy.";

const STATUS_FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  400: INVALID_INPUT_MESSAGE,
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: FORBIDDEN_MESSAGE,
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu đã được thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.",
  413: "Tệp tải lên vượt quá dung lượng cho phép.",
  422: INVALID_INPUT_MESSAGE,
  429: "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.",
  503: "Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.",
};

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

function readErrorEnvelope(data: unknown): AbpErrorEnvelope | undefined {
  const payload = typeof data === "string" ? JSON.parse(data) : data;
  if (!isRecord(payload)) return undefined;
  const abpError = payload.error;
  if (isRecord(abpError)) {
    return {
      code: readOptionalString(abpError, "code"),
      message: readOptionalString(abpError, "message"),
      details: readOptionalString(abpError, "details"),
    };
  }
  return undefined;
}

function pickServerMessage(envelope: AbpErrorEnvelope): string | undefined {
  const details = sanitizeServerText(envelope.details);
  if (details !== undefined) return details;
  return sanitizeServerText(envelope.message);
}

export function describeApiError(error: unknown): ApiErrorInfo {
  if (axios.isCancel(error)) {
    return { message: CANCELED_MESSAGE, kind: "network", canceled: true };
  }

  if (!axios.isAxiosError<unknown>(error)) {
    if (error instanceof Error) {
      return {
        message: sanitizeServerText(error.message) ?? SYSTEM_MESSAGE,
        kind: "system",
        canceled: false,
      };
    }
    return { message: UNKNOWN_MESSAGE, kind: "system", canceled: false };
  }

  const response = error.response;
  if (response === undefined) {
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return {
      message: isTimeout ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE,
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
    STATUS_FALLBACK_MESSAGES[status] ??
    (isServerFault ? SYSTEM_MESSAGE : INVALID_INPUT_MESSAGE);

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
