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

/** The outcomes saved only together with a booked next appointment. */
export type BookedOutcome = Extract<AppointmentOutcome, "FollowUp" | "Revisit">;

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
  /**
   * The visit's own status, ignoring "Lịch tạm": the card shows that one next
   * to the ticket and flags a temporary booking with a tab of its own.
   */
  visitStatus?: AppointmentCounterType;
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
  /** ISO instants behind step 1 and step 2: the wait clock runs between them. */
  checkedInAt?: string;
  startedAt?: string;
  /** HH:mm the visit was cancelled — the red last step of the bar. */
  cancelTime?: string;
  selectedOutcome?: AppointmentOutcome;
  /** ISO instant of the appointment booked through "Đã hẹn tiếp". */
  followUpAt?: string;
  createdAt: string;
  isTemporary?: boolean;
  /** True when "Late" badge is derived from time, not from backend NoShow status. */
  isTimeLate?: boolean;
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

/** "Đã hẹn tiếp": the next appointment, booked from the card. */
export interface BookFollowUpInput {
  slotStart: string;
  slotEnd: string;
  /** Left out, the follow-up goes to the card's own doctor. */
  dentistId?: string;
  chiefComplaint?: string;
}

/** A span a doctor is already booked for, as epoch milliseconds. */
export interface BusySpan {
  start: number;
  end: number;
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
