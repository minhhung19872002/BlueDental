import { api } from "@/lib/axios";
import { DEFAULT_BRANCH_ID } from "@/lib/clinicBranch";
import { splitVietnameseName } from "@/utils/vietnameseName";
import { t } from "@/lib/i18n";
import type {
  CreateReceptionInput,
  ReceptionFilter,
  ReceptionItem,
  ReceptionMetrics,
  ReceptionStatus,
} from "../types/reception";

/** Matches BlueDental.Visits.VisitStatus. */
const VISIT_STATUS = {
  Scheduled: 1,
  CheckedIn: 2,
  InProgress: 3,
  Completed: 4,
  Cancelled: 5,
  NoShow: 6,
} as const;

/** What the server sends for one reception. */
interface VisitDto {
  id: string;
  patientId: string;
  branchId: string;
  dentistId: string | null;
  status: number;
  chiefComplaint: string | null;
  notes: string | null;
  scheduledAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
  patientName: string | null;
  dentistName: string | null;
  creationTime: string;
}

interface VisitStatsDto {
  total: number;
  scheduled: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

/**
 * The reception board groups Scheduled and CheckedIn together as "chờ khám" —
 * both mean the patient is waiting for a dentist.
 */
function toReceptionStatus(status: number): ReceptionStatus {
  switch (status) {
    case VISIT_STATUS.InProgress:
      return "InProgress";
    case VISIT_STATUS.Completed:
      return "Completed";
    default:
      return "WaitingForExam";
  }
}

function toVisitStatus(status?: ReceptionStatus): number | undefined {
  switch (status) {
    case "InProgress":
      return VISIT_STATUS.InProgress;
    case "Completed":
      return VISIT_STATUS.Completed;
    case "WaitingForExam":
      return VISIT_STATUS.CheckedIn;
    default:
      return undefined;
  }
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function adaptVisit(dto: VisitDto): ReceptionItem {
  return {
    id: dto.id,
    voucherCode: `TN-${dto.id.slice(0, 8).toUpperCase()}`,
    patientId: dto.patientId,
    patientName: dto.patientName ?? t("Bệnh nhân"),
    patientPhone: "",
    patientType: "New",
    doctorId: dto.dentistId ?? "",
    doctorName: dto.dentistName ?? t("Chưa phân công"),
    refType: "Medical",
    status: toReceptionStatus(dto.status),
    totalDue: 0,
    expectedRevenue: 0,
    services: dto.chiefComplaint ? [dto.chiefComplaint] : [t("Khám tư vấn")],
    notes: dto.notes ?? dto.chiefComplaint ?? undefined,
    arrivalTime: formatTime(dto.checkedInAt ?? dto.scheduledAt),
    createdAt: dto.creationTime,
  };
}

const VISITS = "/v1/app/visits";

/** A walk-in with no record yet gets one before the visit is opened. */
async function registerWalkIn(input: CreateReceptionInput): Promise<string> {
  const { firstName, lastName } = splitVietnameseName(input.patientName);

  const patient = await api
    .post<{ id: string }>("/v1/app/patients", {
      firstName,
      lastName,
      dateOfBirth: input.dateOfBirth ?? "1990-01-01",
      gender: "Other",
      phoneNumber: input.phoneNumber || undefined,
      branchId: DEFAULT_BRANCH_ID,
    })
    .then((r) => r.data);

  return patient.id;
}

/**
 * Tiếp nhận. Every call goes to the real API — the screen used to fall back to a
 * local store, which made it look like it worked while nothing was persisted.
 */
export const receptionApi = {
  async getList(filter: ReceptionFilter = {}): Promise<{ items: ReceptionItem[]; total: number }> {
    const page = await api
      .get<{ items: VisitDto[]; totalCount: number }>(VISITS, {
        params: {
          branchId: DEFAULT_BRANCH_ID,
          filter: filter.keyword,
          status: toVisitStatus(filter.status),
          maxResultCount: 50,
        },
      })
      .then((r) => r.data);

    // The dentist filter is not a server filter yet, so it narrows what loaded.
    const items = page.items
      .map(adaptVisit)
      .filter((item) => !filter.doctorId || item.doctorId === filter.doctorId);

    return { items, total: page.totalCount };
  },

  async getMetrics(): Promise<ReceptionMetrics> {
    const stats = await api
      .get<VisitStatsDto>(`${VISITS}/stats`, { params: { branchId: DEFAULT_BRANCH_ID } })
      .then((r) => r.data);

    return {
      totalCount: stats.total,
      waitingCount: stats.scheduled + stats.checkedIn,
      inProgressCount: stats.inProgress,
      completedCount: stats.completed,
      counters: {
        scheduledCount: stats.scheduled,
        arrivedCount: stats.checkedIn + stats.inProgress + stats.completed,
        cancelledCount: stats.cancelled,
        lateCount: stats.noShow,
        temporaryCount: 0,
        convertedCount: 0,
      },
    };
  },

  /**
   * Receiving a patient registers them first — a reception is always about a
   * patient record, so one is created when the walk-in has none yet.
   */
  async create(input: CreateReceptionInput): Promise<ReceptionItem> {
    const patientId = input.patientId ?? (await registerWalkIn(input));

    const visit = await api
      .post<VisitDto>(VISITS, {
        patientId,
        branchId: DEFAULT_BRANCH_ID,
        dentistId: input.doctorId || undefined,
        scheduledAt: new Date().toISOString(),
        chiefComplaint: input.services?.[0] ?? input.notes,
      })
      .then((r) => r.data);

    // A walk-in is already here, so the visit is checked in straight away.
    await api.post(`${VISITS}/${visit.id}/check-in`);

    return adaptVisit({ ...visit, status: VISIT_STATUS.CheckedIn });
  },

  async updateStatus(id: string, status: ReceptionStatus): Promise<ReceptionItem> {
    const action =
      status === "InProgress" ? "start" : status === "Completed" ? "complete" : "check-in";

    await api.post(`${VISITS}/${id}/${action}`);

    const visit = await api.get<VisitDto>(`${VISITS}/${id}`).then((r) => r.data);
    return adaptVisit(visit);
  },
};
