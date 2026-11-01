import { LABO_ORDER_KIND, LABO_STATUS, type LaboOrderDto } from "@/features/labo/api/laboApi";

/** The earlier order of each tooth, by FDI as the form keeps it. */
export type LaboPriorTeeth = ReadonlyMap<string, LaboOrderDto>;

/** One line of the warning: an earlier order and the picked teeth it already carries. */
export interface LaboPriorGroup {
  order: LaboOrderDto;
  teeth: string[];
}

const isLive = (order: LaboOrderDto) =>
  order.status !== LABO_STATUS.Cancelled && order.kind !== LABO_ORDER_KIND.Canceled;

/**
 * The teeth of a phiếu điều trị's other orders that still stand — not the one
 * on screen, not a cancelled one (P0111_02, R-1106). The orders come newest
 * first, so a tooth sent twice names its latest order.
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
