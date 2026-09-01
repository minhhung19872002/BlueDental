import { Tag } from "antd";
import type { AppointmentStatus } from "../types/appointment";
import { statusPaletteOf } from "@/theme/index";
import { t } from "@/lib/i18n";

const statusLabels = (): Record<AppointmentStatus, string> => ({
  scheduled: t("Đã đặt lịch"),
  confirmed: t("Đã xác nhận"),
  inProgress: t("Đang khám"),
  completed: t("Hoàn thành"),
  cancelled: t("Đã hủy"),
  noShow: t("Không đến"),
});

interface Props {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: Props) {
  const palette = statusPaletteOf()[status];
  return (
    <Tag
      style={{
        background: palette?.bg ?? "#f7f8fd",
        color: palette?.color ?? "#78819c",
        border: "none",
      }}
    >
      {statusLabels()[status] ?? status}
    </Tag>
  );
}
