export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "inProgress"
  | "completed"
  | "cancelled"
  | "noShow";

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
