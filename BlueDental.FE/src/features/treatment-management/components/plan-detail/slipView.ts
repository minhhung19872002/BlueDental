import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import type { TreatmentPlanSlipDto, TreatmentServiceDto } from "../../api/treatmentPlanApi";
import { moneyText, SERVICE_PILL } from "../plan/planTypes";
import { longDate, type ReceiptTotal } from "./receiptView";

/** One service row of the slip's "Chi tiết phiếu" and of the printed "Phiếu điều trị". */
export interface SlipLine {
  service: TreatmentServiceDto;
  /** The teeth the line is on, over the service name; null when none were picked. */
  teethLabel: string | null;
  statusLabel: string;
  /** "300.000 đ x 1" on the sheet — the net unit price times the quantity. */
  unitLabel: string;
}

export interface SlipView {
  dateLabel: string;
  lines: SlipLine[];
  totals: ReceiptTotal[];
}

function lineOf(service: TreatmentServiceDto): SlipLine {
  const teeth = formatTeeth(service.teeth);
  const unit = service.quantity > 0 ? service.effectiveAmount / service.quantity : service.effectiveAmount;
  return {
    service,
    teethLabel: teeth === "—" ? null : teeth,
    statusLabel: t(SERVICE_PILL[service.status]?.label ?? ""),
    unitLabel: t("{0} x {1}", moneyText(unit), service.quantity),
  };
}

/** "Chi tiết phiếu" of the whole slip: every line, what it comes to, what was paid, what is owed. */
export function slipViewOf(plan: TreatmentPlanSlipDto, today: Date): SlipView {
  return {
    dateLabel: longDate(today),
    lines: plan.services.map(lineOf),
    totals: [
      { label: t("Tổng phí"), value: plan.totalAmount },
      { label: t("Đã trả trước đó"), value: plan.payment.totalPaid },
      { label: t("Tổng còn nợ"), value: plan.payment.debt, tone: "debt" },
    ],
  };
}
