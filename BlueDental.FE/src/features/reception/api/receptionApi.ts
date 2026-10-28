import dayjs from "dayjs";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type {
  AppointmentCounterType,
  AppointmentOutcome,
  BookFollowUpInput,
  BookedOutcome,
  BusySpan,
  DoctorWorkDay,
  MinuteSpan,
  RebookUndatedInput,
  CreateReceptionInput,
  ReceptionCounters,
  ReceptionDoctorTeam,
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

/**
 * What each tab lists. The second tab is "Đã đến": arrived and not yet seen
 * (owner 2026-10-27, R-1047) — a booking not yet arrived is no longer in it.
 */
const TAB_STATUSES: Record<Exclude<ReceptionStatus, "All">, number[]> = {
  WaitingForExam: [SERVER_STATUS.CheckedIn],
  InProgress: [SERVER_STATUS.InProgress],
  Completed: [SERVER_STATUS.Completed],
};

interface CounterQuery {
  statuses?: number[];
  isLate?: boolean;
  isTemporary?: boolean;
  isRevisit?: boolean;
  isRescheduled?: boolean;
}

/**
 * What each counter lists. Đã hẹn, Đã đến, Huỷ hẹn and Trễ hẹn split the board
 * between them, so they add up to Tất cả: a booking past its start time with
 * no arrival is Trễ hẹn, not Đã hẹn. Lịch tạm, Đã hẹn tái khám (closed with
 * Hẹn tái khám, R-1039) and Đổi lịch hẹn (P2710_01) cut across them.
 */
const COUNTER_QUERIES: Record<keyof ReceptionCounters, CounterQuery> = {
  scheduledCount: { statuses: [SERVER_STATUS.Requested, SERVER_STATUS.Confirmed], isLate: false },
  arrivedCount: { statuses: [SERVER_STATUS.CheckedIn, SERVER_STATUS.InProgress, SERVER_STATUS.Completed] },
  cancelledCount: { statuses: [SERVER_STATUS.Cancelled] },
  lateCount: { isLate: true },
  temporaryCount: { isTemporary: true },
  revisitCount: { isRevisit: true },
  rescheduledCount: { isRescheduled: true },
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
  patientTagIds: string[] | null;
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
    patientTagIds: dto.patientTagIds ?? [],
    patientType: "New",
    doctorId: dto.dentistId ?? "",
    doctorName: dto.dentistName || t("Reception:Doctor"),
    branchId: dto.branchId,
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
        dentistIds: filter.doctorIds,
        doctorTeamId: filter.doctorTeamId,
        statuses: counterQuery.statuses,
        isLate: counterQuery.isLate,
        isTemporary: counterQuery.isTemporary,
        isRevisit: counterQuery.isRevisit,
        isRescheduled: counterQuery.isRescheduled,
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
      params: { ...dateWindow(filter), dentistIds: filter.doctorIds, doctorTeamId: filter.doctorTeamId },
    });
    const stats = res.data ?? {};

    const booked = (stats.requested ?? 0) + (stats.confirmed ?? 0);
    const overdue = stats.overdue ?? 0;
    const arrived = (stats.checkedIn ?? 0) + (stats.inProgress ?? 0) + (stats.completed ?? 0);
    const scheduled = booked - overdue;
    const late = (stats.noShow ?? 0) + overdue;

    return {
      totalCount: scheduled + arrived + (stats.cancelled ?? 0) + late,
      waitingCount: stats.checkedIn ?? 0,
      inProgressCount: stats.inProgress ?? 0,
      completedCount: stats.completed ?? 0,
      counters: {
        scheduledCount: scheduled,
        arrivedCount: arrived,
        cancelledCount: stats.cancelled ?? 0,
        lateCount: late,
        temporaryCount: stats.temporary ?? 0,
        revisitCount: stats.revisit ?? 0,
        rescheduledCount: stats.rescheduled ?? 0,
      },
    };
  },

  /** The org chart's doctor teams the board can filter by. */
  async getDoctorTeams(): Promise<ReceptionDoctorTeam[]> {
    const res = await api.get<ReceptionDoctorTeam[]>(`${APPT_BASE}/doctor-teams`);
    return res.data ?? [];
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
      chiefComplaint: input.content,
      notes: input.notes,
      allowDentistOverlap: input.allowDentistOverlap,
    });
    return mapAppointmentDto(res.data as ServerAppointmentDto);
  },

  async updateStatus(
    id: string,
    action: "check-in" | "start" | "complete" | "undo-check-in",
    outcome?: NonNullable<AppointmentOutcome>,
  ): Promise<void> {
    // `complete` binds a required body; it carries no `notes`, so the server
    // keeps the Ghi chú written at booking (R-1038).
    const body = outcome ? { outcome: OUTCOME_TO_SERVER[outcome] } : undefined;
    await api.post(`${APPT_BASE}/${id}/${action}`, action === "complete" ? (body ?? {}) : body);
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

  /** A doctor's working hours day by day at the current branch, inclusive. */
  async getDentistWorkDays(dentistId: string, fromDate: string, toDate: string): Promise<DoctorWorkDay[]> {
    const res = await api.get<ServerWorkDayDto[]>(`${APPT_BASE}/dentist-work-days`, {
      params: { dentistId, fromDate, toDate },
    });
    return res.data.map(adaptWorkDay);
  },
};

interface ServerShiftWindowDto {
  /** "HH:mm:ss" on the clinic's wall clock. */
  start: string;
  end: string;
}

interface ServerWorkDayDto {
  date: string;
  morning: ServerShiftWindowDto;
  afternoon: ServerShiftWindowDto;
  windows: ServerShiftWindowDto[];
}

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

const adaptWindow = (w: ServerShiftWindowDto): MinuteSpan => ({ start: toMinutes(w.start), end: toMinutes(w.end) });

function adaptWorkDay(dto: ServerWorkDayDto): DoctorWorkDay {
  return {
    date: dto.date,
    morning: adaptWindow(dto.morning),
    afternoon: adaptWindow(dto.afternoon),
    windows: dto.windows.map(adaptWindow),
  };
}
