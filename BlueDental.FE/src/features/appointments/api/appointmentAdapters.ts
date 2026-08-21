import dayjs from "dayjs";
import type { Appointment, AppointmentDto, AppointmentStatus } from "../types/appointment";
import { statusPalette } from "@/theme/index";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Đã đặt lịch",
  confirmed: "Đã xác nhận",
  inProgress: "Đang khám",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  noShow: "Không đến",
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: statusPalette.scheduled.color,
  confirmed: statusPalette.confirmed.color,
  inProgress: statusPalette.inProgress.color,
  completed: statusPalette.completed.color,
  cancelled: statusPalette.cancelled.color,
  noShow: statusPalette.noShow.color,
};

export function adaptAppointment(dto: AppointmentDto): Appointment {
  const durationMinutes = dayjs(dto.endTime).diff(
    dayjs(dto.startTime),
    "minute",
  );

  return {
    ...dto,
    statusColor: STATUS_COLORS[dto.status] ?? "#5E748E",
    statusLabel: STATUS_LABELS[dto.status] ?? dto.status,
    durationMinutes,
  };
}
