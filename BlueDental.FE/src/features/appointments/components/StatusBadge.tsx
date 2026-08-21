import { Tag } from "antd";
import type { AppointmentStatus } from "../types/appointment";
import { statusPalette } from "@/theme/index";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Đã đặt lịch",
  confirmed: "Đã xác nhận",
  inProgress: "Đang khám",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  noShow: "Không đến",
};

interface Props {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: Props) {
  const palette = statusPalette[status];
  return (
    <Tag
      style={{
        background: palette?.bg ?? "#F4F7FA",
        color: palette?.color ?? "#5E748E",
        border: "none",
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </Tag>
  );
}
