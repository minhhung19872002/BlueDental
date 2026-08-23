import { Form, Input, Button, message } from "antd";
import { useCreateDiagnosticRecord } from "../api/diagnosticApi";
import { useAuthStore } from "@/features/auth/store/authStore";

interface Props {
  patientId: string;
  onSuccess?: () => void;
}

interface FormValues {
  teethNumbers: string;
  diagnosis: string;
  notes: string;
}

export function TreatmentRecordForm({ patientId, onSuccess }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const createMutation = useCreateDiagnosticRecord();
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");

  const handleFinish = (values: FormValues) => {
    createMutation.mutate(
      {
        patientId,
        dentistId: currentUserId,
        teethNumbers: values.teethNumbers?.trim() || undefined,
        diagnosis: values.diagnosis?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      },
      {
        onSuccess: () => {
          void messageApi.success("Đã lưu hồ sơ điều trị");
          form.resetFields();
          onSuccess?.();
        },
        onError: () => {
          void messageApi.error("Không thể lưu hồ sơ điều trị. Vui lòng thử lại.");
        },
      },
    );
  };

  return (
    <>
      {contextHolder}
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="teethNumbers"
          label="Số răng"
          extra="Nhập số răng cách nhau bằng dấu phẩy, ví dụ: 11, 12, 21"
        >
          <Input placeholder="11, 12, 21" allowClear />
        </Form.Item>

        <Form.Item
          name="diagnosis"
          label="Chẩn đoán"
          rules={[{ required: true, message: "Vui lòng nhập chẩn đoán" }]}
        >
          <Input.TextArea rows={3} placeholder="Nhập chẩn đoán..." allowClear />
        </Form.Item>

        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={3} placeholder="Ghi chú thêm..." allowClear />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createMutation.isPending}
          >
            Lưu hồ sơ điều trị
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
