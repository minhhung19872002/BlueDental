import { useState } from "react";
import { Table, Tag, Button, Input, Select } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useAppointmentList } from "../api/appointmentQueries";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
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
  { key: "all",        label: t("Tất cả") },
  { key: "scheduled",  label: t("Đã hẹn") },
  { key: "confirmed",  label: t("Đã xác nhận") },
  { key: "inProgress", label: t("Đang khám") },
  { key: "completed",  label: t("Hoàn thành") },
  { key: "cancelled",  label: t("Đã hủy") },
];

export function AppointmentListPage() {
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
        title={t("Danh sách lịch hẹn")}
        subtitle={t("{0} lịch hẹn", data?.totalCount ?? 0)}
      />

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...")}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                pagination.resetToFirstPage();
              }}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              placeholder={t("Bác sĩ điều trị")}
              allowClear
              style={{ width: 180 }}
              options={[]}
            />
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditorOpen(true)}>{t("Tạo lịch hẹn")}</Button>
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
              title: t("Bệnh nhân"),
              key: "patientName",
              render: (_: unknown, row: Appointment) =>
                row.patientCode ? `[${row.patientCode}] - ${row.patientName}` : row.patientName,
            },
            {
              title: t("Bác sĩ"),
              dataIndex: "doctorName",
              key: "doctorName",
            },
            {
              title: t("Ngày khám"),
              key: "startTime",
              render: (_: unknown, record: Appointment) => formatDate(record.startTime),
            },
            {
              title: t("Giờ"),
              key: "time",
              width: 140,
              render: (_: unknown, record: Appointment) =>
                `${dayjs(record.startTime).format("HH:mm")} – ${dayjs(record.endTime).format("HH:mm")}`,
            },
            {
              title: t("Trạng thái"),
              key: "status",
              width: 140,
              render: (_: unknown, record: Appointment) => <StatusBadge status={record.status} />,
            },
            {
              title: t("Lý do"),
              dataIndex: "reason",
              key: "reason",
              render: (v: string | null) => v ?? <Tag color="default">{t("Định kỳ")}</Tag>,
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
