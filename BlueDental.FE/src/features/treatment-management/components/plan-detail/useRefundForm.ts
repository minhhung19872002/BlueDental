import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
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
import { cardHeldOnLine, cardsOnSlip } from "./cardRefunds";
import { refundedByService } from "./planDetailTypes";

/** "Loại" on the refund dialog: money back on services, or the held balance. */
export const REFUND_TYPE = { service: "service", debt: "debt" } as const;
export type RefundType = (typeof REFUND_TYPE)[keyof typeof REFUND_TYPE];

/** "Hình thức": the channel the money goes back out on, and nothing more — no account. */
export const REFUND_METHODS: PaymentMethodKind[] = [PAYMENT_METHOD.Cash, PAYMENT_METHOD.Banking, PAYMENT_METHOD.Card];

export const refundMethodLabels = (): Record<PaymentMethodKind, string> => ({
  [PAYMENT_METHOD.Cash]: t("Treatment:Payment:Cash"),
  [PAYMENT_METHOD.Banking]: t("Treatment:Payment:BankTransfer"),
  [PAYMENT_METHOD.Card]: t("Treatment:Payment:Card"),
  [PAYMENT_METHOD.EWallet]: t("Treatment:Payment:EWallet"),
  [PAYMENT_METHOD.OutstandingDebt]: t("Treatment:Debt:Outstanding"),
  [PAYMENT_METHOD.PrepaidCard]: t("Treatment:Payment:PrepaidCard"),
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
  /** The slip's collected payments — tells which part of each line a Thẻ trả trước paid. */
  payments: PatientPaymentDto[];
  heldForPatient: number;
  onSaved: () => void;
}

export function useRefundForm({ open, plan, branchId, refunds, payments, heldForPatient, onSaved }: Args) {
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const record = useRecordPayment();

  const [type, setType] = useState<RefundType>(REFUND_TYPE.service);
  const [method, setMethod] = useState<PaymentMethodKind>(PAYMENT_METHOD.Cash);
  const [note, setNote] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>({});
  const [debtAmount, setDebtAmount] = useState<number>();
  const [cardId, setCardId] = useState<string>();
  const cards = useMemo(() => cardsOnSlip(payments, refunds), [payments, refunds]);
  const byCard = method === PAYMENT_METHOD.PrepaidCard;
  const card = cards.find((one) => one.cardId === cardId);

  useEffect(() => {
    if (!open) return;
    setType(REFUND_TYPE.service);
    setMethod(PAYMENT_METHOD.Cash);
    setCardId(undefined);
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
          // Card money goes back onto its card only; any other channel gives back the rest.
          refundable: byCard
            ? Math.max(0, card?.byLine.get(service.id) ?? 0)
            : Math.max(0, service.paidAmount - cardHeldOnLine(cards, service.id)),
          amount: amounts[service.id],
        };
      })
      .filter((line) => line.paid > 0);
  }, [plan.services, refunds, amounts, byCard, card, cards]);

  const serviceTotal = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const total = type === REFUND_TYPE.service ? serviceTotal : (debtAmount ?? 0);
  const overLimit =
    type === REFUND_TYPE.service
      ? lines.some((line) => (line.amount ?? 0) > line.refundable)
      : total > heldForPatient;

  const setLineAmount = (serviceId: string, amount: number | undefined) =>
    setAmounts((current) => ({ ...current, [serviceId]: amount }));

  /** Thẻ trả trước is a channel only for services a card paid. */
  const methods = useMemo(
    () => (type === REFUND_TYPE.service && cards.length > 0 ? [...REFUND_METHODS, PAYMENT_METHOD.PrepaidCard] : REFUND_METHODS),
    [type, cards.length],
  );

  const chooseMethod = (next: PaymentMethodKind) => {
    setMethod(next);
    setCardId(next === PAYMENT_METHOD.PrepaidCard ? cards[0]?.cardId : undefined);
  };

  const chooseType = (next: RefundType) => {
    setType(next);
    if (next !== REFUND_TYPE.service && byCard) chooseMethod(PAYMENT_METHOD.Cash);
  };

  const save = async () => {
    if (byCard && !card) {
      toast.error(t("PrepaidCard:Pay:SelectCard"));
      return;
    }
    if (total <= 0) {
      toast.error(t("Treatment:Refund:AmountRequired"));
      return;
    }
    if (overLimit) {
      toast.error(t("Treatment:Refund:AmountExceeds"));
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
        prepaidCardId: byCard ? cardId : undefined,
      });
      toast.success(t("Treatment:Refund:RefundSuccess"));
      onSaved();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return {
    type, setType: chooseType,
    method, setMethod: chooseMethod, methods,
    cards, cardId, setCardId,
    note, setNote,
    lines, setLineAmount,
    debtAmount, setDebtAmount,
    total, saving: record.isPending, save,
  };
}
