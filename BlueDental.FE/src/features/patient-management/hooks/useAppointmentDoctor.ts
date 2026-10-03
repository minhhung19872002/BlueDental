import { useMemo } from "react";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { SERVER_STATUS } from "@/features/appointments/api/appointmentAdapters";
import type { Appointment } from "@/features/appointments/types/appointment";
import { todayIsoDate } from "@/utils/todayIsoDate";
import type { DiagnosisOption } from "../components/patient-detail/DiagnosisDoctorFields";

/** Statuses of a patient who never came: their doctor is no one's to diagnose with. */
const NOT_SEEN: readonly number[] = [SERVER_STATUS.Cancelled, SERVER_STATUS.NoShow];
/** Statuses of a patient who is in the clinic right now. */
const IN_CLINIC: readonly number[] = [SERVER_STATUS.CheckedIn, SERVER_STATUS.InProgress];

/**
 * Of today's visits, the one being seen: the patient already in the clinic,
 * otherwise the booking closest to now.
 */
function pickVisit(items: Appointment[], now: number): Appointment | undefined {
  const live = items.filter((item) => item.doctorId && !NOT_SEEN.includes(item.statusCode));
  const distance = (item: Appointment) => Math.abs(new Date(item.startTime).getTime() - now);
  const byDistance = [...live].sort((a, b) => distance(a) - distance(b));
  return byDistance.find((item) => IN_CLINIC.includes(item.statusCode)) ?? byDistance[0];
}

/**
 * The doctor on today's appointment — the one the Tiếp nhận card shows — which
 * "Tạo chẩn đoán" offers as its diagnosing doctor (BA request, 2026-10-03).
 * No appointment today, no doctor: the field stays blank as before.
 */
export function useAppointmentDoctor(patientId: string): DiagnosisOption | null {
  const { data } = useAppointmentList({ patientId, date: todayIsoDate(), maxResultCount: 20 });

  return useMemo(() => {
    const visit = pickVisit(data?.items ?? [], Date.now());
    return visit ? { value: visit.doctorId, label: visit.doctorName } : null;
  }, [data]);
}
