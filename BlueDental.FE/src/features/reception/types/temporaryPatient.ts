import type { PatientPrefill } from "@/features/patient-management/types/patient";

/** The "Lịch tạm" a "Tạo hồ sơ" dialog makes the record for, and what it fills in. */
export interface TemporaryPatientTarget {
  appointmentId: string;
  prefill: PatientPrefill;
}
