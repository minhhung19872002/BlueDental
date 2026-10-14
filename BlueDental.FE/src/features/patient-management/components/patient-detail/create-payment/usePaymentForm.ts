import { useState } from "react";
import dayjs from "dayjs";
import {
  PAYMENT_METHOD,
  SPLIT_MODE,
  type PatientPaymentDto,
  type PaymentMethodKind,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { payableLines, selectedTotals } from "./paymentDialogModel";

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

interface Options {
  open: boolean;
  /** The slip the dialog was opened from, if any. */
  initialSlipId: string | null;
  focusServiceId: string | null;
  revision: PatientPaymentDto | null;
  /** The patient's slips; the chosen one is read from here so its money is current. */
  slips: TreatmentPlanSlipDto[];
  /** Used until the list arrives. */
  fallbackSlip: TreatmentPlanSlipDto | null;
  heldForPatient: number;
}

function initialState({ initialSlipId, focusServiceId, revision }: Options): PaymentFormState {
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
 * The dialog's figures and everything worked out from them. The form starts
 * over each time the dialog opens, from the row it was opened on.
 */
export function usePaymentForm(options: Options) {
  const { open, slips, fallbackSlip, revision, heldForPatient } = options;
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
  const chosen = lines.filter((line) => form.picked.includes(line.id));
  const totals = selectedTotals(chosen);

  /**
   * A box the user has not touched offers the whole of what that line owes,
   * and no box may take more than that (bug list item 24: a receipt above
   * what is owed left the clinic owing the patient).
   */
  const shareOf = (line: TreatmentServiceDto) =>
    Math.min(form.manual[line.id] ?? line.outstandingAmount, line.outstandingAmount);
  const manualTotal = chosen.reduce((sum, line) => sum + shareOf(line), 0);

  /**
   * What Tự động offers before anything is typed — the whole of what the ticked
   * services owe, Dư nợ capped at the balance actually held for the patient.
   * It is also the ceiling: a figure typed earlier follows it down.
   */
  const due = Math.max(totals.due, 0);
  const autoDefault =
    form.method === PAYMENT_METHOD.OutstandingDebt ? Math.min(Math.max(heldForPatient, 0), due) : due;
  const autoAmount = form.amount === undefined ? autoDefault : Math.min(form.amount, autoDefault);
  const total = form.mode === "auto" ? autoAmount : manualTotal;

  return {
    form,
    update,
    slip,
    lines,
    chosen,
    totals,
    shareOf,
    autoDefault,
    autoAmount,
    total,
    /** Only meaningful once a line is ticked (R-588). */
    overpaid: chosen.length > 0 && total > totals.due,
    /** Another slip's services replace the ticks and every typed figure. */
    chooseSlip: (slipId: string) => update({ slipId, picked: [], manual: {}, amount: undefined }),
    toggle: (id: string, on: boolean) =>
      setForm((current) => ({
        ...current,
        picked: on ? [...current.picked, id] : current.picked.filter((x) => x !== id),
      })),
    toggleAll: (on: boolean) => update({ picked: on ? lines.map((line) => line.id) : [] }),
    chooseMethod: (method: PaymentMethodKind) => update({ method, accountId: undefined }),
  };
}

export type PaymentForm = ReturnType<typeof usePaymentForm>;
