import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { withBranch } from "@/lib/clinicBranch";
import { formatDate, formatDateTime } from "@/utils/format";
import { LABO_STATUS } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import type { TreatmentServiceLaboOrderDto } from "../../api/treatmentPlanApi";
import type { PlanDetailRow } from "./planDetailTypes";

/** The line's orders still standing, oldest first as the server lists them. */
function standingOrders(row: PlanDetailRow): TreatmentServiceLaboOrderDto[] {
  return row.service.labOrders.filter((order) => order.status !== LABO_STATUS.Cancelled);
}

/** The line's latest order still standing. */
export function shownLaboOrder(row: PlanDetailRow): TreatmentServiceLaboOrderDto | null {
  return standingOrders(row).at(-1) ?? null;
}

/** "Đã nhận: dd/MM/yyyy HH:mm" once it came back, "Dự kiến giao: dd/MM/yyyy" before (P3110: no hour on the due day). */
function OrderDate({ order }: { order: TreatmentServiceLaboOrderDto }) {
  if (order.receivedAt) {
    return <span className="pdt-labo-due">{t("Treatment:PlanDetail:Labo:ReceivedAt", formatDateTime(order.receivedAt))}</span>;
  }
  if (!order.dueAt) return null;
  return <span className="pdt-labo-due">{t("Treatment:PlanDetail:Labo:DueAt", formatDate(order.dueAt))}</span>;
}

interface Props {
  row: PlanDetailRow;
  /** Opens the shared Labo dialog on the order; left out, the code is plain text. */
  onOpen?: (orderId: string) => void;
}

/**
 * "Phiếu Labo" on the slip's service table (P3110, mock m385), top to bottom:
 * the latest order's own status pill, its LABO code opening the shared dialog,
 * when it came back, and — with older orders on the line — "+N phiếu trước ·
 * Xem tất cả ›" opening the patient's Labo tab in a new browser tab. A line
 * with no order, or only cancelled ones, reads "Không áp dụng".
 */
export function PlanLaboCell({ row, onOpen }: Props) {
  const orders = standingOrders(row);
  const order = orders.at(-1);
  if (!order) return <span className="pdt-labo-none">{t("Treatment:PlanDetail:Labo:None")}</span>;

  const pill = laboStatusPill(order);
  const older = orders.length - 1;
  const allHref = withBranch(`/patient/${row.plan.patientId}?tab=labo`, row.plan.branchId);
  return (
    <div className="pdt-labo">
      <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />
      {onOpen ? (
        <button type="button" className="pdt-labo-code" onClick={() => onOpen(order.id)}>
          {order.orderCode}
        </button>
      ) : (
        <span className="pdt-labo-code pdt-labo-code--plain">{order.orderCode}</span>
      )}
      <OrderDate order={order} />
      {older > 0 && (
        <a className="pdt-labo-more" href={allHref} target="_blank" rel="noopener noreferrer">
          {t("Treatment:PlanDetail:Labo:Older", older)}
        </a>
      )}
    </div>
  );
}
