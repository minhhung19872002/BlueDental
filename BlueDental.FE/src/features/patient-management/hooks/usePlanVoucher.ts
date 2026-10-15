import { useCallback, useEffect, useMemo, useState } from "react";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import {
  calculateVoucherDiscount,
  useAvailableVouchers,
  type VoucherDto,
} from "@/features/voucher/api/voucherApi";
import {
  priceVouchers,
  voucherBase,
  voucherFits,
  voucherTargets,
} from "../utils/planVoucherPricing";

/**
 * The plan total under the consulting sheet and the vouchers it can carry.
 *
 * As on staging, only the ticked rows count: nothing ticked reads 0 đ. The
 * vouchers offered are the ones the server judges usable for that amount:
 * whole-plan ones ("Tổng kế hoạch") and, since R-949, "Theo dịch vụ" ones that
 * name a ticked row's service or its group — those take off only the rows they
 * name, before the plan vouchers are worked out on what is left (see
 * `planVoucherPricing`). Picking is client state until "Thêm kế hoạch điều
 * trị": the ids go with the slip and the server redeems them, burning one use
 * per voucher and working out the discount itself (BA item 24, staging
 * 2026-09-28). The figures shown here are only a preview of that.
 *
 * Each tab keeps a pick of its own — Phiếu tư vấn and every báo giá are priced
 * independently (project owner, 2026-09-30), so `scope` names the tab showing
 * and a voucher picked on BG 1 is not on Phiếu tư vấn or BG 2.
 */
export interface PlanVoucherState {
  /** "Tổng cộng": đơn giá × số lượng over the ticked rows. */
  subtotal: number;
  /** "Giảm giá": the ticked rows' own discounts. */
  serviceDiscount: number;
  /** After the rows' discounts — what the vouchers are judged and worked out on. */
  gross: number;
  /** "Voucher": the service and the plan vouchers together. */
  discount: number;
  /** "Thành tiền": Tổng cộng − Giảm giá − Voucher. */
  net: number;
  vouchers: VoucherDto[];
  selected: VoucherDto[];
  loading: boolean;
  query: string;
  setQuery: (query: string) => void;
  toggle: (voucher: VoucherDto) => void;
  /** What a voucher takes off: its share of the pick if picked, else what it would. */
  savingOf: (voucher: VoucherDto) => number;
  /** The ticked services a "Theo dịch vụ" voucher reaches; empty for a plan voucher. */
  targetNamesOf: (voucher: VoucherDto) => string[];
}

const OFFERED_SCOPES = new Set<VoucherDto["scopeTarget"]>(["treatment", "service"]);

function matchesQuery(voucher: VoucherDto, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return voucher.code.toLowerCase().includes(needle) || voucher.name.toLowerCase().includes(needle);
}

/**
 * An exclusive voucher stands alone — across both kinds: picking it drops the
 * others, and picking anything else while it is on drops it.
 */
function toggleSelection(current: string[], voucher: VoucherDto, all: VoucherDto[]): string[] {
  if (current.includes(voucher.id)) return current.filter((id) => id !== voucher.id);
  if (voucher.isExclusive) return [voucher.id];
  const kept = current.filter((id) => !all.find((item) => item.id === id)?.isExclusive);
  return [...kept, voucher.id];
}

/** The picked vouchers in the order they were ticked — the order the server redeems them. */
function pickedInOrder(ids: string[], offered: VoucherDto[]): VoucherDto[] {
  return ids
    .map((id) => offered.find((voucher) => voucher.id === id))
    .filter((voucher): voucher is VoucherDto => voucher !== undefined);
}

const NONE: string[] = [];

export function usePlanVoucher(
  rows: PatientAdviseDto[],
  selectedRowIds: string[],
  branchId: string | null,
  /** The tab the figures are for: its picks are kept apart from every other tab's. */
  scope: string,
): PlanVoucherState {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const selectedIds = picks[scope] ?? NONE;
  const setSelectedIds = useCallback(
    (update: (current: string[]) => string[]) =>
      setPicks((all) => {
        const current = all[scope] ?? NONE;
        const next = update(current);
        return next === current ? all : { ...all, [scope]: next };
      }),
    [scope],
  );

  const ticked = useMemo(
    () => rows.filter((row) => selectedRowIds.includes(row.id)),
    [rows, selectedRowIds],
  );
  const subtotal = ticked.reduce((sum, row) => sum + row.grossAmount, 0);
  const serviceDiscount = ticked.reduce((sum, row) => sum + row.discountAmount, 0);
  const gross = ticked.reduce((sum, row) => sum + row.effectiveAmount, 0);

  // The server judges the minimum order on the whole ticked amount, which is
  // never less than any voucher's own base — so its list is a superset, and
  // `voucherFits` narrows it to what the slip would really take.
  const available = useAvailableVouchers(gross, branchId ?? undefined);
  const offered = useMemo(
    () => (available.data ?? []).filter((voucher) => OFFERED_SCOPES.has(voucher.scopeTarget)),
    [available.data],
  );
  const selected = useMemo(() => pickedInOrder(selectedIds, offered), [selectedIds, offered]);
  const vouchers = useMemo(
    () => offered.filter((voucher) => voucherFits(voucher, ticked, selected)),
    [offered, ticked, selected],
  );

  // A voucher the new ticks no longer qualify for leaves the pick — judged on
  // this amount's own list, not the previous one held while it loads (a switch
  // of tab would otherwise drop a pick against another tab's total).
  useEffect(() => {
    if (!available.data || available.isPlaceholderData) return;
    setSelectedIds((current) => {
      const kept = current.filter((id) => vouchers.some((voucher) => voucher.id === id));
      return kept.length === current.length ? current : kept;
    });
  }, [available.data, available.isPlaceholderData, vouchers, setSelectedIds]);

  const applied = useMemo(
    () => selected.filter((voucher) => vouchers.some((item) => item.id === voucher.id)),
    [selected, vouchers],
  );
  const priced = useMemo(() => priceVouchers(ticked, applied), [ticked, applied]);
  const discount = priced.serviceTotal + priced.planTotal;

  const savingOf = useCallback(
    (voucher: VoucherDto) => {
      const own = priced.applied[voucher.id];
      if (own !== undefined) return own;
      return Math.round(calculateVoucherDiscount(voucher, voucherBase(voucher, ticked, applied) ?? 0));
    },
    [priced, ticked, applied],
  );
  const targetNamesOf = useCallback(
    (voucher: VoucherDto) =>
      voucher.scopeTarget !== "service"
        ? []
        : [
            ...new Set(
              ticked
                .filter((row) => voucherTargets(voucher, row))
                .map((row) => row.serviceName ?? row.code),
            ),
          ],
    [ticked],
  );

  return {
    subtotal,
    serviceDiscount,
    gross,
    discount,
    net: gross - discount,
    vouchers: vouchers.filter((voucher) => matchesQuery(voucher, query)),
    selected: applied,
    loading: available.isPending,
    query,
    setQuery,
    toggle: (voucher) => setSelectedIds((current) => toggleSelection(current, voucher, offered)),
    savingOf,
    targetNamesOf,
  };
}
