import { Tag } from "antd";
import type { AppointmentStatus } from "../types/appointment";
import { statusPaletteOf } from "@/theme/index";
import { t } from "@/lib/i18n";

const statusLabels = (): Record<AppointmentStatus, string> => ({
  scheduled: t("Appointment:Status:Scheduled"),
  confirmed: t("Appointment:Status:Confirmed"),
  inProgress: t("Appointment:Status:InProgress"),
  completed: t("Appointment:Status:Completed"),
  cancelled: t("Appointment:Status:Cancelled"),
  noShow: t("Appointment:Status:NoShow"),
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
