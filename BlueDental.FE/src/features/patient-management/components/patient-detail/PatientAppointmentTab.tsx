import { useState } from "react";
import { Button, Tooltip, type TableColumnsType } from "antd";
import { CalendarOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import type { Appointment, AppointmentStatus } from "@/features/appointments/types/appointment";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { PatientScheduleHistoryModal } from "./PatientScheduleHistoryModal";

/**
 * Lịch hẹn.
 *
 * Four counters over the app's own table card, then the two commands the
 * reference puts on the right. The counters double as filters, as they do on
 * every other BlueDental screen that has them.
 */

/** The reference's four groups, and which server statuses land in each. */
const GROUPS = [
  { key: "scheduled", label: "Đã hẹn", tone: "blue", of: ["scheduled", "confirmed"] },
  { key: "arrived", label: "Đã đến", tone: "green", of: ["inProgress", "completed"] },
  { key: "cancelled", label: "Đã huỷ", tone: "red", of: ["cancelled"] },
  { key: "late", label: "Trễ hẹn", tone: "amber", of: ["noShow"] },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

const STATUS_TONES: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Đã hẹn", bg: "#e3f2fd", color: "#1565c0" },
  confirmed: { label: "Đã hẹn", bg: "#e3f2fd", color: "#1565c0" },
  inProgress: { label: "Đã đến", bg: "#e8f5e9", color: "#2e7d32" },
  completed: { label: "Đã đến", bg: "#e8f5e9", color: "#2e7d32" },
  cancelled: { label: "Đã huỷ", bg: "#ffebee", color: "#c62828" },
  noShow: { label: "Trễ hẹn", bg: "#fff3e0", color: "#ef6c00" },
};

export function PatientAppointmentTab({ patientId }: { patientId: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [group, setGroup] = useState<GroupKey | null>(null);

  const pagination = useTablePagination(20);

  // Every appointment of this patient, for the four counters. They count the
  // whole record, not the page on screen.
  const all = useAppointmentList({ patientId, maxResultCount: 500 });
  const everything = all.data?.items ?? [];

  const chosen = GROUPS.find((item) => item.key === group);
  const page = useAppointmentList({
    patientId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const rows = (page.data?.items ?? []).filter(
    (row) => !chosen || (chosen.of as readonly string[]).includes(row.status),
  );
  const totalCount = chosen
    ? everything.filter((row) => (chosen.of as readonly string[]).includes(row.status)).length
    : page.data?.totalCount ?? 0;

  const columns: TableColumnsType<Appointment> = [
    {
      title: t("Ngày/ Giờ"),
      dataIndex: "startTime",
      width: 200,
      render: (value: string, row) => (
        <div className="pd-cell-stack">
          <b>{dayjs(value).format("DD/MM/YYYY")}</b>
          <span>
            {dayjs(value).format("HH:mm")} – {dayjs(row.endTime).format("HH:mm")}
          </span>
        </div>
      ),
    },
    { title: t("Bác sĩ phụ trách"), dataIndex: "doctorName", width: 220 },
    {
      title: t("Nội dung"),
      dataIndex: "reason",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Ghi chú"),
      dataIndex: "notes",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      width: 150,
      render: (value: AppointmentStatus) => {
        const tone = STATUS_TONES[value];
        return <StatusBadge label={t(tone.label)} bg={tone.bg} color={tone.color} />;
      },
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 110,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <Tooltip title={t("Chỉnh sửa lịch hẹn")}>
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={t("Chỉnh sửa lịch hẹn")}
            onClick={() => setEditing(row)}
          />
        </Tooltip>
      ),
    },
  ];

  const refresh = () => {
    void page.refetch();
    void all.refetch();
  };

  return (
    <section className="pd-pane pd-pane--fill">
      <div className="pd-appointment-toolbar">
        <div className="pd-stat-row">
          {GROUPS.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={group === item.key}
              className={`pd-stat pd-stat--${item.tone}${group === item.key ? " active" : ""}`}
              onClick={() =>
                setGroup((current) => {
                  pagination.resetToFirstPage();
                  return current === item.key ? null : item.key;
                })
              }
            >
              <strong>
                {everything.filter((row) => (item.of as readonly string[]).includes(row.status))
                  .length}
              </strong>
              <span>{t(item.label)}</span>
            </button>
          ))}
        </div>

        <div>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
            {t("Lịch sử thay đổi")}
          </Button>
          <Button type="primary" icon={<CalendarOutlined />} onClick={() => setCreating(true)}>
            {t("Tạo lịch hẹn mới")}
          </Button>
        </div>
      </div>

      <div className="bd-cat-card">
        <DataTable<Appointment>
          rowKey="id"
          size="small"
          loading={page.isFetching}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: t("Không có dữ liệu") }}
          pagination={pagination.buildConfig(totalCount, countedTotal(t("lịch hẹn")))}
        />
      </div>

      <AppointmentEditorModal
        open={creating}
        initialPatientId={patientId}
        lockPatient
        onClose={() => setCreating(false)}
        onSuccess={refresh}
      />

      <AppointmentEditorModal
        open={Boolean(editing)}
        appointmentId={editing?.id}
        initialPatientId={editing?.patientId}
        initialDoctorId={editing?.doctorId}
        initialDate={editing?.startTime.slice(0, 10)}
        initialTime={editing?.startTime.slice(11, 16)}
        initialEndTime={editing?.endTime.slice(11, 16)}
        initialReason={editing?.reason ?? undefined}
        initialNotes={editing?.notes ?? undefined}
        initialColor={editing?.color}
        lockPatient
        onClose={() => setEditing(null)}
        onSuccess={refresh}
      />

      <PatientScheduleHistoryModal
        open={historyOpen}
        appointments={everything}
        onClose={() => setHistoryOpen(false)}
      />
    </section>
  );
}
