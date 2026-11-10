import { useState } from "react";
import { Button, Modal } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { isRequestSlip, isWarrantyCardPhoto, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { LaboDetailFacts } from "./LaboDetailFacts";
import { LaboPictureWell } from "./LaboPictureWell";
import { LaboPrintButton } from "./LaboPrintButton";
import { LaboRequestSlipFacts } from "./LaboRequestSlipFacts";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";
import "../labo-order-dialog.css";

interface Props {
  /** The row behind the eye; null keeps the dialog closed. */
  order: LaboOrderDto | null;
  branchId: string;
  /** `appointment:create` — the footer's "Tạo Lịch Hẹn Mới". */
  canCreateAppointment: boolean;
  onClose: () => void;
}

const patientOf = (order: LaboOrderDto): LaboDetailPatient => ({
  code: order.patientCode ?? "",
  name: order.patientName ?? "",
  dateOfBirth: order.patientDateOfBirth ?? null,
});

/**
 * "Xem chi tiết" on a Mẫu Labo row: the "Thông tin chung" facts, the status
 * pill and the pictures, read-only. Since P2910_03 the status moves only
 * through the Labo workflow on the patient record, so the old Trạng thái
 * select, Tải ảnh well and Lưu are gone; In Phiếu Labo and "Tạo Lịch Hẹn Mới"
 * stay (docs/clone/pages/labo.md §2.6).
 */
export function LaboDetailDialog({ order, branchId, canCreateAppointment, onClose }: Props) {
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const patient = order ? patientOf(order) : null;

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
        {order && patient && (
          <>
            {isRequestSlip(order) ? (
              <LaboRequestSlipFacts order={order} patient={patient} pill={laboStatusPill(order)} />
            ) : (
              <LaboDetailFacts facts={laboOrderFacts(order, patient)} pill={laboStatusPill(order)} />
            )}
            <LaboPictureWell
              tiles={order.images
                .filter((image) => !isWarrantyCardPhoto(image))
                .map((image) => ({ key: image.id, url: image.url, name: image.fileName }))}
              busy={false}
              readOnly
            />
            <div className="pd-labo-footer pd-labo-detail-footer">
              <LaboPrintButton order={order} branchId={branchId} patient={patient} />
              {canCreateAppointment && (
                <Button
                  color="primary"
                  variant="outlined"
                  icon={<CalendarOutlined />}
                  onClick={() => setAppointmentOpen(true)}
                >
                  {t("Patient:Labo:NewAppointment")}
                </Button>
              )}
              <Button type="primary" onClick={onClose}>
                {t("Common:Close")}
              </Button>
            </div>
          </>
        )}
      </Modal>
      {canCreateAppointment && order && (
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
