import type { AppointmentStatus } from "./appointment";

/** What the booking dialog's form holds, for creating and for editing alike. */
export interface AppointmentEditorValues {
  patientId: string;
  branchId: string;
  doctorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  content: string;
  color: string;
  notes: string;
  /** Trạng thái — shown while editing only; a new booking is always Đã hẹn. */
  status: AppointmentStatus;
}
