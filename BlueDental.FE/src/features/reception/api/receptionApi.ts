import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type {
  AppointmentCounterType,
  AppointmentOutcome,
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

const COUNTER_STATUSES: Record<keyof ReceptionCounters, number[]> = {
  scheduledCount: [SERVER_STATUS.Requested, SERVER_STATUS.Confirmed],
  arrivedCount: [SERVER_STATUS.CheckedIn, SERVER_STATUS.InProgress, SERVER_STATUS.Completed],
  cancelledCount: [SERVER_STATUS.Cancelled],
  lateCount: [SERVER_STATUS.NoShow],
  temporaryCount: [],
  convertedCount: [],
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
  outcome: number | null;
  patientYearOfBirth: number | null;
}

function mapAppointmentDto(dto: ServerAppointmentDto): ReceptionItem {
  const counterStatus: AppointmentCounterType | undefined =
    dto.isTemporary ? "Temporary" : COUNTER_BY_STATUS[dto.status];

  return {
    id: dto.id,
    voucherCode: dto.patientCode || `TN-${dto.id.slice(0, 8).toUpperCase()}`,
    patientId: dto.patientId ?? "",
    patientName: dto.patientName || "Bệnh nhân",
    patientPhone: dto.patientPhone ?? "",
    patientYearOfBirth: dto.patientYearOfBirth ?? undefined,
    patientType: "New",
    doctorId: dto.dentistId ?? "",
    doctorName: dto.dentistName || "Bác sĩ",
    refType: "Medical",
    status: mapStatusFromBe(dto.status),
    counterStatus,
    totalDue: 0,
    expectedRevenue: 0,
    services: dto.chiefComplaint ? [dto.chiefComplaint] : [],
    notes: dto.notes || undefined,
    arrivalTime: dto.slotStart ?? "",
    appointmentTime: dto.slotStart ? dayjs(dto.slotStart).format("HH:mm") : undefined,
    step1Time: formatStepTime(dto.checkedInAt),
    step2Time: formatStepTime(dto.startedAt),
    step3Time: formatStepTime(dto.completedAt),
    createdAt: dto.creationTime || new Date().toISOString(),
    selectedOutcome: dto.outcome ? (OUTCOME_MAP[dto.outcome] ?? null) : null,
    isTemporary: dto.isTemporary,
    color: dto.color,
  };
}

export const receptionApi = {
  async getList(
    filter: ReceptionFilter = {},
    skipCount = 0,
    maxResultCount = 20,
  ): Promise<{ items: ReceptionItem[]; total: number }> {
    let statuses: number[] | undefined;
    let isTemporary: boolean | undefined;

    if (filter.counterFilter) {
      if (filter.counterFilter === "temporaryCount") {
        isTemporary = true;
      } else {
        const mapped = COUNTER_STATUSES[filter.counterFilter];
        if (mapped.length > 0) statuses = mapped;
      }
    } else if (filter.status && filter.status !== "All") {
      statuses = TAB_STATUSES[filter.status];
    }

    const res = await api.get(APPT_BASE, {
      params: {
        filter: filter.keyword,
        dentistId: filter.doctorId,
        statuses,
        isTemporary,
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

    const scheduled = (stats.requested ?? 0) + (stats.confirmed ?? 0);
    const arrived = (stats.checkedIn ?? 0) + (stats.inProgress ?? 0) + (stats.completed ?? 0);

    return {
      totalCount: scheduled + arrived + (stats.cancelled ?? 0) + (stats.noShow ?? 0),
      waitingCount: scheduled + (stats.checkedIn ?? 0),
      inProgressCount: stats.inProgress ?? 0,
      completedCount: stats.completed ?? 0,
      counters: {
        scheduledCount: scheduled,
        arrivedCount: arrived,
        cancelledCount: stats.cancelled ?? 0,
        lateCount: stats.noShow ?? 0,
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

  async updateStatus(id: string, action: "check-in" | "start" | "complete"): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/${action}`, action === "complete" ? { notes: null } : undefined);
  },

  async cancel(id: string, _reason: string): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/cancel`, { reason: 1, note: _reason });
  },

  async assignDentist(id: string, dentistId: string): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/assign-dentist`, { dentistId });
  },

  async setOutcome(id: string, outcome: NonNullable<AppointmentOutcome>): Promise<void> {
    await api.post(`${APPT_BASE}/${id}/set-outcome`, { outcome: OUTCOME_TO_SERVER[outcome] });
  },
};
