import type { ReactNode } from "react";
import { Modal } from "antd";
import { Printer, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { printQuoteSheet } from "./printQuote";

interface Props {
  open: boolean;
  /** "Phiếu Báo Giá" — after "Xem trước:". */
  subject: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * "Xem trước: …" — the preview "In Hoá Đơn" of Chi tiết phiếu opens. The
 * sheet fills the body; the title row carries "In Bản Này", which prints the
 * sheet and nothing else. "Gửi Khách Hàng (Zalo/FB)" is gone (R-1334).
 */
export function QuotePreviewModal({ open, subject, onClose, children }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tp-dialog pq-dialog--preview"
      width="min(1000px, calc(100vw - 32px))"
      closeIcon={<X size={20} />}
      destroyOnHidden
      footer={null}
      title={
        <div className="pq-preview-title">
          <span>{t("Patient:Misc:QuotePreview", subject)}</span>
          <span className="pq-footer">
            <button type="button" className="tp-btn tp-btn--primary" onClick={printQuoteSheet}>
              <Printer size={16} />
              {t("Patient:MedRecord:PrintThis")}
            </button>
          </span>
        </div>
      }
    >
      <div className="pq-preview-body">{children}</div>
    </Modal>
  );
}
