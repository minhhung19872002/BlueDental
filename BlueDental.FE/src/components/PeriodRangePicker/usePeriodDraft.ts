import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  ISO_DATE,
  unitEnd,
  unitStart,
  type PeriodGrain,
  type PeriodPreset,
  type PeriodRangeValue,
} from "./periodGrain";

interface DraftState {
  grain: PeriodGrain;
  from: Dayjs;
  to: Dayjs;
  compare: boolean;
  /** The first click of a range still waiting for its second. */
  anchor: Dayjs | null;
  /** The unit under the pointer while a range is being picked. */
  hovered: Dayjs | null;
  /** The month (Ngày) or year the grid shows. */
  view: Dayjs;
}

export interface PeriodDraft {
  grain: PeriodGrain;
  from: Dayjs;
  to: Dayjs;
  compare: boolean;
  view: Dayjs;
  picking: boolean;
  /** Where the highlight runs: the picked range, or anchor → pointer mid-pick. */
  shown: { from: Dayjs; to: Dayjs };
  setGrain: (grain: PeriodGrain) => void;
  pick: (date: Dayjs) => void;
  hover: (date: Dayjs | null) => void;
  applyPreset: (preset: PeriodPreset) => void;
  setCompare: (compare: boolean) => void;
  page: (direction: -1 | 1) => void;
  toValue: () => PeriodRangeValue;
}

function fromValue(value: PeriodRangeValue): DraftState {
  const from = dayjs(value.from);
  return { grain: value.grain, from, to: dayjs(value.to), compare: value.compare, anchor: null, hovered: null, view: from };
}

function ordered(a: Dayjs, b: Dayjs): [Dayjs, Dayjs] {
  return a.isAfter(b) ? [b, a] : [a, b];
}

/** How far ‹ › move the grid: a month of days, a year of units, twelve years. */
function pageUnit(grain: PeriodGrain): { amount: number; unit: "month" | "year" } {
  if (grain === "day") return { amount: 1, unit: "month" };
  return grain === "year" ? { amount: 12, unit: "year" } : { amount: 1, unit: "year" };
}

/**
 * The picker's unsaved choice. Two clicks pick a range, a click on the same
 * unit twice picks that one unit; nothing reaches the screen until Áp dụng.
 * The popover mounts it fresh on every open, so it starts from the value shown.
 */
export function usePeriodDraft(value: PeriodRangeValue): PeriodDraft {
  const [state, setState] = useState<DraftState>(() => fromValue(value));
  const patch = (next: Partial<DraftState>) => setState((current) => ({ ...current, ...next }));

  const setGrain = (grain: PeriodGrain) =>
    // The range keeps its span, squared to whole units of the new grain.
    patch({ grain, from: unitStart(grain, state.from), to: unitEnd(grain, state.to), anchor: null, hovered: null, view: state.from });

  const pick = (date: Dayjs) => {
    if (!state.anchor) {
      patch({ anchor: date, from: unitStart(state.grain, date), to: unitEnd(state.grain, date) });
      return;
    }
    const [first, last] = ordered(state.anchor, date);
    patch({ anchor: null, hovered: null, from: unitStart(state.grain, first), to: unitEnd(state.grain, last) });
  };

  const applyPreset = (preset: PeriodPreset) => {
    const { from, to } = preset.resolve(dayjs().startOf("day"));
    patch({ grain: "day", from, to, anchor: null, hovered: null, view: from });
  };

  const page = (direction: -1 | 1) => {
    const { amount, unit } = pageUnit(state.grain);
    patch({ view: state.view.add(direction * amount, unit) });
  };

  const shown = (() => {
    if (!state.anchor) return { from: state.from, to: state.to };
    const [first, last] = ordered(state.anchor, state.hovered ?? state.anchor);
    return { from: unitStart(state.grain, first), to: unitEnd(state.grain, last) };
  })();

  return {
    grain: state.grain,
    from: state.from,
    to: state.to,
    compare: state.compare,
    view: state.view,
    picking: state.anchor !== null,
    shown,
    setGrain,
    pick,
    hover: (date) => patch({ hovered: date }),
    applyPreset,
    setCompare: (compare) => patch({ compare }),
    page,
    toValue: () => ({
      grain: state.grain,
      from: state.from.format(ISO_DATE),
      // A range still mid-pick applies as the one unit clicked so far.
      to: (state.anchor ? unitEnd(state.grain, state.anchor) : state.to).format(ISO_DATE),
      compare: state.compare,
    }),
  };
}
