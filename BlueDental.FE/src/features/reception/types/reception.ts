export type ReceptionStatus =
  | "All"
  | "WaitingForExam"
  | "InProgress"
  | "Completed";

export type AppointmentCounterType =
  | "Scheduled"
  | "Arrived"
  | "Cancelled"
  | "Late"
  | "Temporary"
  | "Converted";

export type PatientType = "New" | "Returning";

export type RefType = "Medical" | "Self" | "Referral" | "Marketing";

export type AppointmentOutcome =
  | "EndTreatment"
  | "FollowUp"
  | "TransferDoctor"
  | "Revisit"
  | null;

export interface ReceptionItem {
  id: string;
  voucherCode: string;
  patientId: string;
  patientName: string;
  patientYearOfBirth?: number;
  patientPhone: string;
  patientType: PatientType;
  doctorId: string;
  doctorName: string;
  adviseDoctorName?: string;
  refType: RefType;
  status: ReceptionStatus;
  counterStatus?: AppointmentCounterType;
  totalDue: number;
  expectedRevenue: number;
  services: string[];
  notes?: string;
  appointmentTime?: string;
  /** ISO instant. Callers format it; see `clockOf` in ReceptionGrid. */
  arrivalTime: string;
  step1Time?: string;
  step2Time?: string;
  step3Time?: string;
  selectedOutcome?: AppointmentOutcome;
  createdAt: string;
  isTemporary?: boolean;
  color?: string | null;
}

export interface ReceptionFilter {
  status?: ReceptionStatus;
  counterFilter?: keyof ReceptionCounters;
  keyword?: string;
  doctorId?: string;
  branchId?: string;
  date?: string;
  /** Which window around `date` the board is showing. Defaults to one day. */
  viewMode?: "day" | "week" | "month";
  page?: number;
  pageSize?: number;
}

export interface ReceptionCounters {
  scheduledCount: number;
  arrivedCount: number;
  cancelledCount: number;
  lateCount: number;
  temporaryCount: number;
  convertedCount: number;
}

export interface ReceptionMetrics {
  totalCount: number;
  waitingCount: number;
  inProgressCount: number;
  completedCount: number;
  newPatientsCount?: number;
  oldPatientsCount?: number;
  scheduledCount?: number;
  arrivedCount?: number;
  counters: ReceptionCounters;
}

export interface CreateReceptionInput {
  patientId?: string;
  patientName: string;
  phoneNumber: string;
  dateOfBirth?: string;
  doctorId: string;
  refType: RefType;
  notes?: string;
  services?: string[];
  scheduledAt?: string;
  estimatedDurationMinutes?: number;
  overrideBranchId?: string;
}
