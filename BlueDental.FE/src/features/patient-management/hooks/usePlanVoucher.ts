import { useCallback, useEffect, useMemo, useState } from "react";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import {
  calculateVoucherDiscount,
  useAvailableVouchers,
  type VoucherDto,
} from "@/features/voucher/api/voucherApi";

/**
 * The plan total under the consulting sheet and the vouchers it can carry.
 *
 * As on staging, only the ticked rows count: nothing ticked reads 0 đ. The
 * vouchers offered are the ones the server judges usable for that amount and
 * scoped to the whole plan ("Tổng kế hoạch"); a per-service voucher does not
 * belong on the plan line. Picking is client state until "Thêm kế hoạch điều
 * trị": the ids go with the slip and the server redeems them, burning one use
 * per voucher and working out the discount itself (BA item 24, staging
 * 2026-09-28). The figure shown here is only a preview of that.
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
  /** After the rows' discounts — what a voucher is judged and worked out on. */
  gross: number;
  /** "Voucher". */
  discount: number;
  /** "Thành tiền": Tổng cộng − Giảm giá − Voucher. */
  net: number;
  vouchers: VoucherDto[];
  selected: VoucherDto[];
  loading: boolean;
  query: string;
  setQuery: (query: string) => void;
  toggle: (voucher: VoucherDto) => void;
}

function matchesQuery(voucher: VoucherDto, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return voucher.code.toLowerCase().includes(needle) || voucher.name.toLowerCase().includes(needle);
}

/**
 * An exclusive voucher stands alone: picking it drops the others, and picking
 * anything else while it is on drops it.
 */
function toggleSelection(current: string[], voucher: VoucherDto, all: VoucherDto[]): string[] {
  if (current.includes(voucher.id)) return current.filter((id) => id !== voucher.id);
  if (voucher.isExclusive) return [voucher.id];
  const kept = current.filter((id) => !all.find((item) => item.id === id)?.isExclusive);
  return [...kept, voucher.id];
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

  const { subtotal, serviceDiscount, gross } = useMemo(() => {
    const ticked = rows.filter((row) => selectedRowIds.includes(row.id));
    return {
      subtotal: ticked.reduce((sum, row) => sum + row.grossAmount, 0),
      serviceDiscount: ticked.reduce((sum, row) => sum + row.discountAmount, 0),
      gross: ticked.reduce((sum, row) => sum + row.effectiveAmount, 0),
    };
  }, [rows, selectedRowIds]);

  const available = useAvailableVouchers(gross, branchId ?? undefined);
  const vouchers = useMemo(
    () => (available.data ?? []).filter((voucher) => voucher.scopeTarget === "treatment"),
    [available.data],
  );

  // A voucher the new amount no longer qualifies for leaves the pick — judged
  // on this amount's own list, not the previous one held while it loads (a
  // switch of tab would otherwise drop a pick against another tab's total).
  useEffect(() => {
    if (!available.data || available.isPlaceholderData) return;
    setSelectedIds((current) => {
      const kept = current.filter((id) => vouchers.some((voucher) => voucher.id === id));
      return kept.length === current.length ? current : kept;
    });
  }, [available.data, available.isPlaceholderData, vouchers, setSelectedIds]);

  const selected = useMemo(
    () => vouchers.filter((voucher) => selectedIds.includes(voucher.id)),
    [vouchers, selectedIds],
  );
  const discount = Math.min(
    gross,
    selected.reduce((sum, voucher) => sum + calculateVoucherDiscount(voucher, gross), 0),
  );

  return {
    subtotal,
    serviceDiscount,
    gross,
    discount,
    net: gross - discount,
    vouchers: vouchers.filter((voucher) => matchesQuery(voucher, query)),
    selected,
    loading: available.isPending,
    query,
    setQuery,
    toggle: (voucher) => setSelectedIds((current) => toggleSelection(current, voucher, vouchers)),
  };
}
