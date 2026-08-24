// AppointmentDetailDrawer — Shows appointment details in a side drawer.
// TODO: Add quick-action buttons (confirm, cancel, mark as no-show).

import { Drawer, Descriptions, Spin } from "antd";
import { useAppointment } from "../api/appointmentQueries";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";

interface Props {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailDrawer({ appointmentId, onClose }: Props) {
  const { data: appointment, isLoading } = useAppointment(
    appointmentId ?? "",
  );

  return (
    <Drawer
      open={Boolean(appointmentId)}
      onClose={onClose}
      title={t("Chi tiết lịch hẹn")}
      size={480}
    >
      {isLoading && (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <Spin />
        </div>
      )}

      {appointment && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t("Bệnh nhân")}>
            {appointment.patientName}
          </Descriptions.Item>
          <Descriptions.Item label={t("Điện thoại")}>
            {appointment.patientPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("Bác sĩ")}>
            {appointment.doctorName}
          </Descriptions.Item>
          <Descriptions.Item label={t("Ngày khám")}>
            {formatDate(appointment.startTime)}
          </Descriptions.Item>
          <Descriptions.Item label={t("Giờ khám")}>
            {dayjs(appointment.startTime).format("HH:mm")} –{" "}
            {dayjs(appointment.endTime).format("HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label={t("Trạng thái")}>
            <StatusBadge status={appointment.status} />
          </Descriptions.Item>
          <Descriptions.Item label={t("Lý do khám")}>
            {appointment.reason ?? t("Khám định kỳ")}
          </Descriptions.Item>
          <Descriptions.Item label={t("Ghi chú")}>
            {appointment.notes ?? "—"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}
