import dayjs from "dayjs";
import type {
  Appointment,
  AppointmentColor,
  AppointmentListQuery,
  AppointmentStatus,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from "../types/appointment";
import { statusPaletteOf } from "@/theme/index";
import { DEFAULT_BRANCH_ID } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

/** Exactly what BlueDental.Appointments.AppointmentDto sends. */
export interface ServerAppointmentDto {
  id: string;
  patientId: string;
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
  color: number;
  creationTime: string;
}

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
 * The screens speak in the reference's vocabulary; the server uses its own enum.
 * CheckedIn has no separate colour in the UI palette, so it reads as in progress.
 */
const STATUS_BY_CODE: Record<number, AppointmentStatus> = {
  [SERVER_STATUS.Requested]: "scheduled",
  [SERVER_STATUS.Confirmed]: "confirmed",
  [SERVER_STATUS.CheckedIn]: "inProgress",
  [SERVER_STATUS.InProgress]: "inProgress",
  [SERVER_STATUS.Completed]: "completed",
  [SERVER_STATUS.Cancelled]: "cancelled",
  [SERVER_STATUS.NoShow]: "noShow",
};

const CODE_BY_STATUS: Record<AppointmentStatus, number> = {
  scheduled: SERVER_STATUS.Requested,
  confirmed: SERVER_STATUS.Confirmed,
  inProgress: SERVER_STATUS.InProgress,
  completed: SERVER_STATUS.Completed,
  cancelled: SERVER_STATUS.Cancelled,
  noShow: SERVER_STATUS.NoShow,
};

const statusLabels = (): Record<AppointmentStatus, string> => ({
  scheduled: t("Đã đặt lịch"),
  confirmed: t("Đã xác nhận"),
  inProgress: t("Đang khám"),
  completed: t("Hoàn thành"),
  cancelled: t("Đã hủy"),
  noShow: t("Không đến"),
});

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: statusPaletteOf().scheduled.color,
  confirmed: statusPaletteOf().confirmed.color,
  inProgress: statusPaletteOf().inProgress.color,
  completed: statusPaletteOf().completed.color,
  cancelled: statusPaletteOf().cancelled.color,
  noShow: statusPaletteOf().noShow.color,
};

/** BlueDental.Appointments.AppointmentType — Examination is the everyday one. */
const DEFAULT_APPOINTMENT_TYPE = 2;

/** Matches BlueDental.Appointments.AppointmentColor. */
const SERVER_COLOR: Record<AppointmentColor, number> = {
  default: 1,
  green: 2,
  orange: 3,
  red: 4,
};

const COLOR_BY_CODE: Record<number, AppointmentColor> = {
  1: "default",
  2: "green",
  3: "orange",
  4: "red",
};

export function adaptAppointment(dto: ServerAppointmentDto): Appointment {
  const status = STATUS_BY_CODE[dto.status] ?? "scheduled";

  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName,
    patientPhone: dto.patientPhone ?? "",
    doctorId: dto.dentistId,
    doctorName: dto.dentistName,
    startTime: dto.slotStart,
    endTime: dto.slotEnd,
    status,
    reason: dto.chiefComplaint,
    notes: dto.notes,
    color: COLOR_BY_CODE[dto.color] ?? "default",
    createdAt: dto.creationTime,
    statusColor: STATUS_COLORS[status],
    statusLabel: statusLabels()[status],
    durationMinutes: dayjs(dto.slotEnd).diff(dayjs(dto.slotStart), "minute"),
  };
}

export function toServerQuery(query: AppointmentListQuery): Record<string, unknown> {
  return {
    patientId: query.patientId,
    dentistId: query.doctorId,
    date: query.date,
    fromDate: query.fromDate,
    toDate: query.toDate,
    status: query.status ? CODE_BY_STATUS[query.status] : undefined,
    filter: query.filter || undefined,
    skipCount: query.skipCount,
    maxResultCount: query.maxResultCount,
  };
}

/**
 * The form works in local wall-clock time, but PostgreSQL only accepts a UTC
 * instant — sending "2026-08-23T09:00:00" made Npgsql refuse the +07:00 offset.
 */
function toInstant(value?: string): string | undefined {
  return value ? dayjs(value).toISOString() : undefined;
}

export function toCreateRequest(request: CreateAppointmentRequest): Record<string, unknown> {
  return {
    patientId: request.patientId,
    dentistId: request.doctorId,
    branchId: request.branchId ?? DEFAULT_BRANCH_ID,
    slotStart: toInstant(request.startTime),
    slotEnd: toInstant(request.endTime),
    type: DEFAULT_APPOINTMENT_TYPE,
    chiefComplaint: request.reason,
    notes: request.notes,
    color: SERVER_COLOR[request.color ?? "default"],
  };
}

export function toUpdateRequest(request: UpdateAppointmentRequest): Record<string, unknown> {
  return {
    slotStart: toInstant(request.startTime),
    slotEnd: toInstant(request.endTime),
    dentistId: request.doctorId,
    chiefComplaint: request.reason,
    notes: request.notes,
    color: SERVER_COLOR[request.color ?? "default"],
  };
}
