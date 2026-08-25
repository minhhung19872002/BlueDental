import { api } from "@/lib/axios";
import type {
  AppointmentOutcome,
  CreateReceptionInput,
  ReceptionFilter,
  ReceptionItem,
  ReceptionMetrics,
  ReceptionStatus,
} from "../types/reception";

function mapStatusFromBe(beStatus: unknown): ReceptionStatus {
  switch (beStatus) {
    case 3: return "WaitingForExam";
    case 4: return "InProgress";
    case 5: return "Completed";
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
    totalDue: 0,
    expectedRevenue: 0,
    services: [(dto.procedureName as string) || "Khám tư vấn"],
    notes: (dto.notes as string) || (dto.chiefComplaint as string) || undefined,
    arrivalTime: dto.slotStart
      ? new Date(dto.slotStart as string).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
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
        status: filter.status !== "All" ? filter.status : undefined,
        maxResultCount: 50,
      },
    });
    const items: ReceptionItem[] = (res.data?.items ?? []).map(mapVisitDto);
    return { items, total: res.data?.totalCount ?? items.length };
  },

  async getMetrics(): Promise<ReceptionMetrics> {
    const res = await api.get("/v1/app/visits", { params: { maxResultCount: 200 } });
    const items: ReceptionItem[] = (res.data?.items ?? []).map(mapVisitDto);
    return {
      totalCount: res.data?.totalCount ?? items.length,
      waitingCount: items.filter((i) => i.status === "WaitingForExam").length,
      inProgressCount: items.filter((i) => i.status === "InProgress").length,
      completedCount: items.filter((i) => i.status === "Completed").length,
      counters: {
        scheduledCount: 0,
        arrivedCount: items.length,
        cancelledCount: 0,
        lateCount: 0,
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
