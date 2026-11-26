import { useCallback, useMemo } from "react";
import { formatToothCodes } from "@/features/treatment-management/api/consultingApi";
import { formatVND } from "@/utils/format";
import { moneyInWords } from "@/utils/moneyWords";
import { useRecordSetSheetFacts } from "../../../api/medicalRecordSetApi";
import type { FieldValues } from "./fieldValues";
import { FULL_LINE_WIDTH, drawnLetterSize, makeLineSplitter } from "./lineFit";
import { sheetFactFieldValues, treatmentConsentFieldValues, type SheetFactFormats } from "./sheetFacts";

/** Tooth numbers alone, read as the consulting table reads them — a whole jaw by its name. */
export const teethLabel = (toothCodes: readonly number[]) =>
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

export interface SheetFactValues {
  /** The blanks every sheet of the set shares. */
  factValues: FieldValues;
  /** A mẫu 5 copy's own blanks, from the services it picked (`null`: every one). */
  consentValuesOf: (serviceIds: readonly string[] | null) => FieldValues;
}

/**
 * The blanks the open set's treatment slips answer — numbers, dates, doctors,
 * services and the treatment log (save/P1810.drawio). Empty until they arrive,
 * and for a reader the server refuses: the blanks are then left for the pen.
 */
export function useSheetFactValues(setId: string | undefined): SheetFactValues {
  const facts = useRecordSetSheetFacts(setId).data;
  const formats = useMemo<SheetFactFormats>(
    () => ({
      teeth: teethLabel,
      money: formatVND,
      moneyWords: moneyInWords,
      // Mẫu 5 prints at 16px, its letters enlarged (sheetCss, R-1234).
      consentLines: makeLineSplitter(drawnLetterSize(16), FULL_LINE_WIDTH),
    }),
    [],
  );
  const factValues = useMemo(() => sheetFactFieldValues(facts, formats), [facts, formats]);
  const consentValuesOf = useCallback(
    (serviceIds: readonly string[] | null) => treatmentConsentFieldValues(facts, serviceIds, formats),
    [facts, formats],
  );
  return { factValues, consentValuesOf };
}
