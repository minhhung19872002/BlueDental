import { useCallback } from "react";
import { Button, Modal } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { CashflowEntryDto } from "../api/financeApi";
import { CashflowEntryVoucher } from "./CashflowEntryVoucher";

interface Props {
  entry: CashflowEntryDto | null;
  onClose: () => void;
}

/**
 * Tab 4's eye button: the reference opens "Chi tiết phiếu" with an
 * "In Hoá Đơn" button that prints the same voucher through its print
 * template. We print a hidden copy of the voucher with `window.print()`.
 */
export function CashflowEntryDetailModal({ entry, onClose }: Props) {
  const handlePrint = useCallback(() => window.print(), []);

  return (
    <Modal
      open={entry !== null}
      title={<h2 className="bd-modal-title">{t("Report:EntryDetail:Title")}</h2>}
      onCancel={onClose}
      width={860}
      destroyOnHidden
      className="report-detail-modal"
      footer={
        <div className="report-confirm-footer">
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            {t("Report:EntryDetail:PrintInvoice")}
          </Button>
        </div>
      }
    >
      {entry && (
        <>
          <CashflowEntryVoucher entry={entry} />
          <div className="report-print-sheet" aria-hidden="true">
            <div className="report-print-page">
              <CashflowEntryVoucher entry={entry} />
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
