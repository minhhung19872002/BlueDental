import { Tag } from "antd";
import { useTranslation } from "react-i18next";
import type { AppointmentStatus } from "../types/appointment";
import { statusPalette } from "@/theme/index";

interface Props {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: Props) {
  const { t } = useTranslation();
  const STATUS_LABELS: Record<AppointmentStatus, string> = {
    scheduled: t("appointment.statusScheduled"),
    confirmed: t("appointment.statusConfirmed"),
    inProgress: t("appointment.statusInProgress"),
    completed: t("appointment.statusCompleted"),
    cancelled: t("appointment.statusCancelled"),
    noShow: t("appointment.statusNoShow"),
  };
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
