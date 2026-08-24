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
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        background: palette?.bg ?? "#f4f6fa",
        color: palette?.color ?? "#6f7c90",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {statusLabels()[status] ?? status}
    </span>
  );
}
