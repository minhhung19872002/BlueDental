import { useMemo } from "react";
import {
  PAYMENT_KIND,
  usePatientPayments,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { earlierReceipts, isLive, roundsOfLine, type EarlierRound } from "./paymentRounds";

interface Options {
  open: boolean;
  patientId: string;
  branchId: string;
  slip: TreatmentPlanSlipDto | null;
  revision: PatientPaymentDto | null;
}

/**
 * The slip's đợt so far (P2910): every receipt still standing on it, "Chưa
 * thanh toán" ones included — each is a đợt and takes a number, though only
 * a paid one moves money.
 */
export function usePaymentRounds({ open, patientId, branchId, slip, revision }: Options) {
  const query = usePatientPayments({
    patientId: open && slip ? patientId : "",
    clinicBranchId: branchId,
    treatmentPlanId: slip?.id,
    kind: PAYMENT_KIND.Payment,
    includePending: true,
    maxResultCount: 100,
  });
  const receipts = useMemo(() => query.data?.items ?? [], [query.data]);
  const earlier = useMemo(() => earlierReceipts(receipts, revision), [receipts, revision]);

  /**
   * The vouchers already on the slip — the doctor's and those of its other
   * live receipts. An exclusive voucher cannot join any of them.
   */
  const alongside = useMemo(() => {
    const onReceipts = receipts
      .filter((receipt) => isLive(receipt) && receipt.id !== revision?.id && receipt.voucherId)
      .map((receipt) => receipt.voucherId ?? "");
    return [...new Set([...(slip?.appliedVouchers ?? []).map((applied) => applied.voucherId), ...onReceipts])];
  }, [receipts, revision, slip]);

  const historyOf = (lineId: string): EarlierRound[] => roundsOfLine(earlier, lineId);
  return {
    alongside,
    historyOf,
    /** This đợt's number on the line: one past the receipts before it. */
    roundOf: (lineId: string) => historyOf(lineId).length + 1,
  };
}

export type PaymentRounds = ReturnType<typeof usePaymentRounds>;
