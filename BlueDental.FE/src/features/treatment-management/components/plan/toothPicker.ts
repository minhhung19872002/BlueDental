import { LOWER_TEETH, UPPER_TEETH, formatToothPick, type ToothPick } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import type { ToothSelectionDto } from "../../api/consultingApi";

export type JawPreset = "upper" | "lower" | "full";

/** The picker's tabs: pick teeth one by one, or take a whole jaw. */
export type ToothPickerTab = "teeth" | JawPreset;

/**
 * What "Chọn răng" hands back: either individual picks (with surfaces) or a
 * jaw preset. The two are exclusive in the reference — switching to a jaw
 * tab clears the picks.
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

/** The text after "Răng:" on the create form, or null when nothing is chosen. */
export function formatToothValue(value: ToothPickerValue): string | null {
  if (value.kind === "jaw") return JAW_LABELS[value.jaw]();
  if (value.teeth.length === 0) return null;
  return value.teeth.map(formatToothPick).join(", ");
}

export function isToothValueEmpty(value: ToothPickerValue): boolean {
  return value.kind === "teeth" && value.teeth.length === 0;
}

function toDto(pick: ToothPick): ToothSelectionDto {
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
export function toothValueToDtos(value: ToothPickerValue): ToothSelectionDto[] {
  const picks: ToothPick[] =
    value.kind === "jaw" ? JAW_TEETH[value.jaw].map((fdi) => ({ fdi, surfaces: [] })) : value.teeth;
  return picks.map(toDto);
}
