export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "inProgress"
  | "completed"
  | "cancelled"
  | "noShow";

/**
 * "Màu lịch hẹn" — the four swatches the booking dialog offers.
 *
 * The server stores the colour as a free string, so the swatch key is what
 * travels: it round-trips unchanged and reads for itself in the database. A
 * colour outside this set is still accepted on the wire and falls back to
 * "default" when drawn.
 */
export type AppointmentColor = "default" | "green" | "orange" | "red";

/**
 * What the screens work with. The server speaks its own shape
 * (DentistId / SlotStart / numeric status); see appointmentAdapters.
 */
export interface AppointmentDto {
  id: string;
  patientId: string;
  patientCode: string | null;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  color: string | null;
  createdAt: string;
  isTemporary: boolean;
  sourceTaxonomyId: string | null;
  sourceEntryId: string | null;
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
  color?: string;
}

export interface UpdateAppointmentRequest {
  patientId?: string;
  doctorId?: string;
  branchId?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  notes?: string;
  color?: string;
  status?: AppointmentStatus;
  patientName?: string;
  patientPhone?: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
}

export interface AppointmentListQuery {
  date?: string;
  /** Inclusive range, for the week and month grids. */
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  /** Free text over patient, dentist, reason and notes — matched server-side. */
  filter?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface CreateTempAppointmentRequest {
  patientName: string;
  patientPhone?: string;
  doctorId?: string;
  branchId: string;
  startTime: string;
  endTime: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  color?: string;
  notes?: string;
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
