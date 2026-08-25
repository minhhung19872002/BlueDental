import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type {
  AppointmentCounterType,
  AppointmentOutcome,
  CreateReceptionInput,
  ReceptionFilter,
  ReceptionItem,
  ReceptionMetrics,
  ReceptionStatus,
} from "../types/reception";

/** VisitStatus on the server. */
const VISIT_STATUS = {
  Scheduled: 1,
  CheckedIn: 2,
  InProgress: 3,
  Completed: 4,
  Cancelled: 5,
  NoShow: 6,
} as const;

/**
 * The board groups the visit states into its three tabs: anyone booked or
 * through the door but not yet in the chair is waiting, the chair is in
 * progress, and the rest is done.
 */
const TAB_STATUSES: Record<Exclude<ReceptionStatus, "All">, number[]> = {
  WaitingForExam: [VISIT_STATUS.Scheduled, VISIT_STATUS.CheckedIn],
  InProgress: [VISIT_STATUS.InProgress],
  Completed: [VISIT_STATUS.Completed],
};

function mapStatusFromBe(beStatus: unknown): ReceptionStatus {
  switch (beStatus) {
    case VISIT_STATUS.InProgress: return "InProgress";
    case VISIT_STATUS.Completed: return "Completed";
    default: return "WaitingForExam";
  }
}

function mapStatusToBe(status: ReceptionStatus): string {
  switch (status) {
    case "InProgress": return "start";
    case "Completed": return "complete";
    default: return "check-in";
  }
}

/**
 * VisitOutcome crosses the wire as its numeric value, so it is mapped back to
 * the names the reception buttons use. Order matches the enum on the server.
 */
const OUTCOME_BY_VALUE: Record<number, AppointmentOutcome> = {
  1: "EndTreatment",
  2: "FollowUp",
  3: "TransferDoctor",
  4: "Revisit",
};

function mapOutcome(raw: unknown): AppointmentOutcome {
  if (typeof raw === "number") return OUTCOME_BY_VALUE[raw] ?? null;
  if (typeof raw === "string") return (raw as AppointmentOutcome) ?? null;
  return null;
}

/**
 * The half-open window the board is asking for. A day, a week and a month all
 * become the same from/to pair, which is what the server filters on.
 */
function dateWindow(filter: ReceptionFilter): { fromDate?: string; toDate?: string } {
  if (!filter.date) return {};

  const unit = filter.viewMode === "week" ? "week" : filter.viewMode === "month" ? "month" : "day";
  const start = dayjs(filter.date).startOf(unit);

  return {
    fromDate: start.toISOString(),
    toDate: start.add(1, unit).toISOString(),
  };
}

/**
 * The six counters the board draws are the reference's, and a visit has seven
 * states; this is how they line up. Anything still waiting is "đã hẹn", anyone
 * through the door is "đã đến" whatever stage they are at, and a no-show sits
 * with the late ones because that is the counter the board offers.
 */
const COUNTER_BY_VISIT_STATUS: Record<number, AppointmentCounterType> = {
  1: "Scheduled",
  2: "Arrived",
  3: "Arrived",
  4: "Arrived",
  5: "Cancelled",
  6: "Late",
};

function mapCounterStatus(raw: unknown): AppointmentCounterType | undefined {
  return typeof raw === "number" ? COUNTER_BY_VISIT_STATUS[raw] : undefined;
}

function mapVisitDto(dto: Record<string, unknown>): ReceptionItem {
  return {
    id: dto.id as string,
    voucherCode: `TN-${(dto.id as string).slice(0, 8).toUpperCase()}`,
    patientId: (dto.patientId as string) ?? "",
    patientName: (dto.patientName as string) || "Bệnh nhân",
    patientPhone: ((dto.patientPhone as string) || ""),
    patientType: "New",
    doctorId: (dto.dentistId as string) ?? "",
    doctorName: (dto.dentistName as string) || "Bác sĩ",
    refType: "Medical",
    status: mapStatusFromBe(dto.status),
    counterStatus: mapCounterStatus(dto.status),
    totalDue: 0,
    expectedRevenue: 0,
    // A visit records why the patient came, not a service line — there is no
    // procedure on this contract, so the column used to print the same
    // invented "Khám tư vấn" on every row.
    services: dto.chiefComplaint ? [dto.chiefComplaint as string] : [],
    notes: (dto.notes as string) || undefined,
    // The instant, not a clock face: every reader formats it themselves. It
    // reads `scheduledAt` because `slotStart` belongs to the appointment
    // contract and was never on this response.
    arrivalTime: ((dto.scheduledAt as string) ?? (dto.checkedInAt as string) ?? ""),
    createdAt: (dto.creationTime as string) || new Date().toISOString(),
    // The server stores the outcome as its enum name, which is the same set of
    // values the reception buttons use.
    selectedOutcome: mapOutcome(dto.outcome),
  };
}

export const receptionApi = {
  async getList(filter: ReceptionFilter = {}): Promise<{ items: ReceptionItem[]; total: number }> {
    const res = await api.get("/v1/app/visits", {
      params: {
        keyword: filter.keyword,
        dentistId: filter.doctorId,
        statuses: filter.status && filter.status !== "All" ? TAB_STATUSES[filter.status] : undefined,
        maxResultCount: 50,
        ...dateWindow(filter),
      },
    });
    const items: ReceptionItem[] = (res.data?.items ?? []).map(mapVisitDto);
    return { items, total: res.data?.totalCount ?? items.length };
  },

  async getMetrics(filter: ReceptionFilter = {}): Promise<ReceptionMetrics> {
    // The server counts the same window the list is showing. This used to page
    // the rows back and call every one of them arrived.
    const res = await api.get("/v1/app/visits/stats", {
      params: dateWindow(filter),
    });
    const stats = res.data ?? {};

    return {
      totalCount: stats.total ?? 0,
      waitingCount: (stats.scheduled ?? 0) + (stats.checkedIn ?? 0),
      inProgressCount: stats.inProgress ?? 0,
      completedCount: stats.completed ?? 0,
      counters: {
        scheduledCount: stats.scheduled ?? 0,
        arrivedCount: (stats.checkedIn ?? 0) + (stats.inProgress ?? 0) + (stats.completed ?? 0),
        cancelledCount: stats.cancelled ?? 0,
        lateCount: stats.noShow ?? 0,
        temporaryCount: 0,
        convertedCount: 0,
      },
    };
  },

  async create(input: CreateReceptionInput & { branchId: string }): Promise<ReceptionItem> {
    const res = await api.post("/v1/app/visits", {
      patientId: input.patientId ?? null,
      dentistId: input.doctorId,
      branchId: input.branchId,
      scheduledAt: new Date().toISOString(),
      chiefComplaint: input.notes,
    });
    return mapVisitDto(res.data as Record<string, unknown>);
  },

  async updateStatus(id: string, status: ReceptionStatus): Promise<ReceptionItem> {
    const action = mapStatusToBe(status);
    const res = await api.post(`/v1/app/visits/${id}/${action}`);
    return mapVisitDto(res.data as Record<string, unknown>);
  },

  /**
   * Recording an outcome is a workflow step, not an edit of the booking: the
   * update endpoint refuses anything past Scheduled, and never carried an
   * outcome field to begin with.
   */
  async updateOutcome(id: string, outcome: string): Promise<void> {
    await api.post(`/v1/app/visits/${id}/outcome`, { outcome });
  },

  async updateDoctor(id: string, doctorId: string): Promise<void> {
    await api.put(`/v1/app/visits/${id}`, { dentistId: doctorId });
  },
};
