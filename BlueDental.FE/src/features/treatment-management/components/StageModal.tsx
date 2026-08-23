import { useEffect } from "react";
import { Alert, DatePicker, Form, Input, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { useCreateStage } from "../api/stageApi";
import { usePatientAdvises } from "../api/consultingQueries";
import { ADVISE_STATUS, type PatientAdviseDto } from "../api/consultingApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

interface StageModalProps {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface StageFormValues {
  treatmentServiceId: string;
  name: string;
  staffId: string;
  note?: string;
  scheduledDate?: dayjs.Dayjs;
}

/**
 * A stage is always a step of one service line. In BlueDental a service line is a
 * consulting line the patient accepted, so only those are offered here.
 */
export function StageModal({ open, patientId, onClose }: StageModalProps) {
  const [form] = Form.useForm<StageFormValues>();
  const branchId = useCurrentBranchId();
  const createStage = useCreateStage();

  const { data: advises } = usePatientAdvises({ patientId });
  const { data: dentists } = useDentistList();

  const serviceLines = (advises?.items ?? []).filter(
    (advise) =>
      advise.status === ADVISE_STATUS.Accepted || advise.status === ADVISE_STATUS.Converted,
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const line = serviceLines.find((item) => item.id === values.treatmentServiceId);
    if (!line) return;

    try {
      await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: line.treatmentPlanId,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: values.name,
        note: values.note,
        staffId: values.staffId,
        scheduledDate: values.scheduledDate?.format("YYYY-MM-DD"),
      });

      message.success("Đã thêm công đoạn");
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title="Thêm công đoạn"
      okText="Tạo"
      cancelText="Huỷ"
      okButtonProps={{ disabled: serviceLines.length === 0 }}
      confirmLoading={createStage.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {serviceLines.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Bệnh nhân chưa có dịch vụ điều trị"
          description="Công đoạn là một bước của dịch vụ điều trị. Hãy tạo và chốt phiếu tư vấn trước."
        />
      ) : (
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="treatmentServiceId"
            label="Dịch vụ điều trị"
            rules={[{ required: true, message: "Vui lòng chọn dịch vụ" }]}
          >
            <Select
              placeholder="Chọn dịch vụ"
              options={serviceLines.map((line: PatientAdviseDto) => ({
                value: line.id,
                label: `${line.code} — ${line.serviceName ?? "Dịch vụ"}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên công đoạn"
            rules={[{ required: true, message: "Vui lòng nhập tên công đoạn" }]}
          >
            <Input placeholder="Tên công đoạn" maxLength={300} />
          </Form.Item>

          <Form.Item
            name="staffId"
            label="Bác sĩ thực hiện"
            rules={[{ required: true, message: "Vui lòng chọn bác sĩ" }]}
          >
            <Select
              placeholder="Chọn bác sĩ"
              options={(dentists ?? []).map((dentist) => ({
                value: dentist.id,
                label: dentist.name,
              }))}
            />
          </Form.Item>

          <Form.Item name="scheduledDate" label="Ngày dự kiến">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Ghi chú công đoạn" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
