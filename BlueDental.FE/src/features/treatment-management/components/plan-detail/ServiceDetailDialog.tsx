import { Modal } from "antd";
import { X } from "lucide-react";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { SERVICE_LINE_STATUS } from "../../api/treatmentPlanApi";
import { servicePills, moneyText } from "../plan/planTypes";
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
  const allPills = servicePills();
  const pill = service ? (allPills[service.status] ?? allPills[SERVICE_LINE_STATUS.Created]) : null;

  return (
    <Modal
      open={row !== null}
      title={t("Treatment:Service:ServiceDetail")}
      className="tp-dialog pdt-detail-dialog"
      width="min(772px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--outline" onClick={onClose}>
            {t("Common:Close")}
          </button>
        </div>
      }
    >
      {row && service && pill && (
        <div className="pdt-detail-grid">
          <Section
            title={t("Treatment:Plan:PlanDetail")}
            facts={[
              { label: t("Treatment:Service:Service"), value: service.serviceName },
              { label: t("Common:Status"), value: pill.label },
              { label: t("Treatment:Diagnosis:Diagnosis"), value: dash(row.advise?.diagnosisName) },
              { label: t("Treatment:Tooth:Tooth"), value: formatTeeth(service.teeth) },
              { label: t("Treatment:Service:Note"), value: dash(row.advise?.note) },
            ]}
          />
          <Section
            title={t("Treatment:Invoice:CustomerInfo")}
            facts={[
              { label: t("Treatment:Common:Patient"), value: patient.fullName },
              { label: t("Treatment:Common:PhoneField"), value: dash(patient.phoneNumber) },
              { label: t("Treatment:Common:Address"), value: dash(patient.address) },
            ]}
          />
          <Section
            title={t("Treatment:Common:StaffInfo")}
            facts={[
              { label: t("Treatment:Common:Doctor"), value: dash(row.plan.dentistName) },
              { label: t("Treatment:Diagnosis:DoctorOne"), value: dash(row.advise?.staffName) },
              { label: t("Treatment:Diagnosis:DiagnosisTwo"), value: dash(row.advise?.secondStaffName) },
              { label: t("Treatment:Consulting:ConsultantOne"), value: dash(row.plan.consultantName) },
              { label: t("Treatment:Consulting:ConsultantTwo"), value: "—" },
            ]}
          />
          <Section
            title={t("Treatment:Invoice:PaymentInfo")}
            facts={[
              { label: t("Treatment:Pricing:TotalAmount"), value: moneyText(service.effectiveAmount) },
              { label: t("Treatment:Pricing:Quantity"), value: t("Treatment:Service:QuantityTeeth", service.quantity) },
              { label: t("Treatment:Pricing:Discount"), value: moneyText(service.discountAmount) },
              { label: t("Treatment:Payment:Payment"), value: moneyText(service.paidAmount) },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
