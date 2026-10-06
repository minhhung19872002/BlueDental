import { Button, Result } from "antd";

import type { OverlayUnavailableState } from "@/lib/i18n";

/**
 * Texts live here instead of going through t(): this page shows exactly when
 * the localization endpoint is unreachable, so the overlay does not exist.
 */
const TEXTS = {
  vi: {
    title: "Hệ thống đang bảo trì",
    message:
      "Không kết nối được tới máy chủ. Vui lòng thử lại sau ít phút — trang sẽ tự tải lại khi hệ thống hoạt động trở lại.",
    retry: "Thử lại",
  },
  en: {
    title: "System under maintenance",
    message:
      "The server cannot be reached. Please try again in a few minutes — this page reloads by itself once the system is back.",
    retry: "Try again",
  },
} as const;

/** Full-page fallback for when the app cannot start because the API is down. */
export function ServiceUnavailablePage({ language, retrying, onRetry }: OverlayUnavailableState) {
  const text = TEXTS[language];

  return (
    <main className="service-unavailable">
      <Result
        status="500"
        title={text.title}
        subTitle={text.message}
        extra={
          <Button type="primary" loading={retrying} onClick={onRetry}>
            {text.retry}
          </Button>
        }
      />
    </main>
  );
}
