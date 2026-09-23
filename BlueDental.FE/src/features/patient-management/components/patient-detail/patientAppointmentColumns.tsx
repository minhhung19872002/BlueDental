import { Button, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { StatusBadge } from "@/components/StatusBadge";
import type { Appointment, AppointmentStatus } from "@/features/appointments/types/appointment";
import { t } from "@/lib/i18n";

/** The reference's four groups, and which server statuses land in each. */
export const APPOINTMENT_GROUPS = [
  { key: "scheduled", label: "Đã hẹn", tone: "blue", of: ["scheduled", "confirmed"] },
  { key: "arrived", label: "Đã đến", tone: "green", of: ["inProgress", "completed"] },
  { key: "cancelled", label: "Đã huỷ", tone: "red", of: ["cancelled"] },
  { key: "late", label: "Trễ hẹn", tone: "amber", of: ["noShow"] },
] as const;

export type AppointmentGroupKey = (typeof APPOINTMENT_GROUPS)[number]["key"];

/** Whether an appointment in `status` counts under the group `key`. */
export function inAppointmentGroup(key: AppointmentGroupKey, status: AppointmentStatus): boolean {
  const group = APPOINTMENT_GROUPS.find((item) => item.key === key);
  return group !== undefined && (group.of as readonly string[]).includes(status);
}

const STATUS_TONES: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Đã hẹn", bg: "#e3f2fd", color: "#1565c0" },
  confirmed: { label: "Đã hẹn", bg: "#e3f2fd", color: "#1565c0" },
  inProgress: { label: "Đã đến", bg: "#e8f5e9", color: "#2e7d32" },
  completed: { label: "Đã đến", bg: "#e8f5e9", color: "#2e7d32" },
  cancelled: { label: "Đã huỷ", bg: "#ffebee", color: "#c62828" },
  noShow: { label: "Trễ hẹn", bg: "#fff3e0", color: "#ef6c00" },
};

interface RowHandlers {
  onEdit?: (row: Appointment) => void;
  onDelete?: (row: Appointment) => void;
}

/**
 * The six columns of the reference's Lịch hẹn table. Thao tác carries the
 * pencil and the red bin side by side; the bin only opens the confirmation,
 * the caller decides what a confirmed delete does.
 */
export function buildAppointmentColumns({
  onEdit,
  onDelete,
}: RowHandlers): TableColumnsType<Appointment> {
  return [
    {
      title: t("Patient:Debt:DateTime"),
      dataIndex: "startTime",
      width: 200,
      render: (value: string, row) => (
        <div className="pd-cell-stack">
          <b>{dayjs(value).format("Patient:Misc:DateFormat")}</b>
          <span>
            {dayjs(value).format("HH:mm")} – {dayjs(row.endTime).format("HH:mm")}
          </span>
        </div>
      ),
    },
    { title: t("Patient:QuoteSheet:InChargeDoctor"), dataIndex: "doctorName", width: 220 },
    {
      title: t("Patient:Library:Content"),
      dataIndex: "reason",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Patient:Misc:Note"),
      dataIndex: "notes",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Patient:Misc:StatusLabel"),
      dataIndex: "status",
      width: 150,
      render: (value: AppointmentStatus) => {
        const tone = STATUS_TONES[value];
        return <StatusBadge label={t(tone.label)} bg={tone.bg} color={tone.color} />;
      },
    },
    ...((onEdit || onDelete) ? [{
      title: t("Common:Actions"),
      key: "actions" as const,
      width: 110,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: unknown, row: Appointment) => (
        <span className="pd-icon-actions">
          {onEdit && (
            <Tooltip title={t("Patient:Profile:EditAppointment")}>
              <Button
                type="text"
                icon={<EditOutlined />}
                aria-label={t("Patient:Profile:EditAppointment")}
                onClick={() => onEdit(row)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title={t("Patient:Appt:Delete")}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Patient:Appt:Delete")}
                onClick={() => onDelete(row)}
              />
            </Tooltip>
          )}
        </span>
      ),
    }] : []),
  ];
}
