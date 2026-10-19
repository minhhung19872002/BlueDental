import { Button, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { StatusBadge } from "@/components/StatusBadge";
import type { Appointment, AppointmentStatus } from "@/features/appointments/types/appointment";
import { t } from "@/lib/i18n";
import { STATUS_TONE, type StatusKey } from "@/theme/statusPalette";

/** The reference's four groups, and which server statuses land in each. */
export function appointmentGroups() {
  return [
    { key: "scheduled" as const, label: t("Patient:Appt:Scheduled"), tone: "blue" as const, of: ["scheduled", "confirmed"] as const },
    { key: "arrived" as const, label: t("Patient:Appt:Arrived"), tone: "green" as const, of: ["inProgress", "completed"] as const },
    { key: "cancelled" as const, label: t("Patient:Appt:Cancelled"), tone: "amber" as const, of: ["cancelled"] as const },
    { key: "late" as const, label: t("Patient:Appt:Late"), tone: "red" as const, of: ["noShow"] as const },
  ];
}

export type AppointmentGroupKey = "scheduled" | "arrived" | "cancelled" | "late";

/** Each server status, the label of its group and the app-wide status tone. */
const STATUS_GROUP: Record<AppointmentStatus, { labelKey: string; key: StatusKey }> = {
  scheduled: { labelKey: "Patient:Appt:Scheduled", key: "scheduled" },
  confirmed: { labelKey: "Patient:Appt:Scheduled", key: "scheduled" },
  inProgress: { labelKey: "Patient:Appt:Arrived", key: "arrived" },
  completed: { labelKey: "Patient:Appt:Arrived", key: "arrived" },
  cancelled: { labelKey: "Patient:Appt:Cancelled", key: "cancelled" },
  noShow: { labelKey: "Patient:Appt:Late", key: "late" },
};

interface RowHandlers {
  onHistory: (row: Appointment) => void;
  onEdit?: (row: Appointment) => void;
  onDelete?: (row: Appointment) => void;
}

/**
 * The six columns of the reference's Lịch hẹn table. Thao tác carries the
 * pencil and the red bin side by side; the bin only opens the confirmation,
 * the caller decides what a confirmed delete does. The clock in front of them
 * is BlueDental's own (not on the reference): that appointment's change
 * history. It only reads, so the column is there for anyone who sees the tab.
 */
export function buildAppointmentColumns({
  onHistory,
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
          <b>{dayjs(value).format(t("Patient:Misc:DateFormat"))}</b>
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
        const group = STATUS_GROUP[value];
        const tone = STATUS_TONE[group.key];
        return <StatusBadge label={t(group.labelKey)} bg={tone.bg} color={tone.color} />;
      },
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 140,
      align: "center",
      fixed: "right",
      render: (_: unknown, row: Appointment) => (
        <span className="pd-icon-actions">
          <Tooltip title={t("Patient:Appt:History")}>
            <Button
              type="text"
              icon={<HistoryOutlined />}
              aria-label={t("Patient:Appt:History")}
              onClick={() => onHistory(row)}
            />
          </Tooltip>
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
    },
  ];
}
