import { useMemo } from "react";
import type { PrescriptionLine } from "@/components/prescription-lines";
import { CATALOG_GROUP, useCatalogOptions, type CatalogOption } from "@/hooks/useCatalogOptions";
import { findAllergyConflicts, type AllergyConflict } from "../utils/allergyConflicts";

/**
 * The medicines on the slip that fall under an allergy the patient declared
 * in Tiểu sử bệnh — recomputed as each line's medicine is picked.
 */
export function usePrescriptionAllergyConflicts(
  diseaseHistoryEntryIds: string[],
  lines: PrescriptionLine[],
  medicines: CatalogOption[],
): AllergyConflict[] {
  const diseases = useCatalogOptions(CATALOG_GROUP.DiseaseHistory).data;

  return useMemo(() => {
    const history = (diseases ?? []).filter((entry) => diseaseHistoryEntryIds.includes(entry.id));
    const picked = lines
      .map((line) => medicines.find((medicine) => medicine.id === line.medicineEntryId))
      .filter((medicine): medicine is CatalogOption => medicine !== undefined);
    return findAllergyConflicts(history, picked);
  }, [diseases, diseaseHistoryEntryIds, lines, medicines]);
}
