import { api } from "@/lib/axios";
import type {
  ReceptionItem,
  ReceptionFilter,
  ReceptionMetrics,
  CreateReceptionInput,
  ReceptionStatus,
} from "../types/reception";

export const MOCK_PATIENTS = [
  { id: "pat-001", code: "DH26001", name: "Nguyễn Văn An", phone: "0912345678" },
  { id: "pat-002", code: "DH26002", name: "Trần Thị Mai", phone: "0987654321" },
  { id: "pat-003", code: "DH26003", name: "Lê Hoàng Nam", phone: "0903112233" },
  { id: "pat-004", code: "DH26004", name: "Phạm Hồng Dung", phone: "0977889900" },
  { id: "pat-005", code: "DH26005", name: "Vũ Quốc Anh", phone: "0944556677" },
  { id: "pat-006", code: "DH26006", name: "Cao Thị Thanh Tuyết", phone: "0901234567" },
  { id: "pat-007", code: "DH26007", name: "Lê Thị Liên", phone: "0933445566" },
  { id: "pat-008", code: "DH26008", name: "Đặng Hoàng Nghi Dung", phone: "0966778899" },
  { id: "pat-009", code: "DH26009", name: "Phan Hải Bình", phone: "0955667788" },
  { id: "pat-010", code: "DH26010", name: "Trần Cao Phong", phone: "0944332211" },
  { id: "pat-011", code: "DH26011", name: "Mai Thị Thu Thủy", phone: "0922113344" },
  { id: "pat-012", code: "DH26012", name: "Trần Quế Chi", phone: "0911223344" },
];

const INITIAL_MOCK_RECEPTIONS: ReceptionItem[] = [
  {
    id: "rec-001",
    voucherCode: "TN-20260821-01",
    patientId: "pat-001",
    patientName: "Nguyễn Văn An",
    patientYearOfBirth: 1990,
    patientPhone: "0912345678",
    patientType: "New",
    doctorId: "doc-001",
    doctorName: "BS. Trần Minh Tuấn",
    adviseDoctorName: "BS. Lê Thị Hoa",
    refType: "Medical",
    status: "WaitingForExam",
    counterStatus: "Arrived",
    appointmentTime: "08:00",
    step1Time: "08:15",
    totalDue: 1500000,
    expectedRevenue: 1500000,
    services: ["Khám tổng quát", "Chụp phim X-quang Pano"],
    notes: "Bệnh nhân đau răng số 36 nhẹ",
    arrivalTime: "08:15",
    createdAt: "2026-08-21T08:15:00Z",
  },
  {
    id: "rec-002",
    voucherCode: "TN-20260821-02",
    patientId: "pat-002",
    patientName: "Trần Thị Mai",
    patientYearOfBirth: 1985,
    patientPhone: "0987654321",
    patientType: "Returning",
    doctorId: "doc-002",
    doctorName: "BS. Nguyễn Văn Hùng",
    adviseDoctorName: "NV. Phạm Thị Hương",
    refType: "Self",
    status: "InProgress",
    counterStatus: "Arrived",
    appointmentTime: "08:30",
    step1Time: "08:45",
    step2Time: "09:00",
    selectedOutcome: "EndTreatment",
    totalDue: 4500000,
    expectedRevenue: 5000000,
    services: ["Tẩy trắng răng Laser", "Cạo vôi răng hai hàm"],
    notes: "Lịch hẹn tái khám 6 tháng",
    arrivalTime: "08:45",
    createdAt: "2026-08-21T08:45:00Z",
  },
  {
    id: "rec-003",
    voucherCode: "TN-20260821-03",
    patientId: "pat-003",
    patientName: "Lê Hoàng Nam",
    patientYearOfBirth: 1995,
    patientPhone: "0903112233",
    patientType: "New",
    doctorId: "doc-001",
    doctorName: "BS. Trần Minh Tuấn",
    adviseDoctorName: "BS. Trần Minh Tuấn",
    refType: "Marketing",
    status: "Completed",
    counterStatus: "Converted",
    appointmentTime: "09:00",
    step1Time: "09:05",
    step2Time: "09:20",
    step3Time: "10:30",
    selectedOutcome: "FollowUp",
    totalDue: 12000000,
    expectedRevenue: 12000000,
    services: ["Trám răng Composite 2 răng", "Gắn mão sứ Zirconia"],
    notes: "Đã thanh toán đủ, hẹn lắp mão ngày 25/08",
    arrivalTime: "09:00",
    createdAt: "2026-08-21T09:00:00Z",
  },
  {
    id: "rec-004",
    voucherCode: "TN-20260821-04",
    patientId: "pat-004",
    patientName: "Phạm Hồng Dung",
    patientYearOfBirth: 2000,
    patientPhone: "0977889900",
    patientType: "Returning",
    doctorId: "doc-003",
    doctorName: "BS. Đặng Thu Hà",
    adviseDoctorName: "NV. Lê Thanh",
    refType: "Self",
    status: "WaitingForExam",
    counterStatus: "Late",
    appointmentTime: "09:00",
    totalDue: 800000,
    expectedRevenue: 800000,
    services: ["Chăm sóc định kỳ niềng răng"],
    notes: "Thay thun chỉnh nha định kỳ",
    arrivalTime: "09:30",
    createdAt: "2026-08-21T09:30:00Z",
  },
  {
    id: "rec-005",
    voucherCode: "TN-20260821-05",
    patientId: "pat-005",
    patientName: "Vũ Quốc Anh",
    patientYearOfBirth: 1988,
    patientPhone: "0944556677",
    patientType: "New",
    doctorId: "doc-002",
    doctorName: "BS. Nguyễn Văn Hùng",
    adviseDoctorName: "BS. Nguyễn Văn Hùng",
    refType: "Referral",
    status: "InProgress",
    counterStatus: "Arrived",
    appointmentTime: "10:00",
    step1Time: "10:05",
    totalDue: 25000000,
    expectedRevenue: 30000000,
    services: ["Cấy ghép Implant Straumann - Trụ 1"],
    notes: "Khách hàng ưu tiên phòng VIP 1",
    arrivalTime: "10:00",
    createdAt: "2026-08-21T10:00:00Z",
  },
];

