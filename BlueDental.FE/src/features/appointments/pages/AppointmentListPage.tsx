import { useState } from "react";
import { Table, Tag, Button, Input, Popconfirm, message } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
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

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",        label: "Tất cả" },
  { key: "scheduled",  label: "Đã hẹn" },
  { key: "confirmed",  label: "Đã xác nhận" },
  { key: "inProgress", label: "Đang khám" },
  { key: "completed",  label: "Hoàn thành" },
  { key: "cancelled",  label: "Đã hủy" },
];

export function AppointmentListPage() {
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
    message.success("Đã xác nhận lịch hẹn");
  };

  const handleCancel = async (id: string) => {
    await cancelMutation.mutateAsync(id);
    message.success("Đã hủy lịch hẹn");
  };

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm bệnh nhân, bác sĩ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Tạo lịch hẹn
          </Button>
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
              title: "Bệnh nhân",
              dataIndex: "patientName",
              key: "patientName",
              render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
            },
            {
              title: "Bác sĩ",
              dataIndex: "doctorName",
              key: "doctorName",
            },
            {
              title: "Ngày khám",
              key: "startTime",
              width: 110,
              render: (_: unknown, record: Appointment) => formatDate(record.startTime),
            },
            {
              title: "Giờ",
              key: "time",
              width: 130,
              render: (_: unknown, record: Appointment) =>
                `${dayjs(record.startTime).format("HH:mm")} – ${dayjs(record.endTime).format("HH:mm")}`,
            },
            {
              title: "Trạng thái",
              key: "status",
              width: 130,
              render: (_: unknown, record: Appointment) => <StatusBadge status={record.status} />,
            },
            {
              title: "Lý do",
              dataIndex: "reason",
              key: "reason",
              render: (v: string | null) => v ?? <Tag color="default">Định kỳ</Tag>,
            },
            {
              title: "Thao tác",
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
                      Xác nhận
                    </Button>
                  )}
                  {record.status !== "completed" && record.status !== "cancelled" && (
                    <Popconfirm
                      title="Hủy lịch hẹn này?"
                      okText="Hủy"
                      cancelText="Không"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleCancel(record.id)}
                    >
                      <Button size="small" danger loading={cancelMutation.isPending}>Hủy</Button>
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
