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
      title={t("Chi tiết dịch vụ")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Đóng")}</Button>}
      destroyOnHidden
    >
      <div className="pd-svcdetail-grid">
        <Section
          title={t("Chi tiết kế hoạch")}
          facts={[
            [t("Dịch vụ"), line?.serviceName ?? line?.code ?? ""],
            [t("Trạng thái"), status ?? ""],
            // The reference names the diagnosis the line answers. BlueDental
            // keeps that on the consulting line, not on the slip's service, so
            // it stays an em dash here — see docs/clone/unknowns.md.
            [t("Chẩn đoán"), ""],
            [t("Răng"), teeth.join(", ")],
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
            [t("Ghi chú"), line?.note ?? ""],
          ]}
        />
        <Section
          title={t("Thông tin khách hàng")}
          facts={[
            [t("Bệnh nhân"), patient.fullName],
            [t("Điện thoại"), patient.phoneNumber ?? ""],
            [t("Địa chỉ"), patient.address ?? ""],
          ]}
        />
        <Section
          title={t("Thông tin nhân viên")}
          facts={[
            [t("Bác sĩ"), plan?.dentistName ?? ""],
            // The reference keeps two diagnosing doctors and two consultants
            // beside the treating one; BlueDental records only the consultant
            // on the slip.
            [t("Bác sĩ chẩn đoán 1"), ""],
            [t("Chẩn đoán 2"), ""],
            [t("Nhân sự tư vấn 1"), plan?.consultantName ?? ""],
            [t("Nhân sự tư vấn 2"), ""],
          ]}
        />
        <Section
          title={t("Thông tin thanh toán")}
          facts={[
            [t("Tổng tiền"), money(line?.grossAmount)],
            [t("Số lượng"), `${line?.quantity ?? 0} ${t("Răng")}`],
            [t("Giảm giá"), money(line?.discountAmount)],
            [t("Thanh toán"), money(line?.paidAmount)],
          ]}
        />
      </div>
    </Modal>
  );
}
