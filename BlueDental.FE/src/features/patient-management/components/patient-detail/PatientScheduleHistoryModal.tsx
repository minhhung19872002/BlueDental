import { useState } from "react";
import { Button, Checkbox, DatePicker, Input, Modal, Select, type TableColumnsType } from "antd";
import dayjs from "dayjs";
import { DataTable } from "@/components/DataTable";
import type { Appointment, AppointmentStatus } from "@/features/appointments/types/appointment";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { exportToExcel } from "@/utils/exportExcel";
import { formatDateTime } from "@/utils/format";

/**
 * "Lịch sử thay đổi lịch hẹn".
 *
 * The reference reads this from its own `schedule-logs` collection; BlueDental
 * has no per-change log yet, so this lists the patient's appointments with the
 * audit stamps the API does return. Recorded in docs/clone/unknowns.md.
 */

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Đã hẹn",
  confirmed: "Đã hẹn",
  inProgress: "Đã đến",
  completed: "Đã đến",
  cancelled: "Đã huỷ",
  noShow: "Trễ hẹn",
};

interface Props {
  open: boolean;
  appointments: Appointment[];
  onClose: () => void;
}

export function PatientScheduleHistoryModal({ open, appointments, onClose }: Props) {
  const [range, setRange] = useState<[string, string] | null>(null);
  const [status, setStatus] = useState<AppointmentStatus>();
  const [keyword, setKeyword] = useState("");
  const [important, setImportant] = useState(false);
  const pagination = useTablePagination(20);

  const rows = appointments.filter((row) => {
    if (status && row.status !== status) return false;
    if (important && row.status !== "cancelled" && row.status !== "noShow") return false;
    if (range) {
      const day = dayjs(row.startTime);
      if (day.isBefore(dayjs(range[0]), "day") || day.isAfter(dayjs(range[1]), "day")) return false;
    }
    if (keyword) {
      const haystack = `${row.doctorName} ${row.reason ?? ""} ${row.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(keyword.toLowerCase())) return false;
    }
    return true;
  });

  const columns: TableColumnsType<Appointment> = [
    { title: t("Thời điểm tạo"), dataIndex: "createdAt", width: 170, render: formatDateTime },
    { title: t("Ngày/ Giờ"), dataIndex: "startTime", width: 170, render: formatDateTime },
    { title: t("Bác sĩ phụ trách"), dataIndex: "doctorName", width: 200 },
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
      width: 130,
      render: (value: AppointmentStatus) => t(STATUS_LABELS[value]),
    },
  ];

  const handleExport = () =>
    exportToExcel(
      rows.map((row) => ({
        createdAt: formatDateTime(row.createdAt),
        startTime: formatDateTime(row.startTime),
        doctorName: row.doctorName,
        reason: row.reason ?? "",
        notes: row.notes ?? "",
        status: t(STATUS_LABELS[row.status]),
      })),
      [
        { header: t("Thời điểm tạo"), key: "createdAt" },
        { header: t("Ngày/ Giờ"), key: "startTime" },
        { header: t("Bác sĩ phụ trách"), key: "doctorName" },
        { header: t("Nội dung"), key: "reason" },
        { header: t("Ghi chú"), key: "notes" },
        { header: t("Trạng thái"), key: "status" },
      ],
      "lich-su-lich-hen",
    );

  const clearFilters = () => {
    setRange(null);
    setStatus(undefined);
    setKeyword("");
    setImportant(false);
  };

  return (
    <Modal
      open={open}
      title={t("LỊCH SỬ THAY ĐỔI LỊCH HẸN")}
      width={1180}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      className="pd-appointment-history"
    >
      <div className="pd-history-filters">
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          value={range ? [dayjs(range[0]), dayjs(range[1])] : null}
          onChange={(value) =>
            setRange(
              value?.[0] && value[1]
                ? [value[0].format("YYYY-MM-DD"), value[1].format("YYYY-MM-DD")]
                : null,
            )
          }
        />
        <Select
          allowClear
          placeholder={t("Trạng thái")}
          value={status}
          onChange={setStatus}
          options={[...new Set(Object.values(STATUS_LABELS))].map((label) => ({
            value: (Object.keys(STATUS_LABELS) as AppointmentStatus[]).find(
              (key) => STATUS_LABELS[key] === label,
            )!,
            label: t(label),
          }))}
        />
        <Input
          allowClear
          placeholder={t("Nội dung thay đổi")}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Checkbox checked={important} onChange={(event) => setImportant(event.target.checked)}>
          {t("Quan trọng")}
        </Checkbox>
        <Button onClick={clearFilters}>{t("Xóa lọc")}</Button>
        <Button type="primary" disabled={rows.length === 0} onClick={handleExport}>
          {t("Xuất Excel")}
        </Button>
      </div>

      <div className="bd-cat-card pd-history-card">
        <DataTable<Appointment>
          rowKey="id"
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Chưa có lịch sử thay đổi") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("thay đổi")))}
        />
      </div>
    </Modal>
  );
}
