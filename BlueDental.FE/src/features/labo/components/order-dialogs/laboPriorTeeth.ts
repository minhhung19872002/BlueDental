import { LABO_ORDER_KIND, LABO_STATUS, type LaboOrderDto } from "@/features/labo/api/laboApi";

/** The earlier order of each tooth, by FDI as the form keeps it. */
export type LaboPriorTeeth = ReadonlyMap<string, LaboOrderDto>;

/** One line of the warning: an earlier order and the picked teeth it already carries. */
export interface LaboPriorGroup {
  order: LaboOrderDto;
  teeth: string[];
}

/**
 * An order still on its way (F-91, BA 2026-11-10): Nháp, Đã gửi, Chờ kiểm tra
 * or Labo trả lại. A finished, warranty or cancelled order never warns.
 */
const LIVE_STATUSES: ReadonlySet<number> = new Set([
  LABO_STATUS.Draft,
  LABO_STATUS.Sent,
  LABO_STATUS.AwaitingCheck,
  LABO_STATUS.Returned,
]);

const isLive = (order: LaboOrderDto) => LIVE_STATUSES.has(order.status) && order.kind !== LABO_ORDER_KIND.Canceled;

/**
 * The teeth of the patient's other orders still on their way — not the one on
 * screen (P0111_02 R-1106, widened to every order of the patient by F-91). The
 * orders come newest first, so a tooth sent twice names its latest order.
 */
export function priorLaboTeeth(orders: LaboOrderDto[], currentOrderId: string | undefined): LaboPriorTeeth {
  const priors = new Map<string, LaboOrderDto>();
  for (const order of orders) {
    if (order.id === currentOrderId || !isLive(order)) continue;
    for (const tooth of order.teeth) {
      const fdi = String(tooth.toothNumber);
      if (!priors.has(fdi)) priors.set(fdi, order);
    }
  }
  return priors;
}

/** The picked teeth that already have an order, gathered per order in the order they were picked. */
export function priorGroups(teeth: string[], priors: LaboPriorTeeth): LaboPriorGroup[] {
  const groups = new Map<string, LaboPriorGroup>();
  for (const fdi of teeth) {
    const order = priors.get(fdi);
    if (!order) continue;
    const group = groups.get(order.id) ?? { order, teeth: [] };
    group.teeth.push(fdi);
    groups.set(order.id, group);
  }
  return [...groups.values()];
}
