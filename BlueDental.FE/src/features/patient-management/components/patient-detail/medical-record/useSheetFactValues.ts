import { useMemo } from "react";
import { formatToothCodes } from "@/features/treatment-management/api/consultingApi";
import { formatVND } from "@/utils/format";
import { moneyInWords } from "@/utils/moneyWords";
import { useRecordSetSheetFacts } from "../../../api/medicalRecordSetApi";
import type { FieldValues } from "./fieldValues";
import { FULL_LINE_WIDTH, makeLineSplitter } from "./lineFit";
import { sheetFactFieldValues, type SheetFactFormats } from "./sheetFacts";

/** Tooth numbers alone, read as the consulting table reads them — a whole jaw by its name. */
const teethLabel = (toothCodes: readonly number[]) =>
  formatToothCodes(
    toothCodes.map((toothCode) => ({
      toothCode,
      selected: true,
      top: false,
      right: false,
      bottom: false,
      left: false,
      center: false,
    })),
  );

/**
 * The blanks the open set's treatment slips answer — numbers, dates, doctors,
 * services and the treatment log (save/P1810.drawio). Empty until they arrive,
 * and for a reader the server refuses: the blanks are then left for the pen.
 */
export function useSheetFactValues(setId: string | undefined): FieldValues {
  const facts = useRecordSetSheetFacts(setId).data;
  const formats = useMemo<SheetFactFormats>(
    () => ({
      teeth: teethLabel,
      money: formatVND,
      moneyWords: moneyInWords,
      // Mẫu 5 prints at 16px (sheetCss).
      consentLines: makeLineSplitter(16, FULL_LINE_WIDTH),
    }),
    [],
  );
  return useMemo(() => sheetFactFieldValues(facts, formats), [facts, formats]);
}
