import { useState } from "react";
import dayjs from "dayjs";
import {
  PAYMENT_METHOD,
  SPLIT_MODE,
  type PatientPaymentDto,
  type PaymentMethodKind,
  type TreatmentPlanSlipDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { payableLines } from "./paymentDialogModel";

/** Chia Tiền Tự Động / Chia Tiền Thủ Công. */
export type SplitMode = "auto" | "manual";

export interface PaymentFormState {
  slipId: string | null;
  picked: string[];
  mode: SplitMode;
  amount: number | undefined;
  manual: Record<string, number | undefined>;
  method: PaymentMethodKind;
  accountId: string | undefined;
  note: string;
  /** "Xuất hóa đơn đỏ" — only stored on the receipt; issuing happens on another screen. */
  redInvoice: boolean;
  /**
   * Ngày thanh toán, "YYYY-MM-DD": today or any day before it, so money taken
   * earlier can be entered afterwards (owner 2026-10-14). A reopened receipt
   * shows the day it was written; only a new one sends this.
   */
  paidOn: string;
}

export const ISO_DAY = "YYYY-MM-DD";

export interface PaymentFieldOptions {
  open: boolean;
  /** The slip the dialog was opened from, if any. */
  initialSlipId: string | null;
  focusServiceId: string | null;
  revision: PatientPaymentDto | null;
  /** The patient's slips; the chosen one is read from here so its money is current. */
  slips: TreatmentPlanSlipDto[];
  /** Used until the list arrives. */
  fallbackSlip: TreatmentPlanSlipDto | null;
}

function initialState({ initialSlipId, focusServiceId, revision }: PaymentFieldOptions): PaymentFormState {
  if (revision) {
    // The receipt as it was written; a pending one counts nowhere, so every
    // line's Còn nợ is still the whole of what it owes.
    return {
      slipId: revision.treatmentPlanId ?? initialSlipId,
      picked: revision.lines.map((line) => line.treatmentServiceId),
      mode: revision.splitMode === SPLIT_MODE.Manual ? "manual" : "auto",
      amount: revision.amount,
      manual: Object.fromEntries(revision.lines.map((line) => [line.treatmentServiceId, line.amount])),
      method: revision.method,
      accountId: revision.paymentAccountId ?? undefined,
      note: revision.note ?? "",
      redInvoice: revision.redInvoiceRequested,
      paidOn: dayjs(revision.creationTime).format(ISO_DAY),
    };
  }
  return {
    slipId: initialSlipId,
    picked: focusServiceId ? [focusServiceId] : [],
    mode: "auto",
    amount: undefined,
    manual: {},
    method: PAYMENT_METHOD.Cash,
    accountId: undefined,
    note: "",
    redInvoice: false,
    paidOn: dayjs().format(ISO_DAY),
  };
}

/**
 * What the cashier has typed and ticked. The form starts over each time the
 * dialog opens, from the row it was opened on.
 */
export function usePaymentFields(options: PaymentFieldOptions) {
  const { open, slips, fallbackSlip, revision } = options;
  const [form, setForm] = useState(() => initialState(options));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initialState(options));
  }

  const update = (patch: Partial<PaymentFormState>) => setForm((current) => ({ ...current, ...patch }));

  const slip =
    slips.find((item) => item.id === form.slipId) ??
    (fallbackSlip?.id === form.slipId ? fallbackSlip : null);
  const lines = payableLines(slip, revision);

  return {
    form,
    update,
    slip,
    lines,
    chosen: lines.filter((line) => form.picked.includes(line.id)),
    /** Another slip's services replace the ticks and every typed figure. */
    chooseSlip: (slipId: string) => update({ slipId, picked: [], manual: {}, amount: undefined }),
    chooseMethod: (method: PaymentMethodKind) => update({ method, accountId: undefined }),
    pick: (id: string, on: boolean) =>
      setForm((current) => ({
        ...current,
        picked: on ? [...current.picked, id] : current.picked.filter((x) => x !== id),
      })),
    pickAll: (on: boolean) => update({ picked: on ? lines.map((line) => line.id) : [] }),
  };
}

export type PaymentFields = ReturnType<typeof usePaymentFields>;
