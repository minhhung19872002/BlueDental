import React from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import type { LateNotice } from "@/hooks/lateNoticeStore";
import { cornerNoticeHost, noticeOrderStyle } from "@/lib/cornerNotices";
import { t } from "@/lib/i18n";
import "./late-notices.css";

interface LateNoticeStackProps {
  notices: LateNotice[];
  onDismiss: (id: number) => void;
}

interface LateNoticeCardProps {
  notice: LateNotice;
  onDismiss: (id: number) => void;
}

/**
 * One Trễ hẹn card. The bar along its foot runs 10 s — long enough to be
 * noticed by someone busy at the chair — and the card leaves when it ends;
 * pointing at the card or tabbing to its × pauses the bar. Read only: the
 * card opens nothing (owner 2026-11-12).
 */
const LateNoticeCard: React.FC<LateNoticeCardProps> = ({ notice, onDismiss }) => {
  const handleDismiss = () => onDismiss(notice.id);

  return (
    <div className="late-notice" style={noticeOrderStyle(notice.order)}>
      <span className="late-notice-icon" aria-hidden>
        <Clock size={18} />
      </span>
      <span className="late-notice-text">
        <span className="late-notice-title">{notice.title}</span>
        {notice.lines.map((line, index) => (
          <span key={index} className="late-notice-line">
            {line}
          </span>
        ))}
      </span>
      <button
        type="button"
        className="late-notice-close"
        aria-label={t("Appointment:LateToast:Dismiss")}
        title={t("Appointment:LateToast:Dismiss")}
        onClick={handleDismiss}
      >
        <X size={14} aria-hidden />
      </button>
      <span className="late-notice-timer" aria-hidden onAnimationEnd={handleDismiss} />
    </div>
  );
};

/**
 * The Trễ hẹn cards in the shared column top right under the header, with the
 * chat toasts (R-1217): the newest of either kind on top, older ones pushed down.
 */
export const LateNoticeStack: React.FC<LateNoticeStackProps> = ({ notices, onDismiss }) =>
  createPortal(
    <section className="late-notices" aria-label={t("Appointment:LateToast:Region")} aria-live="polite">
      {notices.map((notice) => (
        <LateNoticeCard key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </section>,
    cornerNoticeHost(),
  );
