import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/** Lucide outlines copied from the reference markup (phone, message-square-text, send, file-heart). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const PHONE = (
  <Icon>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Icon>
);

const MESSAGE = (
  <Icon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M13 8H7" />
    <path d="M17 12H7" />
  </Icon>
);

const SEND = (
  <Icon>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);

const FILE_HEART = (
  <Icon>
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10.29 10.7a2.43 2.43 0 0 0-2.66-.52c-.29.12-.56.3-.78.53l-.35.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L6.5 18l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z" />
  </Icon>
);

interface CareRowActionsProps {
  onCall: () => void;
  onMessage: () => void;
  /** Reference shows send on Nhắc lịch hẹn and Chúc mừng sinh nhật rows. */
  onSend?: () => void;
  /** Reference varies the file-heart dialog per tab; absent on periodic/special. */
  onCare?: () => void;
}

export function CareRowActions({ onCall, onMessage, onSend, onCare }: CareRowActionsProps) {
  return (
    <div className="cskh-actions">
      <button
        type="button"
        className="cskh-action cskh-action--phone"
        title={t("Gọi điện")}
        onClick={onCall}
      >
        {PHONE}
      </button>
      <button
        type="button"
        className="cskh-action cskh-action--message"
        title={t("Lưu tin nhắn")}
        onClick={onMessage}
      >
        {MESSAGE}
      </button>
      {onSend && (
        <button
          type="button"
          className="cskh-action cskh-action--send"
          title={t("Gửi ZBS qua Zalo")}
          onClick={onSend}
        >
          {SEND}
        </button>
      )}
      {onCare && (
        <button
          type="button"
          className="cskh-action cskh-action--care"
          title={t("Chăm sóc")}
          onClick={onCare}
        >
          {FILE_HEART}
        </button>
      )}
    </div>
  );
}
