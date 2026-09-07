import { Modal } from "antd";
import { X } from "lucide-react";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { SERVICE_LINE_STATUS } from "../../api/treatmentPlanApi";
import { SERVICE_PILL, moneyText } from "../plan/planTypes";
import { dash, type PlanDetailRow } from "./planDetailTypes";

interface Props {
  row: PlanDetailRow | null;
  patient: PatientDto;
  onClose: () => void;
}

interface Fact {
  label: string;
  value: React.ReactNode;
}

function Section({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <section className="pdt-detail-section">
      <h3>{title}</h3>
      {facts.map((fact) => (
        <p key={fact.label} className="pdt-detail-fact">
          <span className="pdt-detail-label">{fact.label}:</span>
          <span className="pdt-detail-value">{fact.value}</span>
        </p>
      ))}
    </section>
  );
}

/**
 * "Chi tiết dịch vụ" — the eye on a service line: four fact blocks in two
 * columns, the plan, the patient, the staff and the money.
 */
export function ServiceDetailDialog({ row, patient, onClose }: Props) {
  const service = row?.service;
  const pill = service ? (SERVICE_PILL[service.status] ?? SERVICE_PILL[SERVICE_LINE_STATUS.Created]) : null;

  return (
    <Modal
      open={row !== null}
      title={t("Chi tiết dịch vụ")}
      className="tp-dialog pdt-detail-dialog"
      width="min(772px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--outline" onClick={onClose}>
            {t("Đóng")}
          </button>
        </div>
      }
    >
      {row && service && pill && (
        <div className="pdt-detail-grid">
          <Section
            title={t("Chi tiết kế hoạch")}
            facts={[
              { label: t("Dịch vụ"), value: service.serviceName },
              { label: t("Trạng thái"), value: t(pill.label) },
              { label: t("Chẩn đoán"), value: dash(row.advise?.diagnosisName) },
              { label: t("Răng"), value: formatTeeth(service.teeth) },
              { label: t("Ghi chú"), value: dash(row.advise?.note) },
            ]}
          />
          <Section
            title={t("Thông tin khách hàng")}
            facts={[
              { label: t("Bệnh nhân"), value: patient.fullName },
              { label: t("Điện thoại"), value: dash(patient.phoneNumber) },
              { label: t("Địa chỉ"), value: dash(patient.address) },
            ]}
          />
          <Section
            title={t("Thông tin nhân viên")}
            facts={[
              { label: t("Bác sĩ"), value: dash(row.plan.dentistName) },
              { label: t("Bác sĩ chẩn đoán 1"), value: dash(row.advise?.staffName) },
              { label: t("Chẩn đoán 2"), value: dash(row.advise?.secondStaffName) },
              { label: t("Nhân sự tư vấn 1"), value: dash(row.plan.consultantName) },
              { label: t("Nhân sự tư vấn 2"), value: "—" },
            ]}
          />
          <Section
            title={t("Thông tin thanh toán")}
            facts={[
              { label: t("Tổng tiền"), value: moneyText(service.effectiveAmount) },
              { label: t("Số lượng"), value: t("{0} Răng", service.quantity) },
              { label: t("Giảm giá"), value: moneyText(service.discountAmount) },
              { label: t("Thanh toán"), value: moneyText(service.paidAmount) },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
