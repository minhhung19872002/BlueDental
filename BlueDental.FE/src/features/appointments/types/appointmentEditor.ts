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
  /** Ghi chú — no longer on the form (R-1055): only carried so an edit keeps an older booking's note. */
  notes: string;
  /** Trạng thái — shown while editing only; a new booking is always Đã hẹn. */
  status: AppointmentStatus;
  /** Lý do hủy — required when the save cancels the booking. */
  cancelNote: string;
}
