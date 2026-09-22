import { ClipboardList, CircleDollarSign } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../../api/consultingApi";
import { SERVICE_LINE_STATUS } from "../../../api/treatmentPlanApi";
import { SERVICE_PILL, moneyText } from "../../plan/planTypes";
import { dash, type PlanDetailRow } from "../planDetailTypes";
import { ConvertFacts, ConvertHead } from "./ConvertFacts";

/**
 * Left column: the line being closed and what has already been collected on
 * it. Read-only throughout — the reference offers nothing to change here.
 */
export function ConvertCurrentService({ row }: { row: PlanDetailRow }) {
  const service = row.service;
  const pill = SERVICE_PILL[service.status] ?? SERVICE_PILL[SERVICE_LINE_STATUS.Created];
  const paid = service.paidAmount;

  return (
    <div className="cvt-col">
      <section className="cvt-section">
        <ConvertHead icon={<ClipboardList size={16} aria-hidden="true" />}>
          {t("Dịch vụ hiện tại")}
        </ConvertHead>
        <ConvertFacts
          facts={[
            { label: t("Dịch vụ hiện tại"), value: dash(service.serviceName) },
            {
              label: t("Chẩn đoán"),
              value: dash(service.diagnosisName ?? row.advise?.diagnosisName),
            },
            { label: t("Nội dung điều trị"), value: dash(service.note ?? row.advise?.note) },
            { label: t("Răng"), value: formatTeeth(service.teeth) },
            {
              label: t("Trạng thái"),
              value: <span className="pdt-status">{t(pill.label)}</span>,
            },
          ]}
        />
      </section>

      <section className="cvt-section cvt-section--divided">
        <ConvertHead icon={<CircleDollarSign size={16} aria-hidden="true" />}>
          {t("Thông tin thanh toán hiện tại")}
        </ConvertHead>
        <ConvertFacts
          tight
          facts={[
            { label: t("Tổng tiền"), value: moneyText(service.effectiveAmount) },
            { label: t("Giảm giá"), value: moneyText(service.discountAmount) },
            { label: t("Đã thanh toán"), value: moneyText(paid) },
            { label: t("Công nợ"), value: moneyText(service.outstandingAmount) },
            { label: t("Còn lại"), value: moneyText(service.outstandingAmount) },
          ]}
        />
      </section>
    </div>
  );
}
