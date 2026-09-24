import { ClipboardList, CircleDollarSign } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../../api/consultingApi";
import { SERVICE_LINE_STATUS } from "../../../api/treatmentPlanApi";
import { servicePills, moneyText } from "../../plan/planTypes";
import { dash, type PlanDetailRow } from "../planDetailTypes";
import { ConvertFacts, ConvertHead } from "./ConvertFacts";
import { ConvertLaboBlock } from "./ConvertLaboBlock";

interface Props {
  row: PlanDetailRow;
  /** The line still has a Labo slip with the labo — the reference blocks saving. */
  hasOpenLabo: boolean;
  onLaboCleared: () => void;
}

/**
 * Left column: the line being closed and what has already been collected on
 * it. Read-only throughout — the reference offers nothing to change here.
 */
export function ConvertCurrentService({ row, hasOpenLabo, onLaboCleared }: Props) {
  const service = row.service;
  const pills = servicePills();
  const pill = pills[service.status] ?? pills[SERVICE_LINE_STATUS.Created];
  const paid = service.paidAmount;

  return (
    <div className="cvt-col">
      <section className="cvt-section">
        <ConvertHead icon={<ClipboardList size={16} aria-hidden="true" />}>
          {t("Treatment:Convert:CurrentService")}
        </ConvertHead>
        <ConvertFacts
          facts={[
            { label: t("Treatment:Convert:CurrentService"), value: dash(service.serviceName) },
            {
              label: t("Treatment:Diagnosis:Diagnosis"),
              value: dash(service.diagnosisName ?? row.advise?.diagnosisName),
            },
            { label: t("Treatment:Common:TreatmentContent"), value: dash(service.note ?? row.advise?.note) },
            { label: t("Treatment:Tooth:Tooth"), value: formatTeeth(service.teeth) },
            {
              label: t("Common:Status"),
              value: <span className="pdt-status">{pill.label}</span>,
            },
          ]}
        />
      </section>

      <section className="cvt-section cvt-section--divided">
        <ConvertHead icon={<CircleDollarSign size={16} aria-hidden="true" />}>
          {t("Treatment:Pricing:CurrentPaymentInfo")}
        </ConvertHead>
        <ConvertFacts
          tight
          facts={[
            { label: t("Treatment:Pricing:TotalAmount"), value: moneyText(service.effectiveAmount) },
            { label: t("Treatment:Pricing:Discount"), value: moneyText(service.discountAmount) },
            { label: t("Treatment:Receipt:TotalPaid"), value: moneyText(paid) },
            { label: t("Treatment:Receipt:TotalDebt"), value: moneyText(service.outstandingAmount) },
            { label: t("Treatment:Pricing:Remaining"), value: moneyText(service.outstandingAmount) },
          ]}
        />
      </section>

      {hasOpenLabo && (
        <ConvertLaboBlock planId={row.plan.id} lineId={service.id} onCleared={onLaboCleared} />
      )}
    </div>
  );
}
