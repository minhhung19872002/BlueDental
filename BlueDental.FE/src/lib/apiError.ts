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
  unknown: t("Common:Error:Unknown"),
  system: t("Common:Error:System"),
  invalidInput: t("Common:Error:InvalidInput"),
  forbidden: t("Common:Error:Forbidden"),
  offline: t("Common:Error:Offline"),
  timeout: t("Common:Error:Timeout"),
  canceled: t("Common:Error:Canceled"),
});

const statusFallbackMessages = (
  m: ReturnType<typeof messages>,
): Readonly<Record<number, string>> => ({
  400: m.invalidInput,
  401: t("Common:Error:SessionExpired"),
  403: m.forbidden,
  404: t("Common:Error:NotFound"),
  409: t("Common:Error:Conflict"),
  413: t("Common:Error:FileTooLarge"),
  422: m.invalidInput,
  429: t("Common:Error:TooManyRequests"),
  503: t("Common:Error:Maintenance"),
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
