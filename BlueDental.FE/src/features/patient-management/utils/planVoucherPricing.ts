import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import { calculateVoucherDiscount, type VoucherDto } from "@/features/voucher/api/voucherApi";

/**
 * The vouchers on the plan block, priced the way the server redeems them in
 * `TreatmentPlan.RedeemVouchers` (R-949): the "Theo dịch vụ" vouchers first,
 * each on the ticked rows it targets and spread over them by value, then the
 * whole-plan vouchers on what those leave. Only a preview — the server works
 * the money out again when the slip is opened.
 */
export interface PricedVouchers {
  /** What each picked voucher takes off, by voucher id. */
  applied: Record<string, number>;
  /** Σ of the service vouchers. */
  serviceTotal: number;
  /** Σ of the plan vouchers, never more than what the service vouchers left. */
  planTotal: number;
  /** What the ticked rows still come to after the service vouchers. */
  planBase: number;
  /** What every ticked row still comes to after all the picked vouchers. */
  remaining: Map<string, number>;
}

/** A "Theo dịch vụ" voucher reaches a row by naming its service or the service's group. */
export function voucherTargets(voucher: VoucherDto, row: PatientAdviseDto): boolean {
  return (
    voucher.targetIds.includes(row.serviceId) ||
    (row.serviceGroupId !== null && voucher.targetIds.includes(row.serviceGroupId))
  );
}

export const isServiceVoucher = (voucher: VoucherDto) => voucher.scopeTarget === "service";

/** The server's `Vnd.Round`: whole đồng, half away from zero. */
const vnd = (amount: number) => Math.round(amount);

/** `SplitByWeight`: the share of each row by its value, the rounding leftover on the heaviest. */
function splitByWeight(amount: number, weights: [string, number][]): [string, number][] {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  if (total === 0) return weights.map(([id]) => [id, 0]);
  const parts = weights.map(([id, weight]): [string, number] => [id, vnd((amount * weight) / total)]);
  const leftover = amount - parts.reduce((sum, [, part]) => sum + part, 0);
  if (leftover !== 0) {
    const heaviest = weights.reduce((top, pair) => (pair[1] > top[1] ? pair : top))[0];
    const slot = parts.find(([id]) => id === heaviest);
    if (slot) slot[1] += leftover;
  }
  return parts;
}

const sumOf = (rows: PatientAdviseDto[], remaining: Map<string, number>) =>
  rows.reduce((sum, row) => sum + (remaining.get(row.id) ?? 0), 0);

export function priceVouchers(ticked: PatientAdviseDto[], picks: VoucherDto[]): PricedVouchers {
  const remaining = new Map(ticked.map((row) => [row.id, row.effectiveAmount]));
  const applied: Record<string, number> = {};
  let serviceTotal = 0;

  for (const voucher of picks.filter(isServiceVoucher)) {
    const matching = ticked.filter((row) => voucherTargets(voucher, row));
    const amount = vnd(calculateVoucherDiscount(voucher, sumOf(matching, remaining)));
    const weights = matching.map((row): [string, number] => [row.id, remaining.get(row.id) ?? 0]);
    for (const [id, part] of splitByWeight(amount, weights)) {
      remaining.set(id, (remaining.get(id) ?? 0) - part);
    }
    applied[voucher.id] = amount;
    serviceTotal += amount;
  }

  const planBase = sumOf(ticked, remaining);
  let planVouchers = 0;
  for (const voucher of picks.filter((voucher) => !isServiceVoucher(voucher))) {
    const amount = vnd(calculateVoucherDiscount(voucher, planBase));
    applied[voucher.id] = amount;
    planVouchers += amount;
  }

  return {
    applied,
    serviceTotal,
    planTotal: Math.min(planVouchers, planBase),
    planBase,
    remaining,
  };
}

/**
 * The amount a voucher is judged on if it is added to the pick (or kept in it):
 * a service voucher on what its rows have left, a plan voucher on what the
 * service vouchers leave. Null when a service voucher reaches no ticked row.
 */
export function voucherBase(
  voucher: VoucherDto,
  ticked: PatientAdviseDto[],
  picks: VoucherDto[],
): number | null {
  if (isServiceVoucher(voucher)) {
    const matching = ticked.filter((row) => voucherTargets(voucher, row));
    if (matching.length === 0) return null;
    // Picked: judged after the service vouchers ticked before it. Not yet: it would go last.
    const at = picks.findIndex((pick) => pick.id === voucher.id);
    const before = (at < 0 ? picks : picks.slice(0, at)).filter(isServiceVoucher);
    return sumOf(matching, priceVouchers(ticked, before).remaining);
  }
  return priceVouchers(ticked, picks.filter(isServiceVoucher)).planBase;
}

/** Whether the server would take this voucher on the ticked rows beside the rest of the pick. */
export function voucherFits(voucher: VoucherDto, ticked: PatientAdviseDto[], picks: VoucherDto[]): boolean {
  const base = voucherBase(voucher, ticked, picks);
  if (base === null) return false;
  return voucher.minOrderValue === null || base >= voucher.minOrderValue;
}
