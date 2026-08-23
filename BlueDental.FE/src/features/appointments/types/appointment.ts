export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "inProgress"
  | "completed"
  | "cancelled"
  | "noShow";

/**
 * What the screens work with. The server speaks its own shape
 * (DentistId / SlotStart / numeric status); see appointmentAdapters.
 */
export interface AppointmentDto {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  patientId: string;
  doctorId: string;
  /** Defaults to the current clinic branch. */
  branchId?: string;
  startTime: string;
  endTime: string;
  reason?: string;
  notes?: string;
}

export type UpdateAppointmentRequest = Partial<CreateAppointmentRequest> & {
  status?: AppointmentStatus;
};

export interface AppointmentListQuery {
  date?: string;
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  skipCount?: number;
  maxResultCount?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

/** Client-enriched appointment */
export interface Appointment extends AppointmentDto {
  statusColor: string;
  statusLabel: string;
  durationMinutes: number;
}

/** Matches BlueDental.Appointments.CancellationReason. */
export const CANCELLATION_REASON = {
  PatientRequest: 1,
  DentistUnavailable: 2,
  EquipmentFailure: 3,
  EmergencyPriority: 4,
  PatientNoResponse: 5,
  Other: 6,
} as const;
export type CancellationReason =
  (typeof CANCELLATION_REASON)[keyof typeof CANCELLATION_REASON];
