import { useEffect, useMemo, useState } from "react";
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
 * belong on the plan line. Picking is client state — the reference never
 * showed what applying one sends, see docs/clone/unknowns.md.
 */
export interface PlanVoucherState {
  gross: number;
  discount: number;
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

export function usePlanVoucher(
  rows: PatientAdviseDto[],
  selectedRowIds: string[],
  branchId: string | null,
): PlanVoucherState {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const gross = useMemo(
    () =>
      rows
        .filter((row) => selectedRowIds.includes(row.id))
        .reduce((sum, row) => sum + row.effectiveAmount, 0),
    [rows, selectedRowIds],
  );

  const available = useAvailableVouchers(gross, branchId ?? undefined);
  const vouchers = useMemo(
    () => (available.data ?? []).filter((voucher) => voucher.scopeTarget === "treatment"),
    [available.data],
  );

  // A voucher the new amount no longer qualifies for leaves the pick.
  useEffect(() => {
    if (!available.data) return;
    setSelectedIds((current) => {
      const kept = current.filter((id) => vouchers.some((voucher) => voucher.id === id));
      return kept.length === current.length ? current : kept;
    });
  }, [available.data, vouchers]);

  const selected = useMemo(
    () => vouchers.filter((voucher) => selectedIds.includes(voucher.id)),
    [vouchers, selectedIds],
  );
  const discount = Math.min(
    gross,
    selected.reduce((sum, voucher) => sum + calculateVoucherDiscount(voucher, gross), 0),
  );

  return {
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
