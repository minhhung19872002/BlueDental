import dayjs from "dayjs";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useRenderPaymentReceipt } from "@/features/treatment-management/api/eInvoiceApi";
import {
  PAYMENT_KIND,
  SPLIT_MODE,
  useRecordPayment,
  useUpdatePayment,
  type PatientPaymentDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
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

/** First thing standing in the way of saving, or null when the form can go. */
function blocker(payment: PaymentForm, needsAccount: boolean): string | null {
  if (!payment.slip) return "Patient:Payment:SlipPlaceholder";
  if (payment.chosen.length === 0) return "Patient:Payment:SelectMinOne";
  if (payment.total <= 0) return "Patient:Payment:EnterAmount";
  if (payment.overpaid) return "Patient:Payment:AmountExceedsBalance";
  if (needsAccount && !payment.form.accountId) return "Patient:Payment:SelectMethod";
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

/**
 * Lưu. A new receipt is written "Chưa thanh toán" and moves no money until it
 * is exported and confirmed (P2610), so it saves without asking first; its
 * PHIẾU THU opens in a new tab (owner 2026-10-12). A reopened one is corrected.
 */
export function useSavePayment(payment: PaymentForm, options: Options) {
  const { patientId, branchId, revision, needsAccount, onSaved, onClose } = options;
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const record = useRecordPayment();
  const update = useUpdatePayment();
  const receipt = useRenderPaymentReceipt();

  const figures = () => {
    const { form, chosen, shareOf, total } = payment;
    // One receipt naming every chosen service, as the reference posts it.
    // Tự động leaves the split to the server, which is the only side that
    // knows what each line still owes.
    return {
      treatmentServiceIds: chosen.map((line) => line.id),
      splitMode: form.mode === "auto" ? SPLIT_MODE.Auto : SPLIT_MODE.Manual,
      items:
        form.mode === "manual"
          ? chosen
              .map((line) => ({ treatmentServiceId: line.id, amount: shareOf(line) }))
              .filter((item) => item.amount > 0)
          : [],
      method: form.method,
      amount: total,
      redInvoiceRequested: form.redInvoice,
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

  const saveNew = async (planId: string, tab: Window | null) => {
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
    // The receipt is saved; a PHIẾU THU that fails to render does not undo it.
    // It is dated the day the money was taken, not the day it was entered.
    receipt
      .mutateAsync({ patientPaymentId: created.id, buyerName: null, arisingDate: paidOn, lines: [] })
      .then((pdf) => showReceipt(tab, pdf))
      // The failure itself is toasted by the global MutationCache.
      .catch(() => tab?.close());
  };

  /** Lưu: checks the form, then writes or corrects the receipt. */
  const request = async () => {
    const problem = blocker(payment, needsAccount);
    if (problem) {
      toast.error(t(problem));
      return;
    }
    // Opened inside the click, before any await, or the browser blocks it.
    const tab = revision || !payment.slip ? null : openReceiptTab();
    try {
      if (revision) await saveRevision(revision);
      else if (payment.slip) await saveNew(payment.slip.id, tab);
      onSaved();
      onClose();
    } catch {
      // Toasted by the global MutationCache; the dialog stays open to correct.
      tab?.close();
    }
  };

  return {
    request: () => void request(),
    pending: record.isPending || update.isPending,
  };
}
