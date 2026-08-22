import { api } from "@/lib/axios";
import type {
  ReceptionItem,
  ReceptionFilter,
  ReceptionMetrics,
  CreateReceptionInput,
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

  async create(input: CreateReceptionInput): Promise<ReceptionItem> {
    const res = await api.post("/v1/app/visits", {
      patientId: input.patientId ?? "00000000-0000-0000-0000-000000000001",
      dentistId: input.doctorId,
      branchId: "00000000-0000-0000-0000-000000000001",
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

  async updateOutcome(id: string, outcome: string): Promise<void> {
    await api.put(`/v1/app/visits/${id}`, { outcome });
  },

  async updateDoctor(id: string, doctorId: string): Promise<void> {
    await api.put(`/v1/app/visits/${id}`, { dentistId: doctorId });
  },
};
