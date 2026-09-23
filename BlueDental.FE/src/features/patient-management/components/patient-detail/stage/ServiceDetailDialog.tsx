import { Button, Modal } from "antd";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import {
  serviceLineStatusConfig,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import type { PatientDto } from "../../../types/patient";

interface Props {
  open: boolean;
  patient: PatientDto;
  plan: TreatmentPlanSlipDto | null;
  /** The service line the finished công đoạn belongs to. */
  line: TreatmentServiceDto | null;
  onClose: () => void;
}

/** One "label: value" line, the way the reference states each fact. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="pd-svcdetail-fact">
      {label}: <span>{value || "—"}</span>
    </p>
  );
}

function Section({ title, facts }: { title: string; facts: [string, string][] }) {
  return (
    <section>
      <h3>{title}</h3>
      <div>
        {facts.map(([label, value]) => (
          <Fact key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}

/**
 * "Chi tiết dịch vụ" — what the Chi Tiết button on a "Tạo tái khám" row opens.
 *
 * Read-only, and stacked **over** the listing rather than replacing it, so Đóng
 * returns to the rows. Four sections in a two-column grid, each a bold blue
 * uppercase heading over `label: value` lines. Measured on the reference
 * 2026-09-07 at 772px wide; see docs/clone/pages/patient-detail.md.
 */
export function ServiceDetailDialog({ open, patient, plan, line, onClose }: Props) {
  const status = line ? serviceLineStatusConfig()[line.status]?.label : null;
  const teeth = toothLabels(line?.teeth ?? []);
  const money = (value: number | undefined) => formatMoneyUnit(value ?? 0);

  return (
    <Modal
      open={open}
      width={772}
      className="pd-svcdetail-dialog"
      title={t("Patient:Plan:ServiceDetailTitle")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Common:Close")}</Button>}
      destroyOnHidden
    >
      <div className="pd-svcdetail-grid">
        <Section
          title={t("Patient:Stage:PlanDetail")}
          facts={[
            [t("Patient:Misc:Service"), line?.serviceName ?? line?.code ?? ""],
            [t("Patient:Misc:StatusLabel"), status ?? ""],
            // The reference names the diagnosis the line answers. BlueDental
            // keeps that on the consulting line, not on the slip's service, so
            // it stays an em dash here — see docs/clone/unknowns.md.
            [t("Patient:Tab:Diagnosis"), ""],
            [t("Patient:DentalChart:Tooth"), teeth.join(", ")],
            /*
             * The **line's own** note, not its công đoạn's.
             *
             * OBSERVED on the reference 2026-09-07: this dialog fires
             * GET /v1/treatment-services/{id}, whose document carries `note` at
             * the top beside `patientStages[]`, each stage holding a `note` of
             * its own. On the surveyed line the printed value equalled the
             * document's own `note` while the three stage notes — all different
             * from it — appeared nowhere, so they are neither joined nor sampled
             * here. This used to join every stage note, which grew the line by
             * one clause per công đoạn forever (R-291). Everything else in this
             * block is a plan fact, as its heading says.
             */
            [t("Patient:Misc:Note"), line?.note ?? ""],
          ]}
        />
        <Section
          title={t("Patient:Form:CustomerInfo")}
          facts={[
            [t("Patient:PageTitle"), patient.fullName],
            [t("Patient:Form:Telephone"), patient.phoneNumber ?? ""],
            [t("Patient:Col:Address"), patient.address ?? ""],
          ]}
        />
        <Section
          title={t("Patient:Form:StaffInfo")}
          facts={[
            [t("Patient:Staff:Doctor"), plan?.dentistName ?? ""],
            // The reference keeps two diagnosing doctors and two consultants
            // beside the treating one; BlueDental records only the consultant
            // on the slip.
            [t("Patient:Diagnosis:Doctor1"), ""],
            [t("Patient:Diagnosis:Second"), ""],
            [t("Patient:Staff:Consultant1"), plan?.consultantName ?? ""],
            [t("Patient:Staff:Consultant2"), ""],
          ]}
        />
        <Section
          title={t("Patient:Payment:Info")}
          facts={[
            [t("Patient:Payment:TotalAmount"), money(line?.grossAmount)],
            [t("Patient:Payment:Quantity"), `${line?.quantity ?? 0} ${t("Patient:DentalChart:Tooth")}`],
            [t("Patient:Payment:Discount"), money(line?.discountAmount)],
            [t("Patient:Misc:Payment"), money(line?.paidAmount)],
          ]}
        />
      </div>
    </Modal>
  );
}
