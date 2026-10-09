import dayjs from "dayjs";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type {
  AppointmentCounterType,
  AppointmentOutcome,
  BookFollowUpInput,
  BookedOutcome,
  BusySpan,
  RebookUndatedInput,
  CreateReceptionInput,
  ReceptionCounters,
  ReceptionFilter,
  ReceptionItem,
  ReceptionMetrics,
  ReceptionStatus,
} from "../types/reception";

const APPT_BASE = "/v1/app/appointments";

/** Matches BlueDental.Appointments.AppointmentStatus. */
const SERVER_STATUS = {
  Requested: 1,
  Confirmed: 2,
  CheckedIn: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 6,
  NoShow: 7,
} as const;

const TAB_STATUSES: Record<Exclude<ReceptionStatus, "All">, number[]> = {
  WaitingForExam: [SERVER_STATUS.Requested, SERVER_STATUS.Confirmed, SERVER_STATUS.CheckedIn],
  InProgress: [SERVER_STATUS.InProgress],
  Completed: [SERVER_STATUS.Completed],
};

interface CounterQuery {
  statuses?: number[];
  isLate?: boolean;
  isTemporary?: boolean;
}

/**
 * What each chip lists. Đã hẹn, Đã đến, Huỷ hẹn and Trễ hẹn split the board
 * between them, so they add up to Tất cả: a booking past its start time with
 * no arrival is Trễ hẹn, not Đã hẹn. Lịch tạm cuts across them.
 */
const COUNTER_QUERIES: Record<keyof ReceptionCounters, CounterQuery> = {
  scheduledCount: { statuses: [SERVER_STATUS.Requested, SERVER_STATUS.Confirmed], isLate: false },
  arrivedCount: { statuses: [SERVER_STATUS.CheckedIn, SERVER_STATUS.InProgress, SERVER_STATUS.Completed] },
  cancelledCount: { statuses: [SERVER_STATUS.Cancelled] },
  lateCount: { isLate: true },
  temporaryCount: { isTemporary: true },
  convertedCount: {},
};

function mapStatusFromBe(beStatus: number): ReceptionStatus {
  switch (beStatus) {
    case SERVER_STATUS.InProgress: return "InProgress";
    case SERVER_STATUS.Completed: return "Completed";
    default: return "WaitingForExam";
  }
}

const COUNTER_BY_STATUS: Record<number, AppointmentCounterType> = {
  [SERVER_STATUS.Requested]: "Scheduled",
  [SERVER_STATUS.Confirmed]: "Scheduled",
  [SERVER_STATUS.CheckedIn]: "Arrived",
  [SERVER_STATUS.InProgress]: "Arrived",
  [SERVER_STATUS.Completed]: "Arrived",
  [SERVER_STATUS.Cancelled]: "Cancelled",
  [SERVER_STATUS.NoShow]: "Late",
};

function formatStepTime(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  const d = dayjs(iso);
  return d.isValid() ? d.format("HH:mm") : undefined;
}

function dateWindow(filter: ReceptionFilter): { fromDate?: string; toDate?: string } {
  if (!filter.date) return {};

  const unit = filter.viewMode === "week" ? "week" : filter.viewMode === "month" ? "month" : "day";
  const start = dayjs(filter.date).startOf(unit);

  return {
    fromDate: start.format("YYYY-MM-DD"),
    toDate: start.add(1, unit).subtract(1, "day").format("YYYY-MM-DD"),
  };
}

const OUTCOME_MAP: Record<number, NonNullable<AppointmentOutcome>> = {
  1: "EndTreatment",
  2: "FollowUp",
  3: "TransferDoctor",
  4: "Revisit",
};

const OUTCOME_TO_SERVER: Record<NonNullable<AppointmentOutcome>, number> = {
  EndTreatment: 1,
  FollowUp: 2,
  TransferDoctor: 3,
  Revisit: 4,
};

