// StockAdjustmentModal — records stock-in, stock-out, or adjustment transactions.
// TODO: Implement adjustment form with reason codes and batch tracking.

import { Modal, Button } from "antd";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StockAdjustmentModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={t("Điều chỉnh kho")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Đóng")}</Button>}
    >
      <p style={{ color: "#6f7c90" }}>{t("Form điều chỉnh kho đang được phát triển.")}</p>
    </Modal>
  );
}
