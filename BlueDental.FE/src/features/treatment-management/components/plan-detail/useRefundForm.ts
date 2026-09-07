import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  PAYMENT_KIND,
  PAYMENT_METHOD,
  SPLIT_MODE,
  useRecordPayment,
  type PatientPaymentDto,
  type PaymentMethodKind,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "../../api/treatmentPlanApi";
import { refundedByService } from "./planDetailTypes";

/** "Loại" on the refund dialog: money back on services, or the held balance. */
export const REFUND_TYPE = { service: "service", debt: "debt" } as const;
export type RefundType = (typeof REFUND_TYPE)[keyof typeof REFUND_TYPE];

/** "Hình thức": the channel the money goes back out on, and nothing more — no account. */
export const REFUND_METHODS: PaymentMethodKind[] = [PAYMENT_METHOD.Cash, PAYMENT_METHOD.Banking, PAYMENT_METHOD.Card];

export const refundMethodLabels = (): Record<PaymentMethodKind, string> => ({
  [PAYMENT_METHOD.Cash]: t("Tiền mặt"),
  [PAYMENT_METHOD.Banking]: t("Chuyển khoản"),
  [PAYMENT_METHOD.Card]: t("Quẹt thẻ"),
  [PAYMENT_METHOD.EWallet]: t("Ví momo"),
  [PAYMENT_METHOD.OutstandingDebt]: t("Dư nợ"),
});

/** One row of the refund table: the line, what it can still give back, what was typed. */
export interface RefundLine {
  service: TreatmentServiceDto;
  /** Everything collected on the line, before refunds — "Đã thanh toán". */
  paid: number;
  refunded: number;
  /** What the line still holds (the API's paidAmount is net of refunds): the most the box accepts. */
  refundable: number;
  amount: number | undefined;
}

interface Args {
  open: boolean;
  plan: TreatmentPlanSlipDto;
  branchId: string;
  refunds: PatientPaymentDto[];
  heldForPatient: number;
  onSaved: () => void;
}

export function useRefundForm({ open, plan, branchId, refunds, heldForPatient, onSaved }: Args) {
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const record = useRecordPayment();

  const [type, setType] = useState<RefundType>(REFUND_TYPE.service);
  const [method, setMethod] = useState<PaymentMethodKind>(PAYMENT_METHOD.Cash);
  const [note, setNote] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>({});
  const [debtAmount, setDebtAmount] = useState<number>();

  useEffect(() => {
    if (!open) return;
    setType(REFUND_TYPE.service);
    setMethod(PAYMENT_METHOD.Cash);
    setNote("");
    setAmounts({});
    setDebtAmount(undefined);
  }, [open]);

  const lines = useMemo<RefundLine[]>(() => {
    const refunded = refundedByService(refunds);
    return plan.services
      .map((service) => {
        const back = refunded.get(service.id) ?? 0;
        return {
          service,
          paid: service.paidAmount + back,
          refunded: back,
          refundable: Math.max(0, service.paidAmount),
          amount: amounts[service.id],
        };
      })
      .filter((line) => line.paid > 0);
  }, [plan.services, refunds, amounts]);

  const serviceTotal = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const total = type === REFUND_TYPE.service ? serviceTotal : (debtAmount ?? 0);
  const overLimit =
    type === REFUND_TYPE.service
      ? lines.some((line) => (line.amount ?? 0) > line.refundable)
      : total > heldForPatient;

  const setLineAmount = (serviceId: string, amount: number | undefined) =>
    setAmounts((current) => ({ ...current, [serviceId]: amount }));

  const save = async () => {
    if (total <= 0) {
      toast.error(t("Vui lòng nhập số tiền hoàn"));
      return;
    }
    if (overLimit) {
      toast.error(t("Số tiền hoàn không được vượt quá số tiền đã thanh toán"));
      return;
    }
    const items = lines
      .filter((line) => (line.amount ?? 0) > 0)
      .map((line) => ({ treatmentServiceId: line.service.id, amount: line.amount ?? 0 }));
    try {
      await record.mutateAsync({
        patientId: plan.patientId,
        clinicBranchId: branchId,
        treatmentPlanId: type === REFUND_TYPE.service ? plan.id : undefined,
        treatmentServiceIds: type === REFUND_TYPE.service ? items.map((item) => item.treatmentServiceId) : undefined,
        splitMode: type === REFUND_TYPE.service ? SPLIT_MODE.Manual : undefined,
        items: type === REFUND_TYPE.service ? items : undefined,
        kind: PAYMENT_KIND.Refund,
        method,
        amount: total,
        staffId,
        note: note.trim() || undefined,
      });
      toast.success(t("Đã tạo phiếu hoàn tiền"));
      onSaved();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return {
    type, setType,
    method, setMethod,
    note, setNote,
    lines, setLineAmount,
    debtAmount, setDebtAmount,
    total, saving: record.isPending, save,
  };
}
