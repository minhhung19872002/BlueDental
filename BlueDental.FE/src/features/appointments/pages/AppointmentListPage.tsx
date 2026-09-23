import { useState } from "react";
import { Table, Tag, Button, Input, Select } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useAppointmentList } from "../api/appointmentQueries";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import type { Appointment } from "../types/appointment";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";

type StatusFilter = "all" | "scheduled" | "confirmed" | "inProgress" | "completed" | "cancelled";

const statusTabs = (): { key: StatusFilter; label: string }[] => [
  { key: "all",        label: t("Appointment:List:All") },
  { key: "scheduled",  label: t("Appointment:Status:Scheduled2") },
  { key: "confirmed",  label: t("Appointment:Status:Confirmed") },
  { key: "inProgress", label: t("Appointment:Status:InProgress") },
  { key: "completed",  label: t("Appointment:Status:Completed") },
  { key: "cancelled",  label: t("Appointment:Status:Cancelled") },
];

export function AppointmentListPage() {
  const ability = useAbility("appointment");
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const debouncedKeyword = useDebounce(keyword);

  // Search and status go to the server. Filtering the fetched page instead meant
  // a clinic with more than one page of history could never find anything past
  // the first twenty rows.
  const { data, isLoading } = useAppointmentList({
    filter: debouncedKeyword || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const appointments = data?.items ?? [];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Appointment:List:Title")}
        subtitle={t("Appointment:List:Subtitle", data?.totalCount ?? 0)}
      />

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Appointment:List:SearchPlaceholder")}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                pagination.resetToFirstPage();
              }}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              placeholder={t("Appointment:Filter:TreatingDoctor")}
              allowClear
              style={{ width: 180 }}
              options={[]}
            />
          </div>
          {ability.canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditorOpen(true)}>{t("Appointment:Action:Create")}</Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
        {statusTabs().map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === statusFilter}
            className={`pill-tab${tab.key === statusFilter ? " pill-tab--active" : ""}`}
            onClick={() => { setStatusFilter(tab.key); pagination.resetToFirstPage(); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <Table<Appointment>
          rowKey="id"
          dataSource={appointments}
          loading={isLoading}
          pagination={pagination.buildConfig(data?.totalCount)}
          scroll={{ x: 800 }}
          size="middle"
          columns={[
            {
              title: t("Common:Patient"),
              key: "patientName",
              render: (_: unknown, row: Appointment) =>
                row.patientCode ? `[${row.patientCode}] - ${row.patientName}` : row.patientName,
            },
            {
              title: t("Appointment:Form:Doctor"),
              dataIndex: "doctorName",
              key: "doctorName",
            },
            {
              title: t("Appointment:List:ExamDate"),
              key: "startTime",
              render: (_: unknown, record: Appointment) => formatDate(record.startTime),
            },
            {
              title: t("Appointment:List:Time"),
              key: "time",
              width: 140,
              render: (_: unknown, record: Appointment) =>
                `${dayjs(record.startTime).format("HH:mm")} – ${dayjs(record.endTime).format("HH:mm")}`,
            },
            {
              title: t("Common:Status"),
              key: "status",
              width: 140,
              render: (_: unknown, record: Appointment) => <StatusBadge status={record.status} />,
            },
            {
              title: t("Appointment:List:Reason"),
              dataIndex: "reason",
              key: "reason",
              render: (v: string | null) => v ?? <Tag color="default">{t("Appointment:List:Periodic")}</Tag>,
            },
          ]}
        />
      </div>

      <AppointmentEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSuccess={() => setEditorOpen(false)}
      />
    </div>
  );
}
