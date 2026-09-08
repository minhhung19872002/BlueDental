import { t } from "@/lib/i18n";
import { LOWER_TEETH, TOOTH_SURFACES, UPPER_TEETH, formatToothPick, type ToothPick } from "./toothModel";

/** A whole jaw taken at once. */
export type JawPreset = "upper" | "lower" | "full";

/** The picker's tabs: pick teeth one by one, or take a whole jaw. */
export type ToothPickerTab = "teeth" | JawPreset;

/**
 * What a tooth picker hands back: either individual picks (with surfaces) or
 * a jaw preset. The two are exclusive in the reference — switching to a jaw
 * tab clears the picks, and a jaw shows as one chip ("Hàm trên").
 */
export type ToothPickerValue =
  | { kind: "teeth"; teeth: ToothPick[] }
  | { kind: "jaw"; jaw: JawPreset };

export const EMPTY_TOOTH_VALUE: ToothPickerValue = { kind: "teeth", teeth: [] };

/** Tab captions as the reference capitalises them. */
export const TOOTH_PICKER_TABS: readonly { key: ToothPickerTab; label: () => string }[] = [
  { key: "teeth", label: () => t("Chọn Răng") },
  { key: "upper", label: () => t("Hàm Trên") },
  { key: "lower", label: () => t("Hàm Dưới") },
  { key: "full", label: () => t("Nguyên Hàm") },
];

const JAW_LABELS: Record<JawPreset, () => string> = {
  upper: () => t("Hàm trên"),
  lower: () => t("Hàm dưới"),
  full: () => t("Nguyên hàm"),
};

const JAW_TEETH: Record<JawPreset, readonly number[]> = {
  upper: UPPER_TEETH,
  lower: LOWER_TEETH,
  full: [...UPPER_TEETH, ...LOWER_TEETH],
};

/** The chip caption for a jaw preset: "Hàm trên", "Hàm dưới", "Nguyên hàm". */
export function jawLabel(jaw: JawPreset): string {
  return JAW_LABELS[jaw]();
}

/** The text after "Răng:" on a form, or null when nothing is chosen. */
export function formatToothValue(value: ToothPickerValue): string | null {
  if (value.kind === "jaw") return JAW_LABELS[value.jaw]();
  if (value.teeth.length === 0) return null;
  return value.teeth.map(formatToothPick).join(", ");
}

export function isToothValueEmpty(value: ToothPickerValue): boolean {
  return value.kind === "teeth" && value.teeth.length === 0;
}

/**
 * One tooth plus the surfaces involved, the shape the consulting and
 * treatment APIs both take. `selected` means the whole tooth, no surface.
 */
export interface ToothSelection {
  toothCode: number;
  selected: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  center: boolean;
}

export function toothPickToSelection(pick: ToothPick): ToothSelection {
  return {
    toothCode: pick.fdi,
    selected: pick.surfaces.length === 0,
    top: pick.surfaces.includes("top"),
    right: pick.surfaces.includes("right"),
    bottom: pick.surfaces.includes("bottom"),
    left: pick.surfaces.includes("left"),
    center: pick.surfaces.includes("center"),
  };
}

/** A jaw preset expands to every tooth of that jaw, each taken whole. */
export function toothValueToSelections(value: ToothPickerValue): ToothSelection[] {
  const picks: ToothPick[] =
    value.kind === "jaw" ? JAW_TEETH[value.jaw].map((fdi) => ({ fdi, surfaces: [] })) : value.teeth;
  return picks.map(toothPickToSelection);
}

/**
 * The inverse of toothValueToSelections: rows the API handed back, folded
 * into the picker's value. A complete jaw of whole teeth collapses to that
 * jaw's preset (both jaws to the full one), so a diagnosis saved as "Nguyên
 * hàm" reopens on that tab rather than as thirty-two chips.
 */
export function toothSelectionsToValue(selections: readonly ToothSelection[]): ToothPickerValue {
  const wholeTeeth = new Set(
    selections
      .filter((row) => row.selected || !(row.top || row.right || row.bottom || row.left || row.center))
      .map((row) => row.toothCode),
  );
  const covers = (jaw: readonly number[]) => jaw.every((fdi) => wholeTeeth.has(fdi));

  if (selections.length === wholeTeeth.size) {
    const upper = covers(UPPER_TEETH);
    const lower = covers(LOWER_TEETH);
    if (upper && lower && wholeTeeth.size === UPPER_TEETH.length + LOWER_TEETH.length) {
      return { kind: "jaw", jaw: "full" };
    }
    if (upper && wholeTeeth.size === UPPER_TEETH.length) return { kind: "jaw", jaw: "upper" };
    if (lower && wholeTeeth.size === LOWER_TEETH.length) return { kind: "jaw", jaw: "lower" };
  }

  return {
    kind: "teeth",
    teeth: selections.map((row) => ({
      fdi: row.toothCode,
      surfaces: row.selected ? [] : TOOTH_SURFACES.filter((surface) => row[surface]),
    })),
  };
}
