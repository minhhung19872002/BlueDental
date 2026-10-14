import { useCallback, useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { formatToothCodes, DIAGNOSIS_STATUS } from "@/features/treatment-management/api/consultingApi";
import { usePatientDiagnoses } from "@/features/treatment-management/api/consultingQueries";
import { useAbility } from "@/hooks/useAbility";
import type { SheetDiagnosis } from "./fieldValues";

/** Far more than one patient's diagnoses; the list answers newest first. */
const DIAGNOSIS_LIMIT = 200;

interface DatedDiagnosis extends SheetDiagnosis {
  createdAt: Dayjs;
}

/**
 * The patient's diagnoses — from Chẩn đoán & Tư vấn — as the sheets print them.
 *
 * A dated form gets the diagnoses made from its day on, which is how the
 * reference queries them (`patientDiagnoses?fromDate=`, read off its bundle —
 * see docs/clone/unknowns.md). A form whose day has none, or that has no day,
 * gets every diagnosis that was not cancelled, oldest first. Without
 * treatmentDiagnosis.read the server refuses the list, and the blanks stay
 * empty for the pen.
 */
export function useSheetDiagnoses(patientId: string, branchId: string) {
  const canRead = useAbility("treatmentDiagnosis").canRead;
  const query = usePatientDiagnoses(
    { patientId, clinicBranchId: branchId || undefined, skipCount: 0, maxResultCount: DIAGNOSIS_LIMIT },
    canRead,
  );

  const diagnoses = useMemo<DatedDiagnosis[]>(
    () =>
      (query.data?.items ?? [])
        .filter((item) => item.status !== DIAGNOSIS_STATUS.Cancelled && item.diagnosisName)
        .map((item) => ({
          name: item.diagnosisName ?? "",
          teeth: formatToothCodes(item.teeth),
          createdAt: dayjs(item.creationTime),
        }))
        .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf()),
    [query.data],
  );

  return useCallback(
    (fromDate?: Dayjs): SheetDiagnosis[] => {
      if (!fromDate) return diagnoses;
      const start = fromDate.startOf("day");
      const sinceThatDay = diagnoses.filter((item) => !item.createdAt.isBefore(start));
      return sinceThatDay.length > 0 ? sinceThatDay : diagnoses;
    },
    [diagnoses],
  );
}
