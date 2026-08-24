import { useEffect } from "react";
import { Alert, Form, Input, Modal, Select, message } from "antd";
import { useCreateDiagnosis } from "../api/consultingQueries";
import { formatTeeth, type ToothSelectionDto } from "../api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface DiagnosisModalProps {
  open: boolean;
  patientId: string;
  /** Teeth currently marked on the chart — a diagnosis must cover at least one. */
  teeth: ToothSelectionDto[];
  onClose: () => void;
  onCreated?: () => void;
}

interface DiagnosisFormValues {
  diagnosisId: string;
  staffId: string;
  secondStaffId?: string;
  note?: string;
}

export function DiagnosisModal({
  open,
  patientId,
  teeth,
  onClose,
  onCreated,
}: DiagnosisModalProps) {
  const [form] = Form.useForm<DiagnosisFormValues>();
  const branchId = useCurrentBranchId();
  const createDiagnosis = useCreateDiagnosis();

  const { data: diagnoses } = useCatalogOptions(CATALOG_GROUP.Diagnosis);
  const { data: dentists } = useDentistList();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      await createDiagnosis.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        diagnosisId: values.diagnosisId,
        staffId: values.staffId,
        secondStaffId: values.secondStaffId,
        note: values.note,
        teeth,
      });

      message.success(t("Đã tạo phiếu chẩn đoán"));
      onCreated?.();
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("Tạo phiếu chẩn đoán")}
      okText={t("Tạo")}
      cancelText={t("Huỷ")}
      okButtonProps={{ disabled: teeth.length === 0 }}
      confirmLoading={createDiagnosis.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {teeth.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message={t("Chưa chọn răng")}
          description={t("Chọn ít nhất một răng hoặc một mặt răng trên sơ đồ trước khi tạo phiếu chẩn đoán.")}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("Răng đã chọn: {0}", formatTeeth(teeth))}
        />
      )}

      <Form form={form} layout="vertical" requiredMark disabled={teeth.length === 0}>
        <Form.Item
          name="diagnosisId"
          label={t("Chẩn đoán")}
          rules={[{ required: true, message: t("Vui lòng chọn chẩn đoán") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={
              (diagnoses?.length ?? 0) === 0
                ? t("Chưa có danh mục chẩn đoán — thêm ở trang Danh mục")
                : t("Chọn chẩn đoán")
            }
            options={(diagnoses ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item
          name="staffId"
          label={t("Bác sĩ chẩn đoán")}
          rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t("Chọn bác sĩ")}
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="secondStaffId" label={t("Bác sĩ hỗ trợ")}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("Không bắt buộc")}
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="note" label={t("Ghi chú")}>
          <Input.TextArea rows={3} placeholder={t("Mô tả tình trạng")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
