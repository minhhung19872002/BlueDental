// AppointmentEditorModal — Create or edit an appointment.
// TODO: Add doctor selector, patient search, time validation.

import { Modal, Button } from "antd";

interface Props {
  open: boolean;
  appointmentId?: string | null;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({
  open,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      title="Đặt lịch hẹn"
      onCancel={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary">Lưu lịch hẹn</Button>
        </div>
      }
      width={560}
    >
      {/* TODO: Implement appointment form */}
      <p style={{ color: "#5E748E" }}>
        Form đặt lịch hẹn đang được phát triển.
      </p>
    </Modal>
  );
}