let localReceptionsStore = [...INITIAL_MOCK_RECEPTIONS];

export const MOCK_DOCTORS = [
  { id: "doc-001", name: "BS. Trần Minh Tuấn", title: "Bác sĩ Chỉnh nha" },
  { id: "doc-002", name: "BS. Nguyễn Văn Hùng", title: "Bác sĩ Phục hình & Implant" },
  { id: "doc-003", name: "BS. Đặng Thu Hà", title: "Bác sĩ Nha khoa Tổng quát" },
];

export const receptionApi = {
  async getList(filter: ReceptionFilter = {}): Promise<{
    items: ReceptionItem[];
    total: number;
  }> {
    try {
      const res = await api.get("/v1/app/visits", {
        params: {
          keyword: filter.keyword,
          dentistId: filter.doctorId,
          status: filter.status !== "All" ? filter.status : undefined,
          maxResultCount: 50,
        },
      });

      if (res.data?.items && Array.isArray(res.data.items) && res.data.items.length > 0) {
        const mappedItems: ReceptionItem[] = res.data.items.map((dto: Record<string, unknown>) => ({
          id: dto.id as string,
          voucherCode: `TN-${(dto.id as string).slice(0, 8).toUpperCase()}`,
          patientId: dto.patientId as string,
          patientName: (dto.patientName as string) || "Bệnh nhân",
          patientPhone: (dto.patientPhone as string) || "0900000000",
          patientType: "New" as const,
          doctorId: dto.dentistId as string,
          doctorName: (dto.dentistName as string) || "Bác sĩ",
          refType: "Medical" as const,
          status: dto.status === 3 ? "WaitingForExam" as const
            : dto.status === 4 ? "InProgress" as const
            : dto.status === 5 ? "Completed" as const
            : "WaitingForExam" as const,
          totalDue: 0,
          expectedRevenue: 0,
          services: [(dto.procedureName as string) || "Khám tư vấn"],
          notes: (dto.notes as string) || (dto.chiefComplaint as string),
          arrivalTime: new Date(dto.slotStart as string).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          createdAt: (dto.creationTime as string) || new Date().toISOString(),
        }));
        return { items: mappedItems, total: res.data.totalCount as number };
      }
    } catch {
      // Failover to local store in dev mode
    }

    let result = [...localReceptionsStore];

    if (filter.status && filter.status !== "All") {
      result = result.filter((item) => item.status === filter.status);
    }

    if (filter.doctorId) {
      result = result.filter((item) => item.doctorId === filter.doctorId);
    }

    if (filter.keyword) {
      const kw = filter.keyword.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.patientName.toLowerCase().includes(kw) ||
          item.patientPhone.includes(kw) ||
          item.voucherCode.toLowerCase().includes(kw),
      );
    }

    return {
      items: result,
      total: result.length,
    };
  },

  async getMetrics(): Promise<ReceptionMetrics> {
    const store = localReceptionsStore;
    const waitingCount = store.filter((i) => i.status === "WaitingForExam").length;
    const inProgressCount = store.filter((i) => i.status === "InProgress").length;
    const completedCount = store.filter((i) => i.status === "Completed").length;

    return {
      totalCount: store.length,
      waitingCount,
      inProgressCount,
      completedCount,
      counters: {
        scheduledCount: 12,
        arrivedCount: store.length,
        cancelledCount: 1,
        lateCount: 0,
        temporaryCount: 0,
        convertedCount: 0,
      },
    };
  },

  async create(input: CreateReceptionInput): Promise<ReceptionItem> {
    try {
      await api.post("/v1/app/visits", {
        patientId: "00000000-0000-0000-0000-000000000001",
        dentistId: input.doctorId,
        branchId: "00000000-0000-0000-0000-000000000001",
        scheduledAt: new Date().toISOString(),
        chiefComplaint: input.notes,
      });
    } catch {
      // Failover to local store creation
    }

    const doc = MOCK_DOCTORS.find((d) => d.id === input.doctorId);
    const newId = `rec-${Date.now().toString().slice(-4)}`;
    const newItem: ReceptionItem = {
      id: newId,
      voucherCode: `TN-20260821-${(localReceptionsStore.length + 1)
        .toString()
        .padStart(2, "0")}`,
      patientId: `pat-${Date.now().toString().slice(-4)}`,
      patientName: input.patientName,
      patientPhone: input.phoneNumber,
      patientType: "New",
      doctorId: input.doctorId,
      doctorName: doc ? doc.name : "BS. Chưa phân công",
      adviseDoctorName: doc ? doc.name : undefined,
      refType: input.refType,
      status: "WaitingForExam",
      totalDue: 0,
      expectedRevenue: 0,
      services: input.services && input.services.length > 0 ? input.services : ["Khám tư vấn"],
      notes: input.notes,
      arrivalTime: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAt: new Date().toISOString(),
    };

    localReceptionsStore = [newItem, ...localReceptionsStore];
    return newItem;
  },

  async updateStatus(
    id: string,
    status: ReceptionStatus,
  ): Promise<ReceptionItem> {
    try {
      const action = status === "InProgress" ? "start" : status === "Completed" ? "complete" : "check-in";
      await api.post(`/v1/app/visits/${id}/${action}`);
    } catch {
      // Failover to local store update
    }

    const idx = localReceptionsStore.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new Error("Không tìm thấy hồ sơ tiếp nhận");
    }
    localReceptionsStore[idx] = {
      ...localReceptionsStore[idx],
      status,
    };
    return localReceptionsStore[idx];
  },
};
