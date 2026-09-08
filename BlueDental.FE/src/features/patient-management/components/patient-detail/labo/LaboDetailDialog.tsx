import { useEffect } from "react";
import { Button, Modal } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboDetailFacts } from "./LaboDetailFacts";
import { LaboPrintSheet } from "./LaboPrintSheet";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";

interface Props {
  /** The row behind the eye; null keeps the dialog closed. */
  order: LaboOrderDto | null;
  branchId: string;
  patient: LaboDetailPatient;
  onClose: () => void;
}

/** The browser's file name for the printed sheet, as the reference names it. */
const sheetTitle = (orderCode: string) => `phieu-labo-${orderCode}`;

/**
 * "Xem chi tiết" on a row of the patient's Labo tab: the read-only "Thông tin
 * chung" modal with "In Phiếu Labo" and "Đóng" in its footer. The patient-tab
 * variant carries no status control — that lives on the Mẫu Labo screen.
 */
export function LaboDetailDialog({ order, branchId, patient, onClose }: Props) {
  const clinic = useBranchInfo(branchId);

  // Dropped when the browser is finished (see TreatmentHistoryPrintDialog):
  // window.print() does not reliably block until the preview closes.
  useEffect(() => {
    const title = document.title;
    const done = () => {
      document.body.classList.remove("pd-printing");
      document.title = title;
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  const handlePrint = () => {
    if (!order) return;
    document.title = sheetTitle(order.orderCode);
    document.body.classList.add("pd-printing");
    window.print();
  };

  const facts = order ? laboOrderFacts(order, patient) : null;

  return (
    <>
      <Modal
        open={order !== null}
        width={772}
        className="pd-labo-dialog pd-labo-detail-dialog"
        title={t("Thông tin chung")}
        onCancel={onClose}
        footer={null}
        destroyOnHidden
      >
        {order && facts && <LaboDetailFacts facts={facts} status={order.status} />}
        <div className="pd-labo-footer pd-labo-detail-footer">
          <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!clinic.data}>
            {t("In Phiếu Labo")}
          </Button>
          <Button type="primary" onClick={onClose}>
            {t("Đóng")}
          </Button>
        </div>
      </Modal>
      {order && facts && clinic.data && (
        <LaboPrintSheet
          clinic={clinic.data}
          patient={patient}
          orderCode={order.orderCode}
          facts={facts}
        />
      )}
    </>
  );
}
