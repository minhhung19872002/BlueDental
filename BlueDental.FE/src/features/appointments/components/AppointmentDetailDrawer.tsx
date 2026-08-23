import { Button, Descriptions, Drawer, Popconfirm, Space, Spin, message } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useAppointment } from "../api/appointmentQueries";
import { useConfirmAppointment, useCancelAppointment } from "../api/appointmentMutations";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

interface Props {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailDrawer({ appointmentId, onClose }: Props) {
  const { t } = useTranslation();
  const { data: appointment, isLoading } = useAppointment(appointmentId ?? "");
  const confirmMutation = useConfirmAppointment();
  const cancelMutation = useCancelAppointment();

  const canConfirm = appointment?.status === "scheduled";
  const canCancel = appointment?.status !== "completed" && appointment?.status !== "cancelled";

  const handleConfirm = async () => {
    if (!appointmentId) return;
    await confirmMutation.mutateAsync(appointmentId);
    message.success(t("appointment.confirmSuccess"));
  };

  const handleCancel = async () => {
    if (!appointmentId) return;
    await cancelMutation.mutateAsync(appointmentId);
    message.success(t("appointment.cancelSuccess"));
  };

  return (
    <Drawer
      open={Boolean(appointmentId)}
      onClose={onClose}
      title={t("appointment.detailTitle")}
      width={480}
      extra={
        appointment && (
          <Space>
            {canConfirm && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="small"
                loading={confirmMutation.isPending}
                onClick={handleConfirm}
              >
                {t("appointment.confirmBtn")}
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title={t("appointment.cancelConfirm")}
                okText={t("appointment.cancelOk")}
                cancelText={t("appointment.cancelNo")}
                okButtonProps={{ danger: true }}
                onConfirm={handleCancel}
              >
                <Button
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  loading={cancelMutation.isPending}
                >
                  {t("appointment.cancelBtn")}
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      }
    >
      {isLoading && (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <Spin />
        </div>
      )}

      {appointment && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t("appointment.colPatient")}>
            {appointment.patientName}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.phone")}>
            {appointment.patientPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("appointment.colDoctor")}>
            {appointment.doctorName}
          </Descriptions.Item>
          <Descriptions.Item label={t("appointment.colDate")}>
            {formatDate(appointment.startTime)}
          </Descriptions.Item>
          <Descriptions.Item label={t("appointment.colTime")}>
            {dayjs(appointment.startTime).format("HH:mm")} –{" "}
            {dayjs(appointment.endTime).format("HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.status")}>
            <StatusBadge status={appointment.status} />
          </Descriptions.Item>
          <Descriptions.Item label={t("appointment.colReason")}>
            {appointment.reason ?? t("appointment.reasonPeriodic")}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.note")}>
            {appointment.notes ?? "—"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}
