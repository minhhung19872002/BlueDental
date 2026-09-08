import type { ReactNode } from "react";
import { Modal } from "antd";
import { Printer, Send, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { printQuoteSheet } from "./printQuote";

interface Props {
  open: boolean;
  /** "Phiếu Báo Giá" / "Hóa Đơn Kèm Chẩn Đoán" — after "Xem trước:". */
  subject: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * "Xem trước: …" — the preview both print buttons of Chi tiết phiếu open.
 * The sheet fills the body; the title row carries the send-to-customer
 * stub and "In Bản Này", which prints the sheet and nothing else.
 */
export function QuotePreviewModal({ open, subject, onClose, children }: Props) {
  const handleSend = () => {
    toast.info(t("Gửi khách hàng qua Zalo/Facebook sắp ra mắt"));
  };

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
          <span>{t("Xem trước: {0}", subject)}</span>
          <span className="pq-footer">
            <button type="button" className="tp-btn tp-btn--outline" onClick={handleSend}>
              <Send size={16} />
              {t("Gửi Khách Hàng (Zalo/FB)")}
            </button>
            <button type="button" className="tp-btn tp-btn--primary" onClick={printQuoteSheet}>
              <Printer size={16} />
              {t("In Bản Này")}
            </button>
          </span>
        </div>
      }
    >
      <div className="pq-preview-body">{children}</div>
    </Modal>
  );
}
