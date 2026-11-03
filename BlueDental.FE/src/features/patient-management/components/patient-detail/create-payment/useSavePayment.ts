import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  PAYMENT_KIND,
  SPLIT_MODE,
  useRecordPayment,
  useUpdatePayment,
  type PatientPaymentDto,
  type PaymentLineTermsDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { receiptPagePath } from "@/lib/receiptTab";
import { receiptNameToSend } from "./paymentRounds";
import type { PaymentForm } from "./usePaymentForm";

interface Options {
  patientId: string;
  branchId: string;
  revision: PatientPaymentDto | null;
  /** Ngân hàng / Ví momo must name the account that took the money. */
  needsAccount: boolean;
  onSaved: () => void;
  onClose: () => void;
}

const UNAPPLIED_TERMS = "Patient:Payment:UnappliedTerms";

/** First thing standing in the way of saving, or null when the form can go. */
function blocker(payment: PaymentForm, needsAccount: boolean): string | null {
  const { slip, chosen, money, terms, form } = payment;
  if (!slip) return "Patient:Payment:SlipPlaceholder";
  if (chosen.length === 0) return "Patient:Payment:SelectMinOne";
  if (terms.dirtyIds(chosen.map((line) => line.id)).length > 0) return UNAPPLIED_TERMS;
  // A đợt its TN giảm and voucher settle may collect nothing (P2910).
  if (money.total <= 0 && money.relief === 0) return "Patient:Payment:EnterAmount";
  if (money.overpaid) return "Patient:Payment:AmountExceedsBalance";
  if (needsAccount && !form.accountId) return "Patient:Payment:SelectMethod";
  return null;
}

/**
 * The picked day at the current time of day, so receipts written for the same
 * day still list in the order they were entered. Today is simply now.
 */
function paidAtOf(paidOn: string): string {
  const now = dayjs();
  return dayjs(paidOn).hour(now.hour()).minute(now.minute()).second(now.second()).toISOString();
}

/** Each chosen line's Tên trên phiếu and TN giảm, the latter in đồng whatever unit it was typed in. */
function lineTermsOf({ money, terms, rounds }: PaymentForm): PaymentLineTermsDto[] {
  return money.figures.map(({ line, discount }) => {
    const applied = terms.appliedOf(line.id);
    return {
      treatmentServiceId: line.id,
      receiptName: receiptNameToSend(applied, line.serviceName ?? line.code, rounds.roundOf(line.id)),
      cashierDiscount: discount,
      cashierDiscountReason: discount > 0 ? applied.reason.trim() || null : null,
    };
  });
}

/**
 * Lưu. A new receipt is written "Chưa thanh toán" and moves no money until it
 * is exported and confirmed (P2610), so it saves without asking first and
 * lands on its own page, Tài chính → Phiếu thu, to go on to the customer. A
 * reopened one is corrected in place.
 */
export function useSavePayment(payment: PaymentForm, options: Options) {
  const { patientId, branchId, revision, needsAccount, onSaved, onClose } = options;
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const navigate = useNavigate();
  const record = useRecordPayment();
  const update = useUpdatePayment();

  const figures = () => {
    const { form, chosen, money, voucher } = payment;
    // One receipt naming every chosen service, as the reference posts it.
    // Tự động leaves the split to the server, which is the only side that
    // knows what each line still owes. Thủ công sends every chosen line, 0 đ
    // included: one its relief settles still belongs on the receipt.
    return {
      treatmentServiceIds: chosen.map((line) => line.id),
      splitMode: form.mode === "auto" ? SPLIT_MODE.Auto : SPLIT_MODE.Manual,
      items:
        form.mode === "manual"
          ? chosen.map((line) => ({ treatmentServiceId: line.id, amount: money.shareOf(line) }))
          : [],
      method: form.method,
      amount: money.total,
      redInvoiceRequested: form.redInvoice,
      lineTerms: lineTermsOf(payment),
      voucherId: voucher.idToSend,
    };
  };

  const saveRevision = async (current: PatientPaymentDto) => {
    const { note, accountId } = payment.form;
    await update.mutateAsync({
      id: current.id,
      ...figures(),
      note: note.trim() || null,
      paymentAccountId: needsAccount ? (accountId ?? null) : null,
    });
    toast.success(t("Treatment:Payment:UpdateSuccess"));
  };

  /** Writes the receipt and answers its id. */
  const saveNew = async (planId: string): Promise<string> => {
    const { note, accountId, paidOn } = payment.form;
    const created = await record.mutateAsync({
      ...figures(),
      patientId,
      clinicBranchId: branchId,
      treatmentPlanId: planId,
      kind: PAYMENT_KIND.Payment,
      staffId,
      paidAt: paidAtOf(paidOn),
      note: note.trim() || undefined,
      paymentAccountId: needsAccount ? accountId : undefined,
    });
    toast.success(t("Patient:Payment:CreateSuccess"));
    return created.id;
  };

  /** Lưu: checks the form, then writes or corrects the receipt. */
  const request = async () => {
    const problem = blocker(payment, needsAccount);
    if (problem) {
      // Terms typed but not applied would not be saved: open those cards to show them.
      if (problem === UNAPPLIED_TERMS) {
        payment.terms.unfold(payment.terms.dirtyIds(payment.chosen.map((line) => line.id)));
      }
      toast.error(t(problem));
      return;
    }
    try {
      if (revision) {
        await saveRevision(revision);
        onSaved();
        onClose();
      } else if (payment.slip) {
        const createdId = await saveNew(payment.slip.id);
        onSaved();
        onClose();
        navigate(receiptPagePath(createdId, branchId));
      }
    } catch {
      // Toasted by the global MutationCache; the dialog stays open to correct.
    }
  };

  return {
    request: () => void request(),
    pending: record.isPending || update.isPending,
  };
}
