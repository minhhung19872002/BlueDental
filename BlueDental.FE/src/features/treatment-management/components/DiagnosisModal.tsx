import { useEffect } from "react";
import { Alert, Form, Input, Modal, Select, message } from "antd";
import { useTranslation } from "react-i18next";
import { useCreateDiagnosis } from "../api/consultingQueries";
import { formatTeeth, type ToothSelectionDto } from "../api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

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
  const { t } = useTranslation();
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

      message.success(t("treatment.diagnosisCreated"));
      onCreated?.();
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("treatment.diagnosisModalTitle")}
      okText={t("treatment.diagnosisModalOk")}
      cancelText={t("treatment.diagnosisModalCancel")}
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
          message={t("treatment.diagnosisAlertNoTeeth")}
          description={t("treatment.diagnosisAlertNoTeethDesc")}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("treatment.diagnosisAlertTeethSelected", { teeth: formatTeeth(teeth) })}
        />
      )}

      <Form form={form} layout="vertical" requiredMark disabled={teeth.length === 0}>
        <Form.Item
          name="diagnosisId"
          label={t("treatment.diagnosisFieldDiagnosis")}
          rules={[{ required: true, message: t("treatment.diagnosisDiagnosisRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={
              (diagnoses?.length ?? 0) === 0
                ? t("treatment.diagnosisDiagnosisEmptyCatalog")
                : t("treatment.diagnosisDiagnosisPlaceholder")
            }
            options={(diagnoses ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item
          name="staffId"
          label={t("treatment.diagnosisFieldDoctor")}
          rules={[{ required: true, message: t("treatment.diagnosisDoctorRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t("treatment.diagnosisDoctorPlaceholder")}
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="secondStaffId" label={t("treatment.diagnosisFieldSecondDoctor")}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("treatment.diagnosisSecondDoctorPlaceholder")}
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="note" label={t("treatment.diagnosisFieldNote")}>
          <Input.TextArea rows={3} placeholder={t("treatment.diagnosisNotePlaceholder")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
