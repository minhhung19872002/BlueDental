import { useEffect, useState } from "react";
import { Modal } from "antd";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { LaboDetailFacts } from "./LaboDetailFacts";
import { LaboDetailFooter } from "./LaboDetailFooter";
import { LaboPictureWell } from "./LaboPictureWell";
import { LaboPrintSheet } from "./LaboPrintSheet";
import { LaboStatusSelect } from "./LaboStatusSelect";
import type { LaboDetailMode } from "./laboDetailMode";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";
import { useLaboDetailEditor } from "./useLaboDetailEditor";
import "../labo-order-dialog.css";

interface Props {
  /** The row behind the eye; null keeps the dialog closed. */
  order: LaboOrderDto | null;
  branchId: string;
  patient: LaboDetailPatient;
  /** Which screen opened the dialog and which of its controls the user holds. */
  mode: LaboDetailMode;
  onClose: () => void;
}

/** The browser's file name for the printed sheet, as the reference names it. */
const sheetTitle = (orderCode: string) => `phieu-labo-${orderCode}`;

/**
 * "Xem chi tiết" on a labo row: the "Thông tin chung" modal with "In Phiếu
 * Labo" in its footer. On Mẫu Labo it also carries the Trạng thái select and
 * the picture strip — enabled, with the Tải ảnh well and "Lưu", only with
 * `laboTemplate:update` — and "Tạo Lịch Hẹn Mới" with `appointment:create`
 * (staging, docs/clone/pages/labo.md §2.6); on the patient's tab it ends in
 * "Đóng".
 */
export function LaboDetailDialog({ order, branchId, patient, mode, onClose }: Props) {
  const clinic = useBranchInfo(branchId);
  const orders = mode.variant === "orders" ? mode : null;
  // The patient's tab shows neither the status select nor the pictures.
  const editor = useLaboDetailEditor(orders ? order : null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);

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

  const handleSave = async () => {
    if (await editor.save()) onClose();
  };

  const facts = order ? laboOrderFacts(order, patient) : null;

  return (
    <>
      <Modal
        open={order !== null}
        width={772}
        className="pd-labo-dialog pd-labo-detail-dialog"
        title={t("Patient:Form:GeneralInfo")}
        onCancel={onClose}
        footer={null}
        destroyOnHidden
      >
        {order && facts && (
          <LaboDetailFacts
            facts={facts}
            status={order.status}
            statusControl={
              orders ? (
                <LaboStatusSelect
                  value={editor.status}
                  onChange={editor.pickStatus}
                  disabled={!orders.canUpdate}
                />
              ) : undefined
            }
          />
        )}
        {orders && (
          <LaboPictureWell
            tiles={editor.tiles}
            busy={editor.saving}
            readOnly={!orders.canUpdate}
            onAdd={editor.addPictures}
            onRemove={editor.removeTile}
          />
        )}
        <LaboDetailFooter
          mode={mode}
          printDisabled={!clinic.data}
          saving={editor.saving}
          onPrint={handlePrint}
          onNewAppointment={() => setAppointmentOpen(true)}
          onSave={() => void handleSave()}
          onClose={onClose}
        />
      </Modal>
      {order && facts && clinic.data && (
        <LaboPrintSheet
          clinic={clinic.data}
          patient={patient}
          orderCode={order.orderCode}
          facts={facts}
        />
      )}
      {orders?.canCreateAppointment && order && (
        <AppointmentEditorModal
          open={appointmentOpen}
          initialPatientId={order.patientId}
          initialDoctorId={order.dentistId}
          onClose={() => setAppointmentOpen(false)}
        />
      )}
    </>
  );
}
