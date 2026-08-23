import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Table, Tag, Button, Input, Popconfirm, message } from "antd";
import { SearchOutlined, PlusOutlined, CalendarOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAppointmentList } from "../api/appointmentQueries";
import { useConfirmAppointment, useCancelAppointment } from "../api/appointmentMutations";
import { adaptAppointment } from "../api/appointmentAdapters";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { StatusBadge } from "../components/StatusBadge";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import type { Appointment, AppointmentStatus } from "../types/appointment";

type StatusFilter = "all" | AppointmentStatus;

export function AppointmentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",        label: t("common.all") },
    { key: "scheduled",  label: t("appointment.statusScheduled") },
    { key: "confirmed",  label: t("appointment.statusConfirmed") },
    { key: "inProgress", label: t("appointment.statusInProgress") },
    { key: "completed",  label: t("appointment.statusCompleted") },
    { key: "cancelled",  label: t("appointment.statusCancelled") },
  ];

  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedKeyword = useDebounce(keyword);
  const confirmMutation = useConfirmAppointment();
  const cancelMutation = useCancelAppointment();

  const { data, isLoading } = useAppointmentList({
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const appointments = (data?.items ?? []).map(adaptAppointment).filter((a) => {
    if (!debouncedKeyword) return true;
    const kw = debouncedKeyword.toLowerCase();
    return (
      a.patientName?.toLowerCase().includes(kw) ||
      a.doctorName?.toLowerCase().includes(kw)
    );
  });

  const handleConfirm = async (id: string) => {
    await confirmMutation.mutateAsync(id);
    message.success(t("appointment.confirmSuccess"));
  };

  const handleCancel = async (id: string) => {
    await cancelMutation.mutateAsync(id);
    message.success(t("appointment.cancelSuccess"));
  };

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("appointment.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<CalendarOutlined />} onClick={() => navigate("/calendar")}>
              {t("nav.calendar")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              {t("appointment.createAppointment")}
            </Button>
          </div>
        </div>
      </div>

      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setStatusFilter(tab.key); pagination.resetToFirstPage(); }}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom: statusFilter === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: statusFilter === tab.key ? "#1677ff" : "#595959",
                fontWeight: statusFilter === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table<Appointment>
          rowKey="id"
          dataSource={appointments}
          loading={isLoading}
          pagination={pagination.buildConfig(data?.totalCount)}
          scroll={{ x: 900 }}
          size="middle"
          onRow={(record) => ({
            onClick: () => setSelectedId(record.id),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: t("patient.fullName"),
              dataIndex: "patientName",
              key: "patientName",
              render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
            },
            {
              title: t("patient.doctor"),
              dataIndex: "doctorName",
              key: "doctorName",
            },
            {
              title: t("appointment.examDate"),
              key: "startTime",
              width: 110,
              render: (_: unknown, record: Appointment) => formatDate(record.startTime),
            },
            {
              title: t("appointment.time"),
              key: "time",
              width: 130,
              render: (_: unknown, record: Appointment) =>
                `${dayjs(record.startTime).format("HH:mm")} – ${dayjs(record.endTime).format("HH:mm")}`,
            },
            {
              title: t("common.status"),
              key: "status",
              width: 130,
              render: (_: unknown, record: Appointment) => <StatusBadge status={record.status} />,
            },
            {
              title: t("appointment.reason"),
              dataIndex: "reason",
              key: "reason",
              render: (v: string | null) => v ?? <Tag color="default">{t("appointment.periodic")}</Tag>,
            },
            {
              title: t("common.actions"),
              key: "actions",
              width: 160,
              render: (_: unknown, record: Appointment) => (
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {record.status === "scheduled" && (
                    <Button
                      size="small"
                      type="primary"
                      loading={confirmMutation.isPending}
                      onClick={() => handleConfirm(record.id)}
                    >
                      {t("common.confirm")}
                    </Button>
                  )}
                  {record.status !== "completed" && record.status !== "cancelled" && (
                    <Popconfirm
                      title={t("appointment.cancelConfirmTitle")}
                      okText={t("common.cancel")}
                      cancelText={t("appointment.no")}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleCancel(record.id)}
                    >
                      <Button size="small" danger loading={cancelMutation.isPending}>{t("common.cancel")}</Button>
                    </Popconfirm>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <AppointmentEditorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />
      <AppointmentDetailDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
