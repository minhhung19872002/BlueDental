import { api } from "@/lib/axios";
import type {
  ReceptionItem,
  ReceptionFilter,
  ReceptionMetrics,
  CreateReceptionInput,
  ReceptionStatus,
} from "../types/reception";

const INITIAL_MOCK_RECEPTIONS: ReceptionItem[] = [
  {
    id: "rec-001",
    voucherCode: "TN-20260821-01",
    patientId: "pat-001",
    patientName: "Nguyễn Văn An",
    patientPhone: "0912345678",
    patientType: "New",
    doctorId: "doc-001",
    doctorName: "BS. Trần Minh Tuấn",
    adviseDoctorName: "BS. Lê Thị Hoa",
    refType: "Medical",
    status: "Arrived",
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
    patientPhone: "0987654321",
    patientType: "Returning",
    doctorId: "doc-002",
    doctorName: "BS. Nguyễn Văn Hùng",
    adviseDoctorName: "NV. Phạm Thị Hương",
    refType: "Self",
    status: "InProgress",
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
    patientPhone: "0903112233",
    patientType: "New",
    doctorId: "doc-001",
    doctorName: "BS. Trần Minh Tuấn",
    adviseDoctorName: "BS. Trần Minh Tuấn",
    refType: "Marketing",
    status: "Completed",
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
    patientPhone: "0977889900",
    patientType: "Returning",
    doctorId: "doc-003",
    doctorName: "BS. Đặng Thu Hà",
    adviseDoctorName: "NV. Lê Thanh",
    refType: "Self",
    status: "Arrived",
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
    patientPhone: "0944556677",
    patientType: "New",
    doctorId: "doc-002",
    doctorName: "BS. Nguyễn Văn Hùng",
    adviseDoctorName: "BS. Nguyễn Văn Hùng",
    refType: "Referral",
    status: "InProgress",
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
      // Attempt backend API fetch
      const res = await api.get("/v1/app/appointments", {
        params: {
          filter: filter.keyword,
          dentistId: filter.doctorId,
        },
      });

      if (res.data?.items && Array.isArray(res.data.items) && res.data.items.length > 0) {
        const mappedItems: ReceptionItem[] = res.data.items.map((dto: any) => ({
          id: dto.id,
          voucherCode: `TN-${dto.id.slice(0, 8).toUpperCase()}`,
          patientId: dto.patientId,
          patientName: dto.patientName || "Bệnh nhân",
          patientPhone: dto.patientPhone || "0900000000",
          patientType: "New",
          doctorId: dto.dentistId,
          doctorName: dto.dentistName || "Bác sĩ",
          refType: "Medical",
          status: dto.status === 3 ? "Arrived" : dto.status === 4 ? "InProgress" : dto.status === 5 ? "Completed" : "Arrived",
          totalDue: 0,
          expectedRevenue: 0,
          services: [dto.procedureName || "Khám tư vấn"],
          notes: dto.notes || dto.chiefComplaint,
          arrivalTime: new Date(dto.slotStart).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          createdAt: dto.creationTime || new Date().toISOString(),
        }));
        return { items: mappedItems, total: res.data.totalCount };
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
    const totalCount = localReceptionsStore.length;
    const newPatientsCount = localReceptionsStore.filter(
      (i) => i.patientType === "New",
    ).length;
    const oldPatientsCount = localReceptionsStore.filter(
      (i) => i.patientType === "Returning",
    ).length;
    const arrivedCount = localReceptionsStore.filter(
      (i) => i.status === "Arrived",
    ).length;
    const inProgressCount = localReceptionsStore.filter(
      (i) => i.status === "InProgress",
    ).length;
    const completedCount = localReceptionsStore.filter(
      (i) => i.status === "Completed",
    ).length;

    return {
      totalCount,
      newPatientsCount,
      oldPatientsCount,
      scheduledCount: 12,
      cancelledCount: 1,
      arrivedCount,
      inProgressCount,
      completedCount,
    };
  },

  async create(input: CreateReceptionInput): Promise<ReceptionItem> {
    try {
      await api.post("/v1/app/appointments", {
        patientId: "00000000-0000-0000-0000-000000000001",
        dentistId: input.doctorId,
        branchId: "00000000-0000-0000-0000-000000000001",
        slotStart: new Date().toISOString(),
        slotEnd: new Date(Date.now() + 3600000).toISOString(),
        type: 1,
        chiefComplaint: input.notes,
      });
    } catch {
      // Failover to local store creation in dev mode
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
      status: "Arrived",
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
      await api.post(`/v1/app/appointments/${id}/${action}`);
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