interface ServerAppointmentDto {
  id: string;
  patientId: string;
  patientCode: string | null;
  patientName: string;
  patientPhone: string | null;
  dentistId: string;
  dentistName: string;
  branchId: string;
  procedureId: string | null;
  procedureName: string | null;
  slotStart: string;
  slotEnd: string;
  status: number;
  type: number;
  chiefComplaint: string | null;
  notes: string | null;
  color: string | null;
  creationTime: string;
  isTemporary: boolean;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  outcome: number | null;
  followUpAt: string | null;
  patientYearOfBirth: number | null;
}

/** The statuses that hold a doctor's time: everything but cancelled and no-show. */
const BUSY_STATUSES = [
  SERVER_STATUS.Requested,
  SERVER_STATUS.Confirmed,
  SERVER_STATUS.CheckedIn,
  SERVER_STATUS.InProgress,
  SERVER_STATUS.Completed,
];

/** Past its start time and still only booked — the server's `isLate` rule for a booking not yet marked Trễ hẹn. */
function isLateAppointment(dto: ServerAppointmentDto): boolean {
  const isWaiting =
    dto.status === SERVER_STATUS.Requested ||
    dto.status === SERVER_STATUS.Confirmed;
  if (!isWaiting) return false;
  if (dto.checkedInAt) return false;
  if (!dto.slotStart) return false;
  return dayjs(dto.slotStart).isBefore(dayjs());
}

function mapAppointmentDto(dto: ServerAppointmentDto): ReceptionItem {
  const timeLate = isLateAppointment(dto);
  const visitStatus: AppointmentCounterType | undefined =
    timeLate ? "Late" : COUNTER_BY_STATUS[dto.status];
  const counterStatus = !timeLate && dto.isTemporary ? "Temporary" : visitStatus;

  return {
    id: dto.id,
    voucherCode: dto.patientCode || `TN-${dto.id.slice(0, 8).toUpperCase()}`,
    patientId: dto.patientId ?? "",
    patientName: dto.patientName || t("Common:Patient"),
    patientPhone: dto.patientPhone ?? "",
    patientYearOfBirth: dto.patientYearOfBirth ?? undefined,
    patientType: "New",
    doctorId: dto.dentistId ?? "",
    doctorName: dto.dentistName || t("Reception:Doctor"),
    refType: "Medical",
    status: mapStatusFromBe(dto.status),
    counterStatus,
    visitStatus,
    totalDue: 0,
    expectedRevenue: 0,
    services: dto.chiefComplaint ? [dto.chiefComplaint] : [],
    notes: dto.notes || undefined,
    arrivalTime: dto.slotStart ?? "",
    appointmentTime: dto.slotStart ? dayjs(dto.slotStart).format("HH:mm") : undefined,
    step1Time: formatStepTime(dto.checkedInAt),
    step2Time: formatStepTime(dto.startedAt),
    step3Time: formatStepTime(dto.completedAt),
    checkedInAt: dto.checkedInAt ?? undefined,
    startedAt: dto.startedAt ?? undefined,
    cancelTime: formatStepTime(dto.cancelledAt),
    createdAt: dto.creationTime || new Date().toISOString(),
    selectedOutcome: dto.outcome ? (OUTCOME_MAP[dto.outcome] ?? null) : null,
    followUpAt: dto.followUpAt ?? undefined,
    isTemporary: dto.isTemporary,
    isTimeLate: timeLate,
    color: dto.color,
  };
}

