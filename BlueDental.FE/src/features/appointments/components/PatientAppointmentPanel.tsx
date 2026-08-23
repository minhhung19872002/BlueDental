import { Card, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useAppointmentList } from "../api/appointmentQueries";
import { StatusBadge } from "./StatusBadge";
import type { Appointment, AppointmentStatus } from "../types/appointment";
import { formatDateTime } from "@/utils/format";

const { Text } = Typography;

interface PatientAppointmentPanelProps {
  patientId: string;
}

/** The counters the reference shows above a patient's appointment list. */
const COUNTERS: { status: AppointmentStatus; label: string; color: string; bg: string }[] = [
  { status: "scheduled", label: "Đã hẹn", color: "#1E70E6", bg: "#EBF3FE" },
  { status: "confirmed", label: "Đã xác nhận", color: "#10B981", bg: "#E6F4EA" },
  { status: "cancelled", label: "Đã huỷ", color: "#EF4444", bg: "#FCE8E6" },
  { status: "noShow", label: "Trễ hẹn", color: "#F59E0B", bg: "#FEF3C7" },
];

/** Lịch hẹn tab of a patient record. */
export function PatientAppointmentPanel({ patientId }: PatientAppointmentPanelProps) {
  const { data, isLoading } = useAppointmentList({ patientId, maxResultCount: 50 });

  const rows = data?.items ?? [];

  const columns: TableColumnsType<Appointment> = [
    {
      title: "Thời gian",
      dataIndex: "startTime",
      key: "startTime",
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "Bác sĩ",
      dataIndex: "doctorName",
      key: "doctorName",
      width: 160,
      render: (value: string) => value || "—",
    },
    {
      title: "Nội dung",
      dataIndex: "reason",
      key: "reason",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: AppointmentStatus) => <StatusBadge status={value} />,
    },
    {
      title: "Ghi chú",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      render: (value: string | null) => value ?? "—",
    },
  ];

  return (
    <div>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16 }}
        data-testid="patient-appointment-counters"
      >
        {COUNTERS.map((counter) => (
          <div
            key={counter.status}
            style={{
              minWidth: 70,
              minHeight: 55,
              padding: "8px 14px",
              borderTop: `3px solid ${counter.color}`,
              backgroundColor: counter.bg,
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: counter.color }}>
              {rows.filter((row) => row.status === counter.status).length}
            </div>
            <div style={{ fontSize: 11, color: counter.color }}>{counter.label}</div>
          </div>
        ))}
      </div>

      <Card size="small">
        <Table<Appointment>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Text type="secondary">Chưa có lịch hẹn</Text> }}
        />
      </Card>
    </div>
  );
}
