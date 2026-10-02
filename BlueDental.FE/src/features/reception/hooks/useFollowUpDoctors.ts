import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { useAvailableReceptionDoctors, useReceptionDoctors } from "../api/receptionQueries";
import type { FollowUpPicker } from "./useFollowUpPicker";

/**
 * The follow-up's doctor choices. Until a day is picked every doctor is
 * offered; once it is, only those not registered OFF that day on Chấm công
 * (BA 2026-10-02), and a chosen doctor who is off there is cleared.
 */
export function useFollowUpDoctors(picker: FollowUpPicker, branchId: string | undefined) {
  const { doctorId, setDoctorId } = picker;
  const day = picker.selectedDay?.format("YYYY-MM-DD");
  const allQuery = useReceptionDoctors(branchId);
  const dayQuery = useAvailableReceptionDoctors(branchId, day);
  const [offError, setOffError] = useState<string | null>(null);

  const list = day ? dayQuery.data : allQuery.data;
  const options = useMemo(() => (list ?? []).map((d) => ({ value: d.id, label: d.name })), [list]);

  const daySettled = Boolean(day) && dayQuery.isSuccess && !dayQuery.isFetching;
  const doctorIsOff = daySettled && Boolean(doctorId) && !options.some((o) => o.value === doctorId);

  useEffect(() => {
    if (!doctorIsOff) return;
    setDoctorId(undefined);
    setOffError(t("Appointment:Form:DoctorOffOnDate"));
  }, [doctorIsOff, setDoctorId]);

  useEffect(() => {
    if (doctorId) setOffError(null);
  }, [doctorId]);

  return { options, offError };
}
