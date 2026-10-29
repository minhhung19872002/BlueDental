import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { PatientPaymentDto, TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useAvailableVouchers, useVoucherDetail, type VoucherDto } from "@/features/voucher/api/voucherApi";
import { LegacyPermissions } from "@/lib/permissionConstants";
import { priceRoundVoucher, voucherApplies, type RoundVoucherPrice } from "./paymentRounds";

const OFFERED_SCOPES = new Set<VoucherDto["scopeTarget"]>(["treatment", "service"]);

interface Options {
  open: boolean;
  branchId: string;
  revision: PatientPaymentDto | null;
  chosen: TreatmentServiceDto[];
  /** Applied TN giảm per line, in đồng — the voucher is taken on what is left. */
  discounts: Map<string, number>;
  /** The vouchers already on the slip and its other live receipts. */
  alongside: string[];
}

/** Còn nợ chưa thuế of the chosen lines once TN giảm is off: what the server judges the voucher on. */
function orderAmountOf(chosen: TreatmentServiceDto[], discounts: Map<string, number>): number {
  return chosen.reduce(
    (sum, line) => sum + Math.max(0, line.preTaxOutstandingAmount - (discounts.get(line.id) ?? 0)),
    0,
  );
}

/**
 * The voucher picked at payment time (P2910): one per đợt, on what the
 * chosen services still owe before VAT, split evenly over those it reaches.
 * The list needs Khuyến mãi → Xem; without it a reopened receipt keeps the
 * voucher it holds, unseen. An exclusive voucher is not offered beside
 * another; one exclusive among those already on the slip is left to the
 * server to refuse — the slip does not say which of its vouchers are.
 */
export function useRoundVoucher({ open, branchId, revision, chosen, discounts, alongside }: Options) {
  const canView = useAuthStore((state) => state.hasPermission(LegacyPermissions.Promotions.View));
  const heldId = revision?.voucherId ?? null;
  const [voucherId, setVoucherId] = useState<string | null>(heldId);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setVoucherId(heldId);
  }

  const orderAmount = orderAmountOf(chosen, discounts);
  const available = useAvailableVouchers(orderAmount, branchId, open && canView && orderAmount > 0).data;
  // The one a reopened receipt holds may no longer be listed — its last use is the receipt's own.
  const held = useVoucherDetail(open && canView ? heldId : null).data;

  const listed = available ?? [];
  const candidates = held && !listed.some((voucher) => voucher.id === held.id) ? [held, ...listed] : listed;
  const offered = candidates.filter(
    (voucher) =>
      OFFERED_SCOPES.has(voucher.scopeTarget) &&
      !(voucher.isExclusive && alongside.length > 0) &&
      voucherApplies(voucher, chosen, discounts),
  );

  // A pick the new ticks or TN giảm no longer qualify takes nothing off and is not sent.
  const applied = offered.find((voucher) => voucher.id === voucherId) ?? null;
  const price: RoundVoucherPrice = priceRoundVoucher(applied, chosen, discounts);

  return {
    canView,
    offered,
    value: applied?.id ?? null,
    applied,
    price,
    choose: setVoucherId,
    /** What Lưu sends; without the permission the receipt keeps what it holds. */
    idToSend: canView ? (applied?.id ?? null) : heldId,
  };
}

export type RoundVoucher = ReturnType<typeof useRoundVoucher>;
