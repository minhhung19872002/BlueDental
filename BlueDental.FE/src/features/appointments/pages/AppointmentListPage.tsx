// AppointmentListPage — tabular view of appointments with filters.
// TODO: Implement full filter bar (date range, doctor, status).

import { Table, Tag } from "antd";
import { useAppointmentList } from "../api/appointmentQueries";
import { adaptAppointment } from "../api/appointmentAdapters";
import { useTablePagination } from "@/hooks/useTablePagination";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import type { Appointment } from "../types/appointment";

export function AppointmentListPage() {
  const pagination = useTablePagination(20);

  const { data, isLoading } = useAppointmentList({
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const appointments = (data?.items ?? []).map(adaptAppointment);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Danh sách lịch hẹn</h1>
        </div>
      </div>

      <div className="page-card">
        <Table<Appointment>
          rowKey="id"
          dataSource={appointments}
          loading={isLoading}
          pagination={pagination.buildConfig(data?.totalCount)}
          scroll={{ x: 800 }}
          columns={[
            {
              title: "Bệnh nhân",
              dataIndex: "patientName",
              key: "patientName",
            },
            {
              title: "Bác sĩ",
              dataIndex: "doctorName",
              key: "doctorName",
            },
            {
              title: "Ngày khám",
              key: "startTime",
              render: (_: unknown, record: Appointment) =>
                formatDate(record.startTime),
            },
            {
              title: "Giờ",
              key: "time",
              width: 120,
              render: (_: unknown, record: Appointment) =>
                `${dayjs(record.startTime).format("HH:mm")} – ${dayjs(record.endTime).format("HH:mm")}`,
            },
            {
              title: "Trạng thái",
              key: "status",
              width: 140,
              render: (_: unknown, record: Appointment) => (
                <StatusBadge status={record.status} />
              ),
            },
            {
              title: "Lý do",
              dataIndex: "reason",
              key: "reason",
              render: (v: string | null) =>
                v ?? <Tag color="default">Định kỳ</Tag>,
            },
          ]}
        />
      </div>
    </div>
  );
}
