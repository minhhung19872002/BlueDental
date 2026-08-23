import { Form, Input, Button, message } from "antd";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          void messageApi.success(t("treatment.saveRecordSuccess"));
          form.resetFields();
          onSuccess?.();
        },
        onError: () => {
          void messageApi.error(t("treatment.saveRecordFailed"));
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
          label={t("treatment.teethNumbers")}
          extra={t("treatment.teethNumbersHint")}
        >
          <Input placeholder="11, 12, 21" allowClear />
        </Form.Item>

        <Form.Item
          name="diagnosis"
          label={t("treatment.diagnosis")}
          rules={[{ required: true, message: t("treatment.diagnosisRequired") }]}
        >
          <Input.TextArea rows={3} placeholder={t("treatment.diagnosisPlaceholder")} allowClear />
        </Form.Item>

        <Form.Item name="notes" label={t("common.note")}>
          <Input.TextArea rows={3} placeholder={t("common.notePlaceholder")} allowClear />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createMutation.isPending}
          >
            {t("treatment.saveRecord")}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
