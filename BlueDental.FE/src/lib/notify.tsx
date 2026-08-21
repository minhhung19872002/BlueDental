import {
  ConfigProvider,
  message as staticMessage,
  notification as staticNotification,
} from "antd";
import type { MessageArgsProps, NotificationArgsProps } from "antd";
import viVN from "antd/locale/vi_VN";
import { themeConfig } from "@/theme/index";
import { describeApiError } from "./apiError";
import type { ApiErrorInfo } from "./apiError";

export interface AntdNotifier {
  message: { error: (config: MessageArgsProps) => unknown };
  notification: { error: (config: NotificationArgsProps) => void };
}

ConfigProvider.config({
  holderRender: (children) => (
    <ConfigProvider locale={viVN} theme={themeConfig}>
      {children}
    </ConfigProvider>
  ),
});

const staticNotifier: AntdNotifier = {
  message: staticMessage,
  notification: staticNotification,
};

let boundNotifier: AntdNotifier | undefined;

export function bindAntdNotifier(notifier: AntdNotifier): () => void {
  boundNotifier = notifier;
  return () => {
    if (boundNotifier === notifier) {
      boundNotifier = undefined;
    }
  };
}

function currentNotifier(): AntdNotifier {
  return boundNotifier ?? staticNotifier;
}

function showApiError(info: ApiErrorInfo): void {
  const notifier = currentNotifier();
  if (info.kind === "system") {
    notifier.notification.error({
      title: "Lỗi hệ thống",
      description: info.message,
      key: `bluedental-error-${info.message}`,
      duration: 8,
    });
    return;
  }
  void notifier.message.error({
    content: info.message,
    key: `bluedental-error-${info.message}`,
    duration: 5,
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
