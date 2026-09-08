import { useCallback, useMemo, useState } from "react";
import {
  isToothValueEmpty,
  toggleSurface,
  toggleTooth,
  type Dentition,
  type ToothPick,
  type ToothPickerTab,
  type ToothPickerValue,
  type ToothSurface,
} from "@/components/ToothChart";

interface Draft {
  tab: ToothPickerTab;
  dentition: Dentition;
  teeth: ToothPick[];
}

const EMPTY_DRAFT: Draft = { tab: "teeth", dentition: "permanent", teeth: [] };

/**
 * The tooth side of "Tạo chẩn đoán": which tab is up, adult or baby teeth,
 * and the picks. A jaw tab stands for the whole jaw, so it drops the picks
 * and hides the chart — the same contract as the plan's "Chọn răng" dialog.
 */
export function useDiagnosisDraft() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const setTab = useCallback((tab: ToothPickerTab) => {
    setDraft((current) => ({ ...current, tab, teeth: [] }));
  }, []);

  // Adult and baby teeth never mix on one slip: swapping the chart drops the picks.
  const setDentition = useCallback((dentition: Dentition) => {
    setDraft((current) =>
      current.dentition === dentition ? current : { ...current, dentition, teeth: [] },
    );
  }, []);

  const pickTooth = useCallback((fdi: number) => {
    setDraft((current) => ({ ...current, tab: "teeth", teeth: toggleTooth(current.teeth, fdi) }));
  }, []);

  const pickSurface = useCallback((fdi: number, surface: ToothSurface) => {
    setDraft((current) => ({
      ...current,
      tab: "teeth",
      teeth: toggleSurface(current.teeth, fdi, surface),
    }));
  }, []);

  /** The chip's X: a tooth goes, or the jaw chip returns to picking teeth. */
  const removeTooth = useCallback((fdi: number) => {
    setDraft((current) => ({
      ...current,
      teeth: current.teeth.filter((pick) => pick.fdi !== fdi),
    }));
  }, []);

  const clearJaw = useCallback(() => setDraft((current) => ({ ...current, tab: "teeth" })), []);

  const reset = useCallback(() => setDraft(EMPTY_DRAFT), []);

  /** Seeds the draft from a saved slip; baby teeth (FDI 51–85) bring up the deciduous chart. */
  const load = useCallback((value: ToothPickerValue) => {
    if (value.kind === "jaw") {
      setDraft({ tab: value.jaw, dentition: "permanent", teeth: [] });
      return;
    }
    const dentition: Dentition = value.teeth.some((pick) => pick.fdi >= 51)
      ? "deciduous"
      : "permanent";
    setDraft({ tab: "teeth", dentition, teeth: value.teeth });
  }, []);

  const value = useMemo<ToothPickerValue>(
    () =>
      draft.tab === "teeth"
        ? { kind: "teeth", teeth: draft.teeth }
        : { kind: "jaw", jaw: draft.tab },
    [draft.tab, draft.teeth],
  );

  return {
    tab: draft.tab,
    dentition: draft.dentition,
    teeth: draft.teeth,
    value,
    picking: draft.tab === "teeth",
    isEmpty: isToothValueEmpty(value),
    setTab,
    setDentition,
    pickTooth,
    pickSurface,
    removeTooth,
    clearJaw,
    reset,
    load,
  };
}
