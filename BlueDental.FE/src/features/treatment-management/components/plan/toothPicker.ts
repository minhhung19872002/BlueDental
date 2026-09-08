import { toothValueToSelections, type ToothPickerValue } from "@/components/ToothChart";
import type { ToothSelectionDto } from "../../api/consultingApi";

/**
 * The tooth picker model now lives with the shared chart (the consulting form
 * uses the same tabs and chips); this module keeps the plan's own names.
 */
export {
  EMPTY_TOOTH_VALUE,
  TOOTH_PICKER_TABS,
  formatToothValue,
  isToothValueEmpty,
  type JawPreset,
  type ToothPickerTab,
  type ToothPickerValue,
} from "@/components/ToothChart";

/** A jaw preset expands to every tooth of that jaw, each taken whole. */
export function toothValueToDtos(value: ToothPickerValue): ToothSelectionDto[] {
  return toothValueToSelections(value);
}
