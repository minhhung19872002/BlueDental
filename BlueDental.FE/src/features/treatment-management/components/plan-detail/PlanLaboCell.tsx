import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import { LABO_STATUS } from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import type { TreatmentServiceLaboOrderDto } from "../../api/treatmentPlanApi";
import type { PlanDetailRow } from "./planDetailTypes";

/** The line's latest order still standing; the server lists them oldest first. */
export function shownLaboOrder(row: PlanDetailRow): TreatmentServiceLaboOrderDto | null {
  const standing = row.service.labOrders.filter((order) => order.status !== LABO_STATUS.Cancelled);
  return standing.at(-1) ?? null;
}

/** "Bảo hành" once the clinic activated a card (expired ones too), "Chờ Labo" before. */
function chipOf(order: TreatmentServiceLaboOrderDto) {
  return order.status === LABO_STATUS.Warranty
    ? { label: "Treatment:PlanDetail:Labo:Warranty", ...LABO_PILL_TONE.purple }
    : { label: "Treatment:PlanDetail:Labo:Waiting", ...LABO_PILL_TONE.warning };
}

interface Props {
  row: PlanDetailRow;
  /** Opens the shared Labo dialog on the order; left out, the code is plain text. */
  onOpen?: (orderId: string) => void;
}

/**
 * "Phiếu Labo" on the slip's service table (P2910_03): the chip, the LABO code
 * opening the shared dialog, and "Dự kiến giao" under them. A line with no
 * order, or only cancelled ones, reads "Không áp dụng".
 */
export function PlanLaboCell({ row, onOpen }: Props) {
  const order = shownLaboOrder(row);
  if (!order) return <span className="pdt-labo-none">{t("Treatment:PlanDetail:Labo:None")}</span>;

  const chip = chipOf(order);
  return (
    <div className="pdt-labo">
      <span className="pdt-labo-head">
        <StatusBadge label={t(chip.label)} bg={chip.bg} color={chip.color} />
        {onOpen ? (
          <button type="button" className="pdt-labo-code" onClick={() => onOpen(order.id)}>
            {order.orderCode}
          </button>
        ) : (
          <span>{order.orderCode}</span>
        )}
      </span>
      {order.dueAt && (
        <span className="pdt-labo-due">{t("Treatment:PlanDetail:Labo:DueAt", formatDateTime(order.dueAt))}</span>
      )}
    </div>
  );
}
