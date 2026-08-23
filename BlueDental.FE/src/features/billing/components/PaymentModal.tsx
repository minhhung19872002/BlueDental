// PaymentModal — records a payment against an invoice.
// TODO: Implement payment method selection, partial payments, receipt printing.

import { Modal, Button } from "antd";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PaymentModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={t("Ghi nhận thanh toán")}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          {t("Xác nhận thanh toán")}
        </Button>
      }
    >
      {/* TODO: Implement payment form */}
      <p style={{ color: "#5E748E" }}>{t("Form thanh toán đang được phát triển.")}</p>
    </Modal>
  );
}
