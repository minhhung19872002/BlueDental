import { useState } from "react";
import type { PatientPaymentDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { BLANK_TERMS, type LineTerms } from "./paymentRounds";

type TermsByLine = Record<string, LineTerms>;

interface TermsState {
  /** As the dialog opened: what Khôi phục goes back to. */
  initial: TermsByLine;
  /** What Áp dụng kept — the figures the receipt is priced on. */
  applied: TermsByLine;
  /** What is typed in an open card and not applied yet. */
  drafts: TermsByLine;
  /** The ticked cards shown open. */
  expanded: string[];
}

/** A reopened receipt's lines as they were written; TN giảm comes back in đồng. */
function termsOf(revision: PatientPaymentDto | null): TermsByLine {
  return Object.fromEntries(
    (revision?.lines ?? []).map((line): [string, LineTerms] => [
      line.treatmentServiceId,
      {
        receiptName: line.receiptName ?? null,
        unit: "money",
        value: line.cashierDiscount || undefined,
        reason: line.cashierDiscountReason ?? "",
      },
    ]),
  );
}

function startOf(revision: PatientPaymentDto | null, focusId: string | null): TermsState {
  const initial = termsOf(revision);
  return { initial, applied: initial, drafts: {}, expanded: focusId && !revision ? [focusId] : [] };
}

/** Equal as the receipt would hold them: no discount is no discount whatever its unit. */
function sameTerms(a: LineTerms, b: LineTerms): boolean {
  const valueA = a.value ?? 0;
  const valueB = b.value ?? 0;
  return (
    a.receiptName === b.receiptName &&
    valueA === valueB &&
    (valueA === 0 || a.unit === b.unit) &&
    a.reason.trim() === b.reason.trim()
  );
}

const without = (map: TermsByLine, id: string): TermsByLine =>
  Object.fromEntries(Object.entries(map).filter(([key]) => key !== id));

/**
 * "Đang chỉnh phiếu đợt N" on each ticked card (P2910): Tên trên phiếu and
 * Giảm giá thu ngân are typed into a draft, kept by Áp dụng — which also folds
 * the card — and put back to how the dialog opened by Khôi phục. Only applied
 * terms price the receipt. Everything starts over when the dialog opens.
 */
export function useRoundTerms(open: boolean, revision: PatientPaymentDto | null, focusId: string | null) {
  const [state, setState] = useState(() => startOf(revision, focusId));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setState(startOf(revision, focusId));
  }

  const appliedOf = (id: string): LineTerms => state.applied[id] ?? BLANK_TERMS;
  const draftOf = (id: string): LineTerms => state.drafts[id] ?? appliedOf(id);

  return {
    appliedOf,
    draftOf,
    isExpanded: (id: string) => state.expanded.includes(id),
    /** The cards whose typed terms differ from what is applied. */
    dirtyIds: (ids: string[]) =>
      ids.filter((id) => state.drafts[id] !== undefined && !sameTerms(state.drafts[id], appliedOf(id))),
    edit: (id: string, patch: Partial<LineTerms>) =>
      setState((current) => ({
        ...current,
        drafts: { ...current.drafts, [id]: { ...(current.drafts[id] ?? current.applied[id] ?? BLANK_TERMS), ...patch } },
      })),
    apply: (id: string) =>
      setState((current) => ({
        ...current,
        applied: current.drafts[id] ? { ...current.applied, [id]: current.drafts[id] } : current.applied,
        drafts: without(current.drafts, id),
        expanded: current.expanded.filter((key) => key !== id),
      })),
    restore: (id: string) =>
      setState((current) => ({
        ...current,
        applied: current.initial[id] ? { ...current.applied, [id]: current.initial[id] } : without(current.applied, id),
        drafts: without(current.drafts, id),
      })),
    expand: (id: string, on: boolean) =>
      setState((current) => ({
        ...current,
        expanded: on
          ? [...current.expanded.filter((key) => key !== id), id]
          : current.expanded.filter((key) => key !== id),
      })),
    /** Ticking everything at once leaves the cards folded; unticking all folds them. */
    foldAll: () => setState((current) => ({ ...current, expanded: [] })),
    /** Open the given cards — the ones a blocked save points at. */
    unfold: (ids: string[]) =>
      setState((current) => ({ ...current, expanded: [...new Set([...current.expanded, ...ids])] })),
  };
}

export type RoundTerms = ReturnType<typeof useRoundTerms>;