export const receptionApi = {
  async getList(
    filter: ReceptionFilter = {},
    skipCount = 0,
    maxResultCount = 20,
  ): Promise<{ items: ReceptionItem[]; total: number }> {
    const counterQuery: CounterQuery = filter.counterFilter
      ? COUNTER_QUERIES[filter.counterFilter]
      : { statuses: filter.status && filter.status !== "All" ? TAB_STATUSES[filter.status] : undefined };

    const res = await api.get(APPT_BASE, {
      params: {
        filter: filter.keyword,
        dentistId: filter.doctorId,
        statuses: counterQuery.statuses,
        isLate: counterQuery.isLate,
        isTemporary: counterQuery.isTemporary,
        skipCount,
        maxResultCount,
        ...dateWindow(filter),
      },
    });
    const items: ReceptionItem[] = (res.data?.items ?? []).map(
      (dto: ServerAppointmentDto) => mapAppointmentDto(dto),
    );

    return { items, total: res.data?.totalCount ?? items.length };
  },

  async getMetrics(filter: ReceptionFilter = {}): Promise<ReceptionMetrics> {
    const res = await api.get(`${APPT_BASE}/stats`, {
      params: { ...dateWindow(filter), dentistId: filter.doctorId },
    });
    const stats = res.data ?? {};

    const booked = (stats.requested ?? 0) + (stats.confirmed ?? 0);
    const overdue = stats.overdue ?? 0;
    const arrived = (stats.checkedIn ?? 0) + (stats.inProgress ?? 0) + (stats.completed ?? 0);
    const scheduled = booked - overdue;
    const late = (stats.noShow ?? 0) + overdue;

    return {
      totalCount: scheduled + arrived + (stats.cancelled ?? 0) + late,
      waitingCount: booked + (stats.checkedIn ?? 0),
      inProgressCount: stats.inProgress ?? 0,
      completedCount: stats.completed ?? 0,
      counters: {
        scheduledCount: scheduled,
        arrivedCount: arrived,
        cancelledCount: stats.cancelled ?? 0,
        lateCount: late,
        temporaryCount: stats.temporary ?? 0,
        convertedCount: 0,
      },
    };
  },

  async create(input: CreateReceptionInput & { branchId: string }): Promise<ReceptionItem> {
    const now = input.scheduledAt ? dayjs(input.scheduledAt) : dayjs();
    const duration = input.estimatedDurationMinutes ?? 30;
    const slotStart = now.toISOString();
    const slotEnd = now.add(duration, "minute").toISOString();

    const res = await api.post(APPT_BASE, {
      patientId: input.patientId,
      dentistId: input.doctorId,
      branchId: input.branchId,
      slotStart,
      slotEnd,
      type: 2,
      chiefComplaint: input.notes,
    });
    return mapAppointmentDto(res.data as ServerAppointmentDto);
  },

  async updateStatus(
    id: string,
    action: "check-in" | "start" | "complete",
    outcome?: NonNullable<AppointmentOutcome>,
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (action === "complete") body.notes = null;
    if (outcome) body.outcome = OUTCOME_TO_SERVER[outcome];
    await api.post(`${APPT_BASE}/${id}/${action}`, Object.keys(body).length ? body : undefined);
  },

  async cancel(id: string, _reason: string): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/cancel`, { reason: 1, note: _reason });
  },

  async assignDentist(id: string, dentistId: string): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/assign-dentist`, { dentistId });
  },

  /** A "Lịch tạm" becomes the appointment of the patient record created for it. */
  async attachPatient(id: string, patientId: string): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/attach-patient`, { patientId });
  },

  async setOutcome(id: string, outcome: NonNullable<AppointmentOutcome>): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/set-outcome`, { outcome: OUTCOME_TO_SERVER[outcome] });
  },

  async bookFollowUp(id: string, input: BookFollowUpInput, outcome: BookedOutcome): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/follow-up`, { ...input, outcome: OUTCOME_TO_SERVER[outcome] });
  },

  async rebookUndated(id: string, input: RebookUndatedInput, outcome: BookedOutcome): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/rebook-undated`, { ...input, outcome: OUTCOME_TO_SERVER[outcome] });
  },

  /** What a doctor is already booked for between two calendar days, inclusive. */
  async getDentistBusySpans(dentistId: string, fromDate: string, toDate: string): Promise<BusySpan[]> {
    const res = await api.get(APPT_BASE, {
      params: { dentistId, fromDate, toDate, statuses: BUSY_STATUSES },
    });
    // "Hẹn tái khám" frees the slot like a cancellation (BA); the server agrees.
    return (res.data?.items ?? [])
      .filter((dto: ServerAppointmentDto) => dto.outcome !== OUTCOME_TO_SERVER.Revisit)
      .map((dto: ServerAppointmentDto) => ({
        start: dayjs(dto.slotStart).valueOf(),
        end: dayjs(dto.slotEnd).valueOf(),
      }));
  },
};
