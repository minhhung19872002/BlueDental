import { Button, Descriptions, Drawer, Popconfirm, Space, Spin, message } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useAppointment } from "../api/appointmentQueries";
import { useConfirmAppointment, useCancelAppointment } from "../api/appointmentMutations";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";

interface Props {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailDrawer({ appointmentId, onClose }: Props) {
  const { data: appointment, isLoading } = useAppointment(appointmentId ?? "");
  const confirmMutation = useConfirmAppointment();
  const cancelMutation = useCancelAppointment();

  const canConfirm = appointment?.status === "scheduled";
  const canCancel = appointment?.status !== "completed" && appointment?.status !== "cancelled";

  const handleConfirm = async () => {
    if (!appointmentId) return;
    await confirmMutation.mutateAsync(appointmentId);
    message.success("Đã xác nhận lịch hẹn");
  };

  const handleCancel = async () => {
    if (!appointmentId) return;
    await cancelMutation.mutateAsync(appointmentId);
    message.success("Đã hủy lịch hẹn");
  };

  return (
    <Drawer
      open={Boolean(appointmentId)}
      onClose={onClose}
      title="Chi tiết lịch hẹn"
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
                Xác nhận
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title="Hủy lịch hẹn này?"
                okText="Hủy lịch"
                cancelText="Không"
                okButtonProps={{ danger: true }}
                onConfirm={handleCancel}
              >
                <Button
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  loading={cancelMutation.isPending}
                >
                  Hủy lịch
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
          <Descriptions.Item label="Bệnh nhân">
            {appointment.patientName}
          </Descriptions.Item>
          <Descriptions.Item label="Điện thoại">
            {appointment.patientPhone}
          </Descriptions.Item>
          <Descriptions.Item label="Bác sĩ">
            {appointment.doctorName}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày khám">
            {formatDate(appointment.startTime)}
          </Descriptions.Item>
          <Descriptions.Item label="Giờ khám">
            {dayjs(appointment.startTime).format("HH:mm")} –{" "}
            {dayjs(appointment.endTime).format("HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <StatusBadge status={appointment.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Lý do khám">
            {appointment.reason ?? "Khám định kỳ"}
          </Descriptions.Item>
          <Descriptions.Item label="Ghi chú">
            {appointment.notes ?? "—"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}
