import { useMemo } from "react";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import type { PatientDiagnosisDto } from "../../api/consultingApi";

/**
 * The consultants "Chọn dịch vụ" offers: every staff member, plus the slip's
 * own doctors when they have since left the list, so their names still show.
 */
export function useAdviseStaff(diagnosis: PatientDiagnosisDto) {
  const allStaff = useStaffOptions();
  return useMemo(() => {
    const options = [...(allStaff.data ?? [])];
    const known = new Set(options.map((option) => option.value));
    if (diagnosis.staffId && !known.has(diagnosis.staffId)) {
      options.push({ value: diagnosis.staffId, label: diagnosis.staffName ?? "" });
    }
    if (diagnosis.secondStaffId && !known.has(diagnosis.secondStaffId)) {
      options.push({ value: diagnosis.secondStaffId, label: diagnosis.secondStaffName ?? "" });
    }
    return options;
  }, [allStaff.data, diagnosis]);
}
